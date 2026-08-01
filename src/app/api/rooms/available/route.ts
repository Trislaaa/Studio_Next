import { NextRequest, NextResponse } from 'next/server';
import { getAvailableRooms } from '@/lib/availability';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const checkIn = searchParams.get('checkIn');
        const checkOut = searchParams.get('checkOut');

        if (!checkIn || !checkOut) {
            return NextResponse.json(
                { error: 'Check-in and check-out dates are required' },
                { status: 400 }
            );
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        // Validate dates
        if (checkInDate >= checkOutDate) {
            return NextResponse.json(
                { error: 'Check-out date must be after check-in date' },
                { status: 400 }
            );
        }

        // Allow same-day check-in: compare against start of today (local server time)
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (checkInDate < startOfToday) {
            return NextResponse.json(
                { error: 'Check-in date cannot be before today' },
                { status: 400 }
            );
        }

        const availableRooms = await getAvailableRooms(checkInDate, checkOutDate);

        return NextResponse.json({
            success: true,
            data: availableRooms,
            count: availableRooms.length,
        });
    } catch (error) {
        console.error('Error fetching available rooms:', error);
        return NextResponse.json(
            { error: 'Failed to fetch available rooms' },
            { status: 500 }
        );
    }
}
