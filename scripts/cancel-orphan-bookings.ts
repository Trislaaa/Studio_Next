// Script: cancel-orphan-bookings.ts
// Run with: npx tsx scripts/cancel-orphan-bookings.ts
// Purpose: Cancel all PENDING bookings that have NO completed payment.
//          These are orphans created before the fake-booking fix was deployed.

import { prisma } from '../src/lib/db';

async function main() {
    const orphans = await prisma.booking.findMany({
        where: {
            status: 'PENDING',
        },
        include: {
            transaction: true,
            guest: { select: { fullName: true, email: true } },
        },
    });

    // Keep only those with no transaction or non-completed transaction
    const toCancel = orphans.filter(
        (b) => !b.transaction || b.transaction.status !== 'COMPLETED'
    );

    console.log(`\nFound ${orphans.length} PENDING bookings.`);
    console.log(`Orphans (no completed payment): ${toCancel.length}\n`);

    if (toCancel.length === 0) {
        console.log('✅ No orphan bookings to cancel. Database is clean.');
        return;
    }

    for (const b of toCancel) {
        console.log(
            ` - ${b.bookingReference}  |  ${b.guest?.fullName ?? 'Unknown'}  |  ` +
            `${b.checkIn.toISOString().split('T')[0]} → ${b.checkOut.toISOString().split('T')[0]}`
        );
    }

    console.log('\nCancelling...');
    const result = await prisma.booking.updateMany({
        where: {
            id: { in: toCancel.map((b) => b.id) },
        },
        data: { status: 'CANCELLED' },
    });

    console.log(`\n✅ Cancelled ${result.count} orphan PENDING booking(s).`);
    console.log('These were created without a completed payment and are now safely removed from active view.\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
