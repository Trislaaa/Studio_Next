/**
 * Generic API Rate Limiter
 *
 * Provides IP-based rate limiting for any API endpoint.
 * Uses Upstash Redis for distributed state when configured,
 * falls back to an in-memory Map for single-instance deployments.
 *
 * Usage:
 *   const limit = await checkApiRateLimit(request, 'booking', { max: 10, windowMs: 15 * 60 * 1000 });
 *   if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RateLimitPolicy {
    max: number;
    windowMs: number;
}

interface RateLimitBucket {
    count: number;
    windowStart: number;
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

// ─── In-Memory Store ────────────────────────────────────────────────────────

const buckets = new Map<string, RateLimitBucket>();
let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Upstash Config ─────────────────────────────────────────────────────────

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const UPSTASH_TIMEOUT_MS = 2500;

function hasUpstash(): boolean {
    return Boolean(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);
}

// ─── IP Extraction ──────────────────────────────────────────────────────────

function getRequestIp(request: NextRequest): string | null {
    const directIp = (request as { ip?: string }).ip;
    if (directIp && directIp.toLowerCase() !== 'unknown') return directIp;

    const candidates = [
        request.headers.get('x-vercel-forwarded-for'),
        request.headers.get('x-forwarded-for'),
        request.headers.get('x-real-ip'),
        request.headers.get('cf-connecting-ip'),
        request.headers.get('true-client-ip'),
    ].filter(Boolean) as string[];

    for (const value of candidates) {
        const first = value.split(',')[0]?.trim();
        if (first && first.toLowerCase() !== 'unknown') return first;
    }

    return null;
}

function buildFingerprint(request: NextRequest): string {
    return createHash('sha256')
        .update(
            [
                request.headers.get('user-agent') ?? '',
                request.headers.get('accept-language') ?? '',
                request.headers.get('sec-ch-ua') ?? '',
                request.headers.get('sec-ch-ua-platform') ?? '',
                request.headers.get('host') ?? '',
            ].join('|')
        )
        .digest('hex')
        .slice(0, 48);
}

// ─── Upstash Distributed Rate Limit ────────────────────────────────────────

type UpstashPipelineResult = { result?: unknown; error?: string };

async function upstashPipeline(commands: Array<(string | number)[]>): Promise<UpstashPipelineResult[]> {
    if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
        throw new Error('Upstash not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTASH_TIMEOUT_MS);

    try {
        const response = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(commands),
            signal: controller.signal,
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Upstash error ${response.status}: ${body}`);
        }

        return (await response.json()) as UpstashPipelineResult[];
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Upstash timeout after ${UPSTASH_TIMEOUT_MS}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function consumeDistributed(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const results = await upstashPipeline([
        ['INCR', key],
        ['PEXPIRE', key, policy.windowMs, 'NX'],
        ['PTTL', key],
    ]);

    const pipelineError = results.find((r) => typeof r?.error === 'string' && r.error.length > 0);
    if (pipelineError?.error) throw new Error(`Upstash pipeline error: ${pipelineError.error}`);

    const count = Number(results[0]?.result ?? 0);
    let ttlMs = Number(results[2]?.result ?? -1);

    if (!Number.isFinite(count) || count <= 0) throw new Error('Unexpected increment value');

    if (!Number.isFinite(ttlMs) || ttlMs <= 0) ttlMs = policy.windowMs;

    if (count > policy.max) {
        const retryAfterMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : policy.windowMs;
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }

    return { allowed: true, retryAfterSeconds: 0 };
}

// ─── In-Memory Rate Limit ──────────────────────────────────────────────────

function cleanupExpired(now: number) {
    if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
    for (const [key, bucket] of buckets.entries()) {
        if (now - bucket.windowStart >= bucket.windowMs) buckets.delete(key);
    }
    lastCleanupAt = now;
}

function consumeLocal(key: string, policy: RateLimitPolicy, now: number): RateLimitResult {
    const existing = buckets.get(key);

    if (!existing || now - existing.windowStart >= policy.windowMs) {
        buckets.set(key, { count: 1, windowStart: now, windowMs: policy.windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= policy.max) {
        const retryAfterMs = policy.windowMs - (now - existing.windowStart);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }

    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check IP-based rate limit for any API endpoint.
 *
 * @param request   - The incoming NextRequest
 * @param action    - A unique label (e.g. 'booking', 'otp-send') to namespace the limit
 * @param policy    - { max, windowMs } — how many requests per window
 * @returns         - { allowed, retryAfterSeconds }
 */
export async function checkApiRateLimit(
    request: NextRequest,
    action: string,
    policy: RateLimitPolicy
): Promise<RateLimitResult> {
    const ip = getRequestIp(request);
    const scope = ip ? `ip:${ip}` : `fp:${buildFingerprint(request)}`;
    const key = `api-rl:${action}:${scope}`;

    // Try distributed (Upstash) first
    if (hasUpstash()) {
        try {
            return await consumeDistributed(key, policy);
        } catch (err) {
            console.warn(`[RateLimit] Upstash fallback for "${action}":`, err);
        }
    }

    // Fallback to in-memory
    const now = Date.now();
    cleanupExpired(now);
    return consumeLocal(key, policy, now);
}
