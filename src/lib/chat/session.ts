import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { chatConfig } from './config';

export type ChatFingerprintInput = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

function hashValue(value?: string | null) {
  if (!value) return null;

  return createHash('sha256').update(value).digest('hex');
}

export function createChatSessionToken() {
  return randomUUID();
}

export async function createChatSession(input: ChatFingerprintInput = {}) {
  const sessionToken = createChatSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + chatConfig.sessionExpiryHours * 60 * 60 * 1000);

  try {
    return await prisma.chatSession.create({
      data: {
        sessionToken,
        ipHash: hashValue(input.ipAddress),
        userAgentHash: hashValue(input.userAgent),
        expiresAt,
        lastActivityAt: now,
      },
      select: {
        id: true,
        sessionToken: true,
        expiresAt: true,
        isVerified: true,
        createdAt: true,
      },
    });
  } catch (dbError) {
    console.warn('Database unready or unconfigured, using fallback chat session.');
    return {
      id: `anon-${sessionToken}`,
      sessionToken,
      expiresAt,
      isVerified: false,
      createdAt: now,
    };
  }
}

export async function getActiveChatSession(sessionToken: string) {
  if (sessionToken.startsWith('anon-') || !process.env.DATABASE_URL) {
    return {
      id: sessionToken.startsWith('anon-') ? sessionToken : `anon-${sessionToken}`,
      sessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isVerified: false,
      referenceNumber: null,
      emailOrPhone: null,
      createdAt: new Date(),
    };
  }

  try {
    const session = await prisma.chatSession.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return session;
  } catch (error) {
    return {
      id: `anon-${sessionToken}`,
      sessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isVerified: false,
      referenceNumber: null,
      emailOrPhone: null,
      createdAt: new Date(),
    };
  }
}

export async function touchChatSession(sessionId: string) {
  if (sessionId.startsWith('anon-') || !process.env.DATABASE_URL) {
    return null;
  }

  try {
    return await prisma.chatSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
  } catch (error) {
    return null;
  }
}
