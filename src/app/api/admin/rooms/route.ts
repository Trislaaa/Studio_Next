import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { roomSchema } from '@/lib/validations/room';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';

// GET /api/admin/rooms - Fetch all rooms with optional filters
export async function GET(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const type = searchParams.get('type');

        const rooms = await prisma.room.findMany({
            where: {
                ...(status && { status: status as any }),
                ...(type && { type: type as any }),
            },
            include: {
                rates: {
                    orderBy: { effectiveFrom: 'desc' },
                    take: 1,
                },
            },
            orderBy: { roomNumber: 'asc' },
        });

        // Parse amenities and images (stored as JSON strings)
        const parsedRooms = rooms.map((room: any) => ({
            ...room,
            amenities: typeof room.amenities === 'string' ? JSON.parse(room.amenities) : room.amenities,
            images: typeof room.images === 'string' ? JSON.parse(room.images) : room.images,
            baseRate: room.rates[0]?.baseRate?.toNumber() || 0,
        }));

        return NextResponse.json({ rooms: parsedRooms }, { status: 200 });
    } catch (error) {
        console.error('Error fetching rooms:', error);
        return NextResponse.json(
            { error: 'Failed to fetch rooms' },
            { status: 500 }
        );
    }
}

// POST /api/admin/rooms - Create a new room
export async function POST(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const body = await request.json();

        // Validate input
        const validatedData = roomSchema.parse(body);

        // Check if room number already exists
        const existingRoom = await prisma.room.findUnique({
            where: { roomNumber: validatedData.roomNumber },
        });

        if (existingRoom) {
            return NextResponse.json(
                { error: 'Room number already exists' },
                { status: 400 }
            );
        }

        // Create room with base rate
        const room = await prisma.room.create({
            data: {
                roomNumber: validatedData.roomNumber,
                type: validatedData.type,
                baseOccupancy: validatedData.baseOccupancy || 2,
                maxOccupancy: validatedData.maxOccupancy || 3,
                extraGuestCharge: validatedData.extraGuestCharge ? new Prisma.Decimal(validatedData.extraGuestCharge) : null,
                floor: validatedData.floor,
                size: validatedData.size,
                description: validatedData.description,
                amenities: JSON.stringify(validatedData.amenities),
                images: JSON.stringify(validatedData.images),
                status: 'AVAILABLE',
                rates: {
                    create: {
                        // Ensure Decimal fields are created with proper type
                        baseRate: new Prisma.Decimal(validatedData.baseRate),
                        effectiveFrom: new Date(),
                        rateType: 'BASE',
                        weekendMultiplier: new Prisma.Decimal('1.2'), // Default 20% weekend markup
                    },
                },
            },
            include: {
                rates: true,
            },
        });

        return NextResponse.json({ room }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Error creating room:', error);
        return NextResponse.json(
            { error: 'Failed to create room' },
            { status: 500 }
        );
    }
}
