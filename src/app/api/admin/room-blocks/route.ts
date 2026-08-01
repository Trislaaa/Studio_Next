import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { broadcastInventory } from '@/lib/realtime';
import { requireAuth } from '@/lib/auth-guard';

// GET /api/admin/room-blocks?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
    if (guard.error) return guard.error;

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end are required' }, { status: 400 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    const blocks = await (prisma as any).roomBlock.findMany({
      where: {
        OR: [
          { AND: [{ startDate: { lte: startDate } }, { endDate: { gte: startDate } }] },
          { AND: [{ startDate: { lte: endDate } }, { endDate: { gte: endDate } }] },
          { AND: [{ startDate: { gte: startDate } }, { endDate: { lte: endDate } }] },
        ],
      },
      include: { room: true },
      orderBy: { startDate: 'asc' },
    });

    return NextResponse.json({ blocks }, { status: 200 });
  } catch (error) {
    console.error('Error fetching room blocks:', error);
    return NextResponse.json({ error: 'Failed to fetch room blocks' }, { status: 500 });
  }
}

// POST /api/admin/room-blocks
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
    if (guard.error) return guard.error;

    const body = await request.json();
    const { roomId, startDate, endDate, reason } = body || {};

    if (!roomId || !startDate || !endDate) {
      return NextResponse.json({ error: 'roomId, startDate and endDate are required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 });
    }

    // Prevent overlapping blocks for the same room
    const overlap = await (prisma as any).roomBlock.findFirst({
      where: {
        roomId,
        OR: [
          { AND: [{ startDate: { lte: start } }, { endDate: { gt: start } }] },
          { AND: [{ startDate: { lt: end } }, { endDate: { gte: end } }] },
          { AND: [{ startDate: { gte: start } }, { endDate: { lte: end } }] },
        ],
      },
    });

    if (overlap) {
      return NextResponse.json({ error: 'Overlapping block exists for this room' }, { status: 400 });
    }

    const block = await (prisma as any).roomBlock.create({
      data: { roomId, startDate: start, endDate: end, reason },
    });
    // Broadcast inventory block creation
    await broadcastInventory({
      type: 'inventory:block:created',
      payload: { roomId, startDate: start.toISOString(), endDate: end.toISOString() }
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    console.error('Error creating room block:', error);
    return NextResponse.json({ error: 'Failed to create room block' }, { status: 500 });
  }
}
