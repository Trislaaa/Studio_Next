import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function check() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not defined in .env.local');
    }
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const rooms = await prisma.room.findMany();
    console.log('--- Room Images ---');
    rooms.forEach(r => {
        console.log(`Room ${r.roomNumber}:`, r.images);
    });

    await prisma.$disconnect();
}

check().catch(console.error);
