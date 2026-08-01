import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { updateRoomStatusSchema } from '@/lib/validations/room';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';

// PATCH /api/admin/rooms/[id]/status - Update room status
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION', 'STAFF']);
        if (guard.error) return guard.error;

        const { id } = await params;
        const body = await request.json();

        // Validate input
        const validatedData = updateRoomStatusSchema.parse(body);

        // Check if room exists
        const room = await prisma.room.findUnique({
            where: { id },
        });

        if (!room) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            );
        }

        // Update room status
        const updatedRoom = await prisma.room.update({
            where: { id },
            data: {
                status: validatedData.status,
            },
        });

        return NextResponse.json({ room: updatedRoom }, { status: 200 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Error updating room status:', error);
        return NextResponse.json(
            { error: 'Failed to update room status' },
            { status: 500 }
        );
    }
}
