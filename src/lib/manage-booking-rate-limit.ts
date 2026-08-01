import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

type ManageRateLimitAction = 'auth' | 'token' | 'cancel';

type RateLimitPolicy = {
  max: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  windowStart: number;
  windowMs: number;
};

const buckets = new Map<string, RateLimitBucket>();
let lastCleanupAt = 0;

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_UPSTASH_TIMEOUT_MS = 2500;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

type PolicySet = {
  ip: RateLimitPolicy;
  identity: RateLimitPolicy;
};

const toPositiveInteger = (raw: string | undefined, fallback: number) => {
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const UPSTASH_TIMEOUT_MS = toPositiveInteger(
  process.env.UPSTASH_REDIS_TIMEOUT_MS,
  DEFAULT_UPSTASH_TIMEOUT_MS
);

const toWindowMs = (rawSeconds: string | undefined, fallbackSeconds: number) => {
  return toPositiveInteger(rawSeconds, fallbackSeconds) * 1000;
};

const manageRatePolicies: Record<ManageRateLimitAction, PolicySet> = {
  auth: {
    ip: {
      max: toPositiveInteger(process.env.MANAGE_AUTH_RATE_LIMIT_IP_MAX, 5),
      windowMs: toWindowMs(process.env.MANAGE_AUTH_RATE_LIMIT_IP_WINDOW_SECONDS, 15 * 60),
    },
    identity: {
      max: toPositiveInteger(process.env.MANAGE_AUTH_RATE_LIMIT_IDENTITY_MAX, 3),
      windowMs: toWindowMs(process.env.MANAGE_AUTH_RATE_LIMIT_IDENTITY_WINDOW_SECONDS, 30 * 60),
    },
  },
  token: {
    ip: {
      max: toPositiveInteger(process.env.MANAGE_TOKEN_RATE_LIMIT_IP_MAX, 30),
      windowMs: toWindowMs(process.env.MANAGE_TOKEN_RATE_LIMIT_IP_WINDOW_SECONDS, 10 * 60),
    },
    identity: {
      max: toPositiveInteger(process.env.MANAGE_TOKEN_RATE_LIMIT_IDENTITY_MAX, 15),
      windowMs: toWindowMs(process.env.MANAGE_TOKEN_RATE_LIMIT_IDENTITY_WINDOW_SECONDS, 10 * 60),
    },
  },
  cancel: {
    ip: {
      max: toPositiveInteger(process.env.MANAGE_CANCEL_RATE_LIMIT_IP_MAX, 10),
      windowMs: toWindowMs(process.env.MANAGE_CANCEL_RATE_LIMIT_IP_WINDOW_SECONDS, 15 * 60),
    },
    identity: {
      max: toPositiveInteger(process.env.MANAGE_CANCEL_RATE_LIMIT_IDENTITY_MAX, 5),
      windowMs: toWindowMs(process.env.MANAGE_CANCEL_RATE_LIMIT_IDENTITY_WINDOW_SECONDS, 15 * 60),
    },
  },
};

function getRequestIp(request: NextRequest) {
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

function buildAnonymousRequestFingerprint(request: NextRequest) {
  return [
    request.headers.get('user-agent') ?? '',
    request.headers.get('accept-language') ?? '',
    request.headers.get('sec-ch-ua') ?? '',
    request.headers.get('sec-ch-ua-platform') ?? '',
    request.headers.get('host') ?? '',
    request.nextUrl.pathname,
  ].join('|');
}

function hashIdentity(identity: string) {
  return createHash('sha256').update(identity).digest('hex').slice(0, 64);
}

function hasUpstash() {
  return Boolean(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);
}

type UpstashPipelineResult = {
  result?: unknown;
  error?: string;
};

async function upstashPipeline(commands: Array<(string | number)[]>): Promise<UpstashPipelineResult[]> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTASH_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Upstash timeout after ${UPSTASH_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upstash error ${response.status}: ${body}`);
  }

  return (await response.json()) as UpstashPipelineResult[];
}

function assertNoPipelineErrors(results: UpstashPipelineResult[], key: string) {
  const pipelineError = results.find((result) => typeof result?.error === 'string' && result.error.length > 0);
  if (pipelineError?.error) {
    throw new Error(`Upstash pipeline error for ${key}: ${pipelineError.error}`);
  }
}

async function consumeBucketDistributed(key: string, policy: RateLimitPolicy) {
  const pipelineResults = await upstashPipeline([
    ['INCR', key],
    ['PEXPIRE', key, policy.windowMs, 'NX'],
    ['PTTL', key],
  ]);
  assertNoPipelineErrors(pipelineResults, key);

  const [countResult, , ttlResult] = pipelineResults;

  const count = Number(countResult?.result ?? 0);
  let ttlMs = Number(ttlResult?.result ?? -1);

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error(`Unexpected increment value for ${key}`);
  }

  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    const ttlResults = await upstashPipeline([
      ['PTTL', key],
    ]);
    assertNoPipelineErrors(ttlResults, key);
    ttlMs = Number(ttlResults[0]?.result ?? -1);

    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      ttlMs = policy.windowMs;
    }
  }

  if (count > policy.max) {
    const retryAfterMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : policy.windowMs;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart >= bucket.windowMs) {
      buckets.delete(key);
    }
  }

  lastCleanupAt = now;
}

function consumeBucket(key: string, policy: RateLimitPolicy, now: number) {
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= policy.windowMs) {
    buckets.set(key, {
      count: 1,
      windowStart: now,
      windowMs: policy.windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= policy.max) {
    const retryAfterMs = policy.windowMs - (now - existing.windowStart);

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export type ManageRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export async function checkManageBookingRateLimit(input: {
  request: NextRequest;
  action: ManageRateLimitAction;
  identity?: string;
}): Promise<ManageRateLimitResult> {
  const now = Date.now();

  const policy = manageRatePolicies[input.action];
  const ip = getRequestIp(input.request);
  const ipScope = ip
    ? `ip:${ip}`
    : `anon:${hashIdentity(buildAnonymousRequestFingerprint(input.request))}`;

  if (hasUpstash()) {
    try {
      const ipResult = await consumeBucketDistributed(`manage:${input.action}:${ipScope}`, policy.ip);
      if (!ipResult.allowed) {
        return ipResult;
      }

      if (input.identity) {
        const identityHash = hashIdentity(input.identity);
        const identityResult = await consumeBucketDistributed(
          `manage:${input.action}:identity:${identityHash}`,
          policy.identity
        );

        if (!identityResult.allowed) {
          return identityResult;
        }
      }

      return { allowed: true, retryAfterSeconds: 0 };
    } catch (error) {
      console.warn('[ManageBooking] Upstash rate limit fallback:', error);
    }
  }

  cleanupExpiredBuckets(now);

  const ipResult = consumeBucket(`manage:${input.action}:${ipScope}`, policy.ip, now);
  if (!ipResult.allowed) {
    return ipResult;
  }

  if (input.identity) {
    const identityHash = hashIdentity(input.identity);
    const identityResult = consumeBucket(
      `manage:${input.action}:identity:${identityHash}`,
      policy.identity,
      now
    );

    if (!identityResult.allowed) {
      return identityResult;
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
