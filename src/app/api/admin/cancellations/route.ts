import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

type CancellationActor = 'ADMIN' | 'GUEST' | 'UNKNOWN';

const DEFAULT_PAGE_LIMIT = 500;
const MAX_PAGE_LIMIT = 500;
const MAX_SCAN_ROUNDS = 20;

function readMetadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, unknown>;
}

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

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseActor(value: unknown): CancellationActor {
  if (value === 'ADMIN' || value === 'GUEST') {
    return value;
  }

  return 'UNKNOWN';
}

function parsePolicyWindow(value: unknown): 'full' | 'partial' | 'none' | 'unknown' {
  if (value === 'full' || value === 'partial' || value === 'none') {
    return value;
  }

  return 'unknown';
}

function parseIsoDateTime(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function parseDateParam(value: string | null, endOfDay: boolean) {
  if (!value) return null;

  const normalized = endOfDay
    ? `${value}T23:59:59.999Z`
    : `${value}T00:00:00.000Z`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

type CancellationHistoryItem = {
  bookingId: string;
  bookingReference: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  cancelledAt: string;
  cancelledBy: CancellationActor;
  cancellationReason: string | null;
  policyWindow: 'full' | 'partial' | 'none' | 'unknown';
  paidAmount: number;
  refundAmount: number;
  refundPercentage: number;
  cancellationCharge: number;
  refundGatewayId: string | null;
  paymentMethod: string | null;
};

type CancellationCursor = {
  updatedAt: string;
  id: string;
};

type CancellationWithCursor = {
  item: CancellationHistoryItem;
  cursor: CancellationCursor;
};

type BookingWithCancellationRelations = Prisma.BookingGetPayload<{
  include: {
    guest: true;
    rooms: { include: { room: true } };
    transaction: true;
  };
}>;

type CancellationSummaryRow = {
  totalCancellations: number;
  totalRefundAmount: number;
  fullRefundCount: number;
  partialRefundCount: number;
  noRefundCount: number;
  adminCancelledCount: number;
  guestCancelledCount: number;
};

function parseLimit(raw: string | null) {
  if (!raw) return DEFAULT_PAGE_LIMIT;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_LIMIT;
  }

  return Math.min(parsed, MAX_PAGE_LIMIT);
}

function encodeCursor(cursor: CancellationCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(raw: string | null): CancellationCursor | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8')
    ) as Partial<CancellationCursor>;

    if (
      typeof parsed.updatedAt !== 'string' ||
      typeof parsed.id !== 'string'
    ) {
      return null;
    }

    const asDate = new Date(parsed.updatedAt);
    if (Number.isNaN(asDate.getTime())) {
      return null;
    }

    return {
      updatedAt: asDate.toISOString(),
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function mapBookingToCancellationItem(
  booking: BookingWithCancellationRelations
): CancellationHistoryItem {
  const metadata = booking.transaction
    ? readMetadataObject(booking.transaction.metadata as Prisma.JsonValue | null)
    : {};
  const cancellationData = readMetadataObject(
    metadata.cancellation as Prisma.JsonValue | null
  );

  const cancelledAtFromAudit = parseIsoDateTime(cancellationData.cancelledAt);
  const cancelledAt = cancelledAtFromAudit ?? booking.updatedAt.toISOString();
  const cancelledBy = parseActor(cancellationData.actor);
  const paidAmount = booking.transaction ? toNumber(booking.transaction.amount) : 0;
  const refundAmount = booking.transaction ? toNumber(booking.transaction.refundAmount) : 0;
  const cancellationCharge = Math.max(0, paidAmount - refundAmount);

  return {
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    guestName: booking.guest.fullName,
    guestEmail: booking.guest.email,
    guestPhone: booking.guest.phone,
    roomNumber: booking.rooms[0]?.room.roomNumber ?? 'N/A',
    roomType: booking.rooms[0]?.room.type ?? 'N/A',
    checkIn: booking.checkIn.toISOString(),
    checkOut: booking.checkOut.toISOString(),
    cancelledAt,
    cancelledBy,
    cancellationReason:
      typeof cancellationData.cancellationReason === 'string'
        ? cancellationData.cancellationReason
        : null,
    policyWindow: parsePolicyWindow(cancellationData.policyWindow),
    paidAmount,
    refundAmount,
    refundPercentage:
      typeof cancellationData.refundPercentage === 'number'
        ? cancellationData.refundPercentage
        : 0,
    cancellationCharge,
    refundGatewayId:
      typeof cancellationData.refundGatewayId === 'string'
        ? cancellationData.refundGatewayId
        : null,
    paymentMethod: booking.transaction?.paymentMethod ?? null,
  };
}

function passesFilters(input: {
  item: CancellationHistoryItem;
  actorFilter: 'ADMIN' | 'GUEST' | null;
  fromDate: Date | null;
  toDate: Date | null;
}) {
  const { item, actorFilter, fromDate, toDate } = input;

  if (actorFilter && item.cancelledBy !== actorFilter) {
    return false;
  }

  const cancelledAtMs = new Date(item.cancelledAt).getTime();

  if (fromDate && cancelledAtMs < fromDate.getTime()) {
    return false;
  }

  if (toDate && cancelledAtMs > toDate.getTime()) {
    return false;
  }

  return true;
}

function buildWhereClause(input: {
  search: string | undefined;
  cursor: CancellationCursor | null;
}): Prisma.BookingWhereInput {
  const andConditions: Prisma.BookingWhereInput[] = [
    {
      status: 'CANCELLED',
    },
  ];

  if (input.search) {
    andConditions.push({
      OR: [
        { bookingReference: { contains: input.search, mode: 'insensitive' } },
        { guest: { fullName: { contains: input.search, mode: 'insensitive' } } },
        { guest: { email: { contains: input.search, mode: 'insensitive' } } },
        { rooms: { some: { room: { roomNumber: { contains: input.search, mode: 'insensitive' } } } } },
      ],
    });
  }

  if (input.cursor) {
    const cursorDate = new Date(input.cursor.updatedAt);

    andConditions.push({
      OR: [
        { updatedAt: { lt: cursorDate } },
        {
          updatedAt: cursorDate,
          id: { lt: input.cursor.id },
        },
      ],
    });
  }

  return {
    AND: andConditions,
  };
}

function buildSummaryWhereClause(input: {
  search: string | undefined;
  actorFilter: 'ADMIN' | 'GUEST' | null;
  fromDate: Date | null;
  toDate: Date | null;
}) {
  const clauses: Prisma.Sql[] = [Prisma.sql`b.status = 'CANCELLED'`];

  if (input.search) {
    const like = `%${input.search}%`;
    clauses.push(Prisma.sql`
      (
        b.booking_reference ILIKE ${like}
        OR g.full_name ILIKE ${like}
        OR g.email ILIKE ${like}
        OR r.room_number ILIKE ${like}
      )
    `);
  }

  if (input.actorFilter) {
    clauses.push(
      Prisma.sql`COALESCE(t.metadata->'cancellation'->>'actor', 'UNKNOWN') = ${input.actorFilter}`
    );
  }

  if (input.fromDate) {
    clauses.push(
      Prisma.sql`COALESCE((t.metadata->'cancellation'->>'cancelledAt')::timestamptz, b.updated_at) >= ${input.fromDate}`
    );
  }

  if (input.toDate) {
    clauses.push(
      Prisma.sql`COALESCE((t.metadata->'cancellation'->>'cancelledAt')::timestamptz, b.updated_at) <= ${input.toDate}`
    );
  }

  return Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
    if (guard.error) return guard.error;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const limit = parseLimit(searchParams.get('limit'));

    const cursorParam = searchParams.get('cursor');
    const initialCursor = decodeCursor(cursorParam);
    if (cursorParam && !initialCursor) {
      return NextResponse.json(
        { error: 'Invalid cursor' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const actorFilterRaw = searchParams.get('actor')?.toUpperCase();
    const fromDate = parseDateParam(searchParams.get('from'), false);
    const toDate = parseDateParam(searchParams.get('to'), true);

    const actorFilter =
      actorFilterRaw === 'ADMIN' || actorFilterRaw === 'GUEST'
        ? actorFilterRaw
        : null;

    const summaryWhere = buildSummaryWhereClause({
      search,
      actorFilter,
      fromDate,
      toDate,
    });

    const [summaryRow] = await prisma.$queryRaw<CancellationSummaryRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int AS "totalCancellations",
        COALESCE(SUM(COALESCE(t.refund_amount, 0)), 0)::float AS "totalRefundAmount",
        COALESCE(SUM(CASE WHEN COALESCE(t.metadata->'cancellation'->>'policyWindow', 'unknown') = 'full' THEN 1 ELSE 0 END), 0)::int AS "fullRefundCount",
        COALESCE(SUM(CASE WHEN COALESCE(t.metadata->'cancellation'->>'policyWindow', 'unknown') = 'partial' THEN 1 ELSE 0 END), 0)::int AS "partialRefundCount",
        COALESCE(SUM(CASE WHEN COALESCE(t.metadata->'cancellation'->>'policyWindow', 'unknown') = 'none' THEN 1 ELSE 0 END), 0)::int AS "noRefundCount",
        COALESCE(SUM(CASE WHEN COALESCE(t.metadata->'cancellation'->>'actor', 'UNKNOWN') = 'ADMIN' THEN 1 ELSE 0 END), 0)::int AS "adminCancelledCount",
        COALESCE(SUM(CASE WHEN COALESCE(t.metadata->'cancellation'->>'actor', 'UNKNOWN') = 'GUEST' THEN 1 ELSE 0 END), 0)::int AS "guestCancelledCount"
      FROM bookings b
      JOIN guests g ON g.id = b.guest_id
      LEFT JOIN booking_rooms br_first ON br_first.booking_id = b.id
      LEFT JOIN rooms r ON r.id = br_first.room_id
      LEFT JOIN transactions t ON t.booking_id = b.id
      ${summaryWhere}
    `);

    let scanCursor = initialCursor;
    let exhausted = false;
    const filteredRows: CancellationWithCursor[] = [];
    const batchSize = Math.min(
      Math.max(limit * 2, 50),
      MAX_PAGE_LIMIT + 1
    );

    for (
      let round = 0;
      round < MAX_SCAN_ROUNDS && filteredRows.length < limit + 1;
      round += 1
    ) {
      const bookings = await prisma.booking.findMany({
        where: buildWhereClause({
          search,
          cursor: scanCursor,
        }),
        include: {
          guest: true,
          rooms: { include: { room: true } },
          transaction: true,
        },
        orderBy: [
          { updatedAt: 'desc' },
          { id: 'desc' },
        ],
        take: batchSize,
      });

      if (bookings.length === 0) {
        exhausted = true;
        break;
      }

      for (const booking of bookings) {
        const item = mapBookingToCancellationItem(booking);

        if (!passesFilters({ item, actorFilter, fromDate, toDate })) {
          continue;
        }

        filteredRows.push({
          item,
          cursor: {
            updatedAt: booking.updatedAt.toISOString(),
            id: booking.id,
          },
        });

        if (filteredRows.length >= limit + 1) {
          break;
        }
      }

      const lastBooking = bookings[bookings.length - 1];
      scanCursor = {
        updatedAt: lastBooking.updatedAt.toISOString(),
        id: lastBooking.id,
      };

      if (bookings.length < batchSize) {
        exhausted = true;
        break;
      }
    }

    const pageRows = filteredRows.slice(0, limit);
    const cancellations = pageRows.map((entry) => entry.item);

    const hasMore = filteredRows.length > limit || !exhausted;

    const nextCursorSource =
      pageRows.length > 0
        ? pageRows[pageRows.length - 1].cursor
        : scanCursor;
    const nextCursor = hasMore && nextCursorSource
      ? encodeCursor(nextCursorSource)
      : null;

    const summary = summaryRow ?? {
      totalCancellations: 0,
      totalRefundAmount: 0,
      fullRefundCount: 0,
      partialRefundCount: 0,
      noRefundCount: 0,
      adminCancelledCount: 0,
      guestCancelledCount: 0,
    };

    return NextResponse.json(
      {
        cancellations,
        summary,
        pagination: {
          limit,
          hasMore,
          nextCursor,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching cancellation history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cancellation history' },
      { status: 500 }
    );
  }
}