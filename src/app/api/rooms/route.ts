import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/rooms - Public endpoint to fetch rooms visible to guests
// Only returns AVAILABLE rooms, along with last base rate and parsed amenities/images
export async function GET(_request: NextRequest) {
  try {
    const rooms = await prisma.room.findMany({
      where: { status: 'AVAILABLE' },
      include: {
        rates: {
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
      orderBy: { roomNumber: 'asc' },
    });

    const parsedRooms = rooms.map((room: any) => ({
      id: room.id,
      roomNumber: room.roomNumber,
      type: room.type,
      capacity: room.maxOccupancy ?? room.baseOccupancy ?? 2,
      description: room.description ?? '',
      amenities: typeof room.amenities === 'string' ? JSON.parse(room.amenities) : room.amenities,
      images: typeof room.images === 'string' ? JSON.parse(room.images) : room.images,
      baseRate: room.rates[0]?.baseRate?.toNumber() ?? 0,
    }));

    return NextResponse.json({ rooms: parsedRooms }, { status: 200 });
  } catch (error) {
    console.error('Error fetching public rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
  }
}
