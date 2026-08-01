import { prisma } from '@/lib/db';
import { chatConfig } from './config';

export type ChatRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  minuteCount: number;
  hourCount: number;
};

export async function checkChatRateLimit(sessionId: string): Promise<ChatRateLimitResult> {
  const now = Date.now();
  const oneMinuteAgo = new Date(now - 60 * 1000);
  const oneHourAgo = new Date(now - 60 * 60 * 1000);

  const [minuteCount, hourCount] = await Promise.all([
    prisma.chatMessage.count({
      where: {
        sessionId,
        role: 'user',
        createdAt: { gte: oneMinuteAgo },
      },
    }),
    prisma.chatMessage.count({
      where: {
        sessionId,
        role: 'user',
        createdAt: { gte: oneHourAgo },
      },
    }),
  ]);

  const minuteExceeded = minuteCount >= chatConfig.rateLimitPerMinute;
  const hourExceeded = hourCount >= chatConfig.rateLimitPerHour;

  return {
    allowed: !(minuteExceeded || hourExceeded),
    retryAfterSeconds: minuteExceeded ? 60 : 3600,
    minuteCount,
    hourCount,
  };
}
