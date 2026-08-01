import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

// GET /api/admin/dashboard/stats - Get real-time dashboard statistics
export async function GET(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER', 'RECEPTION']);
        if (guard.error) return guard.error;

        const now = new Date();
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        
        // Calculate IST components for calendar arithmetic
        const nowIST = new Date(now.getTime() + istOffsetMs);
        const y = nowIST.getUTCFullYear();
        const m = nowIST.getUTCMonth();
        const d = nowIST.getUTCDate();

        // General Server-local month metrics (less sensitive to day boundaries)
        const startOfMonth = new Date(Date.UTC(y, m, 1));
        const startOfLastMonth = new Date(Date.UTC(y, m - 1, 1));
        const endOfLastMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

        // Exact strict bounds for "Today"
        const startOfTodayIST = new Date(Date.UTC(y, m, d));
        const endOfTodayIST = new Date(Date.UTC(y, m, d + 1));
        const endOfToday = endOfTodayIST;

        // Get all bookings for calculations
        const [
            totalRooms,
            roomsByStatus,
            monthlyBookings,
            lastMonthBookings,
            todayCheckIns,
            todayCheckOuts,
            pendingBookings,
            currentMonthCollections,
            lastMonthCollections,
            currentMonthRefunds,
            lastMonthRefunds,
            recentBookings,
            totalGuests,
            upcomingCheckIns,
            overdueCheckouts,
        ] = await Promise.all([
            // Total rooms count
            prisma.room.count(),

            // Rooms grouped by status
            prisma.room.groupBy({
                by: ['status'],
                _count: { id: true },
            }),

            // Total bookings this month
            prisma.booking.count({
                where: {
                    createdAt: { gte: startOfMonth },
                },
            }),

            // Last month bookings for comparison
            prisma.booking.count({
                where: {
                    createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
                },
            }),

        // Today's check-ins
        prisma.booking.findMany({
            where: {
                checkIn: { gte: startOfTodayIST, lt: endOfTodayIST },
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
            include: { guest: true, rooms: { include: { room: true } } },
        }),

        // Today's check-outs
        prisma.booking.findMany({
            where: {
                checkOut: { gte: startOfTodayIST, lt: endOfTodayIST },
                status: 'CHECKED_IN',
            },
            include: { guest: true, rooms: { include: { room: true } } },
        }),

            // Pending bookings requiring action
            prisma.booking.count({
                where: { status: 'PENDING' },
            }),

            // Net revenue (cash retained) this month = payments collected - refunds processed
            prisma.transaction.aggregate({
                where: {
                    createdAt: { gte: startOfMonth, lt: endOfToday },
                    status: { in: ['COMPLETED', 'REFUNDED'] },
                },
                _sum: { amount: true },
            }),

            prisma.transaction.aggregate({
                where: {
                    createdAt: { gte: startOfLastMonth, lt: startOfMonth },
                    status: { in: ['COMPLETED', 'REFUNDED'] },
                },
                _sum: { amount: true },
            }),

            prisma.transaction.aggregate({
                where: {
                    refundedAt: { gte: startOfMonth, lt: endOfToday },
                    refundAmount: { gt: 0 },
                },
                _sum: { refundAmount: true },
            }),

            prisma.transaction.aggregate({
                where: {
                    refundedAt: { gte: startOfLastMonth, lt: startOfMonth },
                    refundAmount: { gt: 0 },
                },
                _sum: { refundAmount: true },
            }),

            // Recent 5 bookings
            prisma.booking.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { guest: true, rooms: { include: { room: true } } },
            }),

            // Total guests
            prisma.guest.count(),

            // Upcoming check-ins (next 7 days)
            prisma.booking.count({
                where: {
                    checkIn: {
                        gte: startOfTodayIST,
                        lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                    },
                    status: { in: ['CONFIRMED', 'PENDING'] },
                },
            }),

            // Overdue checkouts: CHECKED_IN with checkOut before today IST
            prisma.booking.count({
                where: {
                    status: 'CHECKED_IN',
                    checkOut: { lt: startOfTodayIST },
                },
            }),
        ]);

        // Calculate room status breakdown
        const roomStatus = {
            available: 0,
            occupied: 0,
            maintenance: 0,
            blocked: 0,
        };
        roomsByStatus.forEach((r) => {
            const status = r.status.toLowerCase();
            if (status === 'available') roomStatus.available = r._count.id;
            else if (status === 'occupied') roomStatus.occupied = r._count.id;
            else if (status === 'maintenance') roomStatus.maintenance = r._count.id;
            else if (status === 'blocked') roomStatus.blocked = r._count.id;
        });

        // Calculate occupancy rate
        const occupancyRate = totalRooms > 0
            ? Math.round((roomStatus.occupied / totalRooms) * 100)
            : 0;

        // Calculate month-over-month changes
        const currentCollected = currentMonthCollections._sum.amount?.toNumber() || 0;
        const currentRefunded = currentMonthRefunds._sum.refundAmount?.toNumber() || 0;
        const prevCollected = lastMonthCollections._sum.amount?.toNumber() || 0;
        const prevRefunded = lastMonthRefunds._sum.refundAmount?.toNumber() || 0;

        const currentRevenue = Math.round((currentCollected - currentRefunded) * 100) / 100;
        const prevRevenue = Math.round((prevCollected - prevRefunded) * 100) / 100;
        const revenueChange = prevRevenue > 0
            ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100)
            : 0;

        const bookingsChange = lastMonthBookings > 0
            ? Math.round(((monthlyBookings - lastMonthBookings) / lastMonthBookings) * 100)
            : 0;

        // Format recent bookings
        const formattedBookings = recentBookings.map((booking) => ({
            id: booking.bookingReference,
            guestName: booking.guest.fullName,
            room: booking.rooms[0]?.room.roomNumber ?? 'N/A',
            roomType: booking.rooms[0]?.room.type ?? 'N/A',
            checkIn: booking.checkIn.toISOString().split('T')[0],
            checkOut: booking.checkOut.toISOString().split('T')[0],
            status: booking.status,
            amount: booking.totalAmount.toNumber(),
        }));

        // Format today's check-ins/outs
        const formattedCheckIns = todayCheckIns.map((b) => ({
            id: b.bookingReference,
            guestName: b.guest.fullName,
            room: b.rooms[0]?.room.roomNumber ?? 'N/A',
            status: b.status,
        }));

        const formattedCheckOuts = todayCheckOuts.map((b) => ({
            id: b.bookingReference,
            guestName: b.guest.fullName,
            room: b.rooms[0]?.room.roomNumber ?? 'N/A',
        }));

        const stats = {
            // Core metrics
            totalBookings: monthlyBookings,
            bookingsChange,
            todayCheckIns: todayCheckIns.length,
            todayCheckOuts: todayCheckOuts.length,
            occupancyRate,
            revenue: currentRevenue,
            revenueChange,
            
            // Room breakdown
            totalRooms,
            roomStatus,
            
            // Additional metrics
            pendingBookings,
            totalGuests,
            upcomingCheckIns,
            overdueCheckouts,
            
            // Lists
            recentBookings: formattedBookings,
            todayCheckInsList: formattedCheckIns,
            todayCheckOutsList: formattedCheckOuts,
        };

        return NextResponse.json({ stats }, { status: 200 });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard statistics' },
            { status: 500 }
        );
    }
}
