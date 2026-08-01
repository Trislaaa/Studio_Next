// Test script to verify database connection
import { prisma } from './src/lib/db';

async function testConnection() {
    try {
        console.log('Testing database connection...');

        // Test query
        const count = await prisma.room.count();
        console.log('✅ Database connected successfully!');
        console.log(`Room count: ${count}`);

        // List tables
        const rooms = await prisma.room.findMany({ take: 5 });
        console.log(`Rooms found: ${rooms.length}`);

    } catch (error) {
        console.error('❌ Database connection failed:');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
