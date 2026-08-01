import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

type ExtendedPrismaClient = PrismaClient & {
    chatSession: Prisma.ChatSessionDelegate;
    chatMessage: Prisma.ChatMessageDelegate;
    verificationAttempt: Prisma.VerificationAttemptDelegate;
    toolAuditLog: Prisma.ToolAuditLogDelegate;
    knowledgeDocument: Prisma.KnowledgeDocumentDelegate;
    knowledgeChunk: Prisma.KnowledgeChunkDelegate;
    // These exist after running `prisma generate` with the updated schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coupon: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookingRoom: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    galleryImage: any;
};

// Lazy initialization to ensure env vars are loaded
let pool: Pool | null = null;
let adapter: PrismaPg | null = null;
let prismaClient: ExtendedPrismaClient | null = null;

function shouldUseSsl(connectionString: string): boolean {
    if (process.env.DATABASE_SSL === 'true') {
        return true;
    }

    if (process.env.DATABASE_SSL === 'false') {
        return false;
    }

    return connectionString.includes('supabase.com') || process.env.NODE_ENV === 'production';
}

function getAdapter() {
    if (!adapter) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL is not defined');
        }

        const useSsl = shouldUseSsl(connectionString);
        pool = new Pool({
            connectionString,
            max: 1,
            ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        });
        adapter = new PrismaPg(pool);
    }
    return adapter;
}

declare global {
    var prisma: ExtendedPrismaClient | undefined;
}

function createPrismaClient(): ExtendedPrismaClient {
    return new PrismaClient({
        adapter: getAdapter(),
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    }) as ExtendedPrismaClient;
}

function getPrismaClient(): ExtendedPrismaClient {
    if (globalThis.prisma) {
        return globalThis.prisma;
    }

    if (!prismaClient) {
        prismaClient = createPrismaClient();

        if (process.env.NODE_ENV !== 'production') {
            globalThis.prisma = prismaClient;
        }
    }

    return prismaClient;
}

export const prisma = new Proxy({} as ExtendedPrismaClient, {
    get(_target, prop, receiver) {
        const client = getPrismaClient();
        const value = Reflect.get(client, prop, receiver);
        return typeof value === 'function' ? value.bind(client) : value;
    },
    has(_target, prop) {
        return prop in getPrismaClient();
    },
    ownKeys() {
        return Reflect.ownKeys(getPrismaClient());
    },
    getOwnPropertyDescriptor(_target, prop) {
        return Object.getOwnPropertyDescriptor(getPrismaClient(), prop);
    },
}) as ExtendedPrismaClient;

if (process.env.NODE_ENV === 'production' && globalThis.prisma) {
    prismaClient = globalThis.prisma;
}
