import { prisma } from './src/lib/db';

async function main() {
    const bookings = await prisma.booking.findMany({
        select: { id: true, checkIn: true, checkOut: true, status: true, rooms: { select: { roomId: true } } }
    });
    console.log("All bookings:", JSON.stringify(bookings, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
