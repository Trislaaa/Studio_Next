import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

// GET /api/admin/occupancy?month=YYYY-MM
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
    if (guard.error) return guard.error;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month must be in YYYY-MM' }, { status: 400 });
    }

    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1); // first day of next month

    // Fetch bookings overlapping the month range
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { AND: [{ checkIn: { gte: start } }, { checkIn: { lt: end } }] },
          { AND: [{ checkOut: { gt: start } }, { checkOut: { lte: end } }] },
          { AND: [{ checkIn: { lte: start } }, { checkOut: { gte: end } }] },
        ],
      },
      select: { checkIn: true, checkOut: true },
    });

    // Fetch room blocks overlapping month range
    const blocks = await (prisma as any).roomBlock.findMany({
      where: {
        OR: [
          { AND: [{ startDate: { gte: start } }, { startDate: { lt: end } }] },
          { AND: [{ endDate: { gt: start } }, { endDate: { lte: end } }] },
          { AND: [{ startDate: { lte: start } }, { endDate: { gte: end } }] },
        ],
      },
      select: { startDate: true, endDate: true },
    });

    // Build daily stats
    const days: Record<string, { bookings: number; checkIns: number; checkOuts: number; blocks: number }> = {};
    const cursor = new Date(start);
    while (cursor < end) {
      days[cursor.toISOString().slice(0, 10)] = { bookings: 0, checkIns: 0, checkOuts: 0, blocks: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const b of bookings) {
      const ci = new Date(b.checkIn);
      const co = new Date(b.checkOut);
      // Each day from max(ci,start) to min(co,end)
      const d = new Date(ci < start ? start : ci);
      const stop = co > end ? end : co;
      while (d < stop) {
        const key = d.toISOString().slice(0, 10);
        if (days[key]) days[key].bookings += 1;
        d.setDate(d.getDate() + 1);
      }
      const ciKey = ci.toISOString().slice(0, 10);
      const coKey = co.toISOString().slice(0, 10);
      if (days[ciKey]) days[ciKey].checkIns += 1;
      if (days[coKey]) days[coKey].checkOuts += 1;
    }

    for (const bl of blocks) {
      const s = new Date(bl.startDate < start ? start : bl.startDate);
      const e = bl.endDate > end ? end : bl.endDate;
      const d = new Date(s);
      while (d < e) {
        const key = d.toISOString().slice(0, 10);
        if (days[key]) days[key].blocks += 1;
        d.setDate(d.getDate() + 1);
      }
    }

    return NextResponse.json({ month, days }, { status: 200 });
  } catch (error) {
    console.error('Error fetching occupancy:', error);
    return NextResponse.json({ error: 'Failed to fetch occupancy' }, { status: 500 });
  }
}
