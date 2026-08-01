import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as { toNumber: unknown }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value) || 0;
}

type GroupAccumulator = {
  roomType: string;
  floor: number | null;
  roomIds: string[];
  roomNumbers: string[];
  baseRateTotal: number;
  weekendAdjustmentTotal: number;
  extraGuestChargeTotal: number;
  sampleCount: number;
  latestEffectiveFromMs: number | null;
};

function buildGroupKey(roomType: string, floor: number | null) {
  return `${roomType}::${floor === null ? 'null' : String(floor)}`;
}

// GET /api/admin/rates - Grouped by room type + floor
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
    if (guard.error) return guard.error;

    const rooms = await prisma.room.findMany({
      orderBy: [
        { floor: 'asc' },
        { roomNumber: 'asc' },
      ],
      include: {
        rates: {
          where: { effectiveFrom: { lte: new Date() } },
          orderBy: [
            { effectiveFrom: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 1,
        },
      },
    });

    const grouped = new Map<string, GroupAccumulator>();

    for (const room of rooms) {
      const latest = room.rates[0];
      const baseRate = latest ? toNumber(latest.baseRate) : 0;
      const weekendMultiplier = latest ? toNumber(latest.weekendMultiplier) : 1;
      const weekendRate = Math.round(baseRate * weekendMultiplier);
      const weekendAdjustment = Math.max(0, weekendRate - baseRate);
      const extraGuestCharge = room.extraGuestCharge ? toNumber(room.extraGuestCharge) : 500;
      const effectiveFromMs = latest ? latest.effectiveFrom.getTime() : null;

      const key = buildGroupKey(room.type, room.floor);
      const existing = grouped.get(key);

      if (existing) {
        existing.roomIds.push(room.id);
        existing.roomNumbers.push(room.roomNumber);
        existing.baseRateTotal += baseRate;
        existing.weekendAdjustmentTotal += weekendAdjustment;
        existing.extraGuestChargeTotal += extraGuestCharge;
        existing.sampleCount += 1;

        if (effectiveFromMs !== null) {
          existing.latestEffectiveFromMs =
            existing.latestEffectiveFromMs === null
              ? effectiveFromMs
              : Math.max(existing.latestEffectiveFromMs, effectiveFromMs);
        }
      } else {
        grouped.set(key, {
          roomType: room.type,
          floor: room.floor,
          roomIds: [room.id],
          roomNumbers: [room.roomNumber],
          baseRateTotal: baseRate,
          weekendAdjustmentTotal: weekendAdjustment,
          extraGuestChargeTotal: extraGuestCharge,
          sampleCount: 1,
          latestEffectiveFromMs: effectiveFromMs,
        });
      }
    }

    const rates = Array.from(grouped.values())
      .map((group) => {
        const avgBaseRate = Math.round(group.baseRateTotal / group.sampleCount);
        const avgWeekendAdjustment = Math.round(group.weekendAdjustmentTotal / group.sampleCount);
        const avgExtraGuestCharge = Math.round(group.extraGuestChargeTotal / group.sampleCount);

        return {
          groupKey: buildGroupKey(group.roomType, group.floor),
          roomType: group.roomType,
          floor: group.floor,
          roomCount: group.roomIds.length,
          roomNumbers: [...group.roomNumbers].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
          baseRate: avgBaseRate,
          weekendAdjustment: avgWeekendAdjustment,
          weekendRate: avgBaseRate + avgWeekendAdjustment,
          extraGuestCharge: avgExtraGuestCharge,
          effectiveFrom:
            group.latestEffectiveFromMs === null
              ? null
              : new Date(group.latestEffectiveFromMs).toISOString(),
        };
      })
      .sort((a, b) => {
        if (a.roomType !== b.roomType) {
          return a.roomType.localeCompare(b.roomType);
        }

        if (a.floor === null && b.floor !== null) return 1;
        if (a.floor !== null && b.floor === null) return -1;
        if (a.floor === null && b.floor === null) return 0;

        return (a.floor ?? 0) - (b.floor ?? 0);
      });

    return NextResponse.json({ rates }, { status: 200 });
  } catch (error) {
    console.error('Error fetching rates:', error);
    return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 500 });
  }
}

// POST /api/admin/rates - Update rates for all rooms in a roomType + floor group
const updateSchema = z.object({
  roomType: z.enum(['DELUXE', 'SUITE', 'FAMILY', 'STANDARD']),
  floor: z.number().int().nullable(),
  baseRate: z.coerce.number().min(0).default(0),
  weekendAdjustment: z.coerce.number().min(0).default(0),
  extraGuestCharge: z.coerce.number().min(0).default(500),
  effectiveFrom: z.string().optional(), // YYYY-MM-DD
});

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(req, ['ADMIN', 'MANAGER']);
    if (guard.error) return guard.error;

    const body = await req.json();

    const parsedFloor =
      body.floor === null || body.floor === undefined || body.floor === '' || body.floor === 'null'
        ? null
        : typeof body.floor === 'string'
          ? Number(body.floor)
          : body.floor;

    const data = updateSchema.parse({
      ...body,
      floor: parsedFloor,
    });

    if (data.baseRate === 0 && data.weekendAdjustment > 0) {
      return NextResponse.json(
        { error: 'Base rate must be greater than zero if weekend adjustment is provided' },
        { status: 400 }
      );
    }

    // The weekendMultiplier column is Decimal(3,2) — max value 9.99.
    // Guard: weekend adjustment must not push the multiplier to 10 or above.
    if (data.baseRate > 0 && data.weekendAdjustment >= data.baseRate * 9) {
      return NextResponse.json(
        { error: `Weekend adjustment (₹${data.weekendAdjustment}) is too large relative to the base rate (₹${data.baseRate}). Maximum weekend adjustment is ${Math.floor(data.baseRate * 8.99)}.` },
        { status: 400 }
      );
    }

    const rooms = await prisma.room.findMany({
      where: {
        type: data.roomType,
        floor: data.floor,
      },
      select: {
        id: true,
        roomNumber: true,
      },
    });

    if (rooms.length === 0) {
      return NextResponse.json(
        { error: `No rooms found for type '${data.roomType}'${data.floor !== null ? ` on floor ${data.floor}` : ''}. The room data may have changed — please refresh the page.` },
        { status: 404 }
      );
    }

    const effFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : new Date();
    if (Number.isNaN(effFrom.getTime())) {
      return NextResponse.json({ error: 'Invalid effectiveFrom date' }, { status: 400 });
    }

    const weekendRate = data.baseRate + data.weekendAdjustment;
    // Round to 2dp — weekendMultiplier column is Decimal(3,2), max storable value is 9.99.
    const weekendMultiplier =
      data.baseRate > 0
        ? Math.min(9.99, Math.round((weekendRate / data.baseRate) * 100) / 100)
        : 1.00;

    // Store weekend adjustment as derived multiplier for compatibility with pricing engine.
    await prisma.$transaction([
      ...rooms.map((room) =>
        prisma.roomRate.create({
          data: {
            roomId: room.id,
            baseRate: new Prisma.Decimal(data.baseRate),
            weekendMultiplier: new Prisma.Decimal(weekendMultiplier),
            effectiveFrom: effFrom,
            rateType: 'BASE',
          },
        })
      ),
      ...rooms.map((room) =>
        prisma.room.update({
          where: { id: room.id },
          data: { extraGuestCharge: new Prisma.Decimal(data.extraGuestCharge) },
        })
      ),
    ]);

    return NextResponse.json(
      {
        success: true,
        roomType: data.roomType,
        floor: data.floor,
        updatedRoomCount: rooms.length,
        updatedRoomNumbers: rooms.map((room) => room.roomNumber),
        weekendRate,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation failed for rates POST:', error.issues);
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('Error updating rates:', error);
    return NextResponse.json({ error: 'Failed to update rates' }, { status: 500 });
  }
}
