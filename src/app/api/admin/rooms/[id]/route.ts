import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { updateRoomSchema } from '@/lib/validations/room';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';

// GET /api/admin/rooms/[id] - Fetch a single room
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const { id } = await params;

        const room = await prisma.room.findUnique({
            where: { id },
            include: {
                rates: {
                    orderBy: { effectiveFrom: 'desc' },
                },
            },
        });

        if (!room) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            );
        }

        // Parse JSON fields
        const parsedRoom = {
            ...room,
            amenities: typeof room.amenities === 'string' ? JSON.parse(room.amenities) : room.amenities,
            images: typeof room.images === 'string' ? JSON.parse(room.images) : room.images,
        };

        return NextResponse.json({ room: parsedRoom }, { status: 200 });
    } catch (error) {
        console.error('Error fetching room:', error);
        return NextResponse.json(
            { error: 'Failed to fetch room' },
            { status: 500 }
        );
    }
}

// PUT /api/admin/rooms/[id] - Update room details
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const { id } = await params;
        const body = await request.json();

        // Validate input
        const validatedData = updateRoomSchema.parse(body);

        // Check if room exists
        const existingRoom = await prisma.room.findUnique({
            where: { id },
        });

        if (!existingRoom) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            );
        }

        // If room number is being changed, check for conflicts
        if (validatedData.roomNumber && validatedData.roomNumber !== existingRoom.roomNumber) {
            const roomNumberConflict = await prisma.room.findUnique({
                where: { roomNumber: validatedData.roomNumber },
            });

            if (roomNumberConflict) {
                return NextResponse.json(
                    { error: 'Room number already exists' },
                    { status: 400 }
                );
            }
        }

        // Update room
        const updatedRoom = await prisma.room.update({
            where: { id },
            data: {
                ...(validatedData.roomNumber && { roomNumber: validatedData.roomNumber }),
                ...(validatedData.type && { type: validatedData.type }),
                ...(validatedData.baseOccupancy !== undefined && { baseOccupancy: validatedData.baseOccupancy }),
                ...(validatedData.maxOccupancy !== undefined && { maxOccupancy: validatedData.maxOccupancy }),
                ...(validatedData.extraGuestCharge !== undefined && { 
                    extraGuestCharge: validatedData.extraGuestCharge ? new Prisma.Decimal(validatedData.extraGuestCharge) : null 
                }),
                ...(validatedData.floor !== undefined && { floor: validatedData.floor }),
                ...(validatedData.size && { size: validatedData.size }),
                ...(validatedData.description && { description: validatedData.description }),
                ...(validatedData.amenities && { amenities: JSON.stringify(validatedData.amenities) }),
                ...(validatedData.images && { images: JSON.stringify(validatedData.images) }),
            },
            include: {
                rates: true,
            },
        });

        // If baseRate is provided, create a new rate record
        if (validatedData.baseRate) {
            await prisma.roomRate.create({
                data: {
                    roomId: id,
                    baseRate: new Prisma.Decimal(validatedData.baseRate),
                    effectiveFrom: new Date(),
                    rateType: 'BASE',
                    weekendMultiplier: new Prisma.Decimal('1.2'),
                },
            });
        }

        return NextResponse.json({ room: updatedRoom }, { status: 200 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Error updating room:', error);
        return NextResponse.json(
            { error: 'Failed to update room' },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/rooms/[id] - Delete a room
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const { id } = await params;

        // Check if room exists
        const room = await prisma.room.findUnique({ where: { id } });

        if (!room) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            );
        }

        // Prevent deletion if there are active bookings (via join table)
        const activeBookingCount = await prisma.bookingRoom.count({
            where: {
                roomId: id,
                booking: {
                    status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
                },
            },
        });

        if (!room) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            );
        }

        // Prevent deletion if there are active bookings
        if (activeBookingCount > 0) {
            return NextResponse.json(
                { error: 'Cannot delete room with active bookings' },
                { status: 400 }
            );
        }

        // Delete the room (cascade will delete rates)
        await prisma.room.delete({
            where: { id },
        });

        return NextResponse.json(
            { message: 'Room deleted successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error deleting room:', error);
        return NextResponse.json(
            { error: 'Failed to delete room' },
            { status: 500 }
        );
    }
}
