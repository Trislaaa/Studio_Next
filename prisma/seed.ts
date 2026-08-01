import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// Create a new pool just for seeding
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // NOTE: We no longer delete existing data to preserve rooms created via admin panel
    // If you need a fresh start, manually delete data from Supabase dashboard

    // Check if rooms already exist
    const existingRooms = await prisma.room.count();
    
    if (existingRooms > 0) {
        console.log(`ℹ️ Found ${existingRooms} existing rooms - skipping room creation`);
    } else {
        // Create sample rooms only if none exist
        console.log('🏨 Creating sample rooms...');
        const roomsData = [
            { roomNumber: '101', type: 'STANDARD', floor: 1, size: 250, baseOccupancy: 2, maxOccupancy: 2, baseRate: 2500 },
            { roomNumber: '102', type: 'STANDARD', floor: 1, size: 250, baseOccupancy: 2, maxOccupancy: 2, baseRate: 2500 },
            { roomNumber: '103', type: 'STANDARD', floor: 1, size: 250, baseOccupancy: 2, maxOccupancy: 3, baseRate: 2500, extraGuestCharge: 500 },
            { roomNumber: '201', type: 'DELUXE', floor: 2, size: 350, baseOccupancy: 2, maxOccupancy: 3, baseRate: 3500, extraGuestCharge: 700 },
            { roomNumber: '202', type: 'DELUXE', floor: 2, size: 350, baseOccupancy: 2, maxOccupancy: 3, baseRate: 3500, extraGuestCharge: 700 },
            { roomNumber: '203', type: 'DELUXE', floor: 2, size: 400, baseOccupancy: 2, maxOccupancy: 4, baseRate: 4000, extraGuestCharge: 800 },
            { roomNumber: '301', type: 'SUITE', floor: 3, size: 500, baseOccupancy: 2, maxOccupancy: 4, baseRate: 6000, extraGuestCharge: 1000 },
            { roomNumber: '302', type: 'SUITE', floor: 3, size: 550, baseOccupancy: 2, maxOccupancy: 4, baseRate: 6500, extraGuestCharge: 1000 },
            { roomNumber: '401', type: 'PREMIUM', floor: 4, size: 700, baseOccupancy: 2, maxOccupancy: 4, baseRate: 8500, extraGuestCharge: 1500 },
            { roomNumber: '402', type: 'PREMIUM', floor: 4, size: 800, baseOccupancy: 2, maxOccupancy: 5, baseRate: 10000, extraGuestCharge: 2000 },
        ];

        for (const roomData of roomsData) {
            const room = await prisma.room.create({
                data: {
                    roomNumber: roomData.roomNumber,
                    type: roomData.type as any,
                    floor: roomData.floor,
                    size: roomData.size,
                    baseOccupancy: roomData.baseOccupancy,
                    maxOccupancy: roomData.maxOccupancy,
                    extraGuestCharge: roomData.extraGuestCharge ?? null,
                    description: `${roomData.type.charAt(0) + roomData.type.slice(1).toLowerCase()} room on floor ${roomData.floor}`,
                    amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Room Service']),
                    images: JSON.stringify([]),
                    status: 'AVAILABLE',
                    rates: {
                        create: {
                            baseRate: roomData.baseRate,
                            effectiveFrom: new Date(),
                        },
                    },
                },
            });
            console.log(`  ✅ Created room ${room.roomNumber} (${room.type})`);
        }
        console.log(`✅ Created ${roomsData.length} sample rooms`);
    }

    // Create hotel configurations
    const configs = await Promise.all([
        prisma.hotelConfig.upsert({
            where: { key: 'hotel_name' },
            update: {},
            create: {
                key: 'hotel_name',
                value: 'STUDIO NEXT',
                description: 'Hotel display name',
            },
        }),
        prisma.hotelConfig.upsert({
            where: { key: 'check_in_time' },
            update: { value: '11:00' },
            create: {
                key: 'check_in_time',
                value: '11:00',
                description: 'Standard check-in time (11:00 AM)',
            },
        }),
        prisma.hotelConfig.upsert({
            where: { key: 'check_out_time' },
            update: { value: '10:00' },
            create: {
                key: 'check_out_time',
                value: '10:00',
                description: 'Standard check-out time (10:00 AM)',
            },
        }),
        prisma.hotelConfig.upsert({
            where: { key: 'tax_rate' },
            update: {},
            create: {
                key: 'tax_rate',
                value: '18',
                description: 'Tax rate percentage (GST)',
            },
        }),
    ]);

    console.log(`✅ Created ${configs.length} hotel configurations`);

    // ---------------------------------------------------------------------------
    // Create admin user from env vars (NEVER hardcode passwords)
    // ---------------------------------------------------------------------------
    const adminEmail = process.env.ADMIN_SEED_EMAIL ?? 'admin@Studio nexthotel.com';
    let adminPassword = process.env.ADMIN_SEED_PASSWORD;

    if (!adminPassword) {
        // Generate a random password and show it exactly once
        const { randomBytes } = await import('crypto');
        adminPassword = randomBytes(12).toString('base64url');
        console.warn('⚠️  ADMIN_SEED_PASSWORD not set. Generated a one-time password:');
        console.warn(`    📝 ${adminPassword}`);
        console.warn('    Save this password now — it will not be shown again.');
    }

    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const existingAdmin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });

    if (!existingAdmin) {
        const adminUser = await prisma.adminUser.create({
            data: {
                email: adminEmail,
                passwordHash: adminPasswordHash,
                fullName: 'Admin User',
                role: 'ADMIN',
            },
        });
        console.log(`✅ Created admin user: ${adminUser.email}`);
    } else {
        console.log(`ℹ️ Admin user already exists: ${existingAdmin.email}`);
    }

    const receptionEmail = process.env.RECEPTION_SEED_EMAIL ?? 'reception@Studio nexthotel.com';
    let receptionPassword = process.env.RECEPTION_SEED_PASSWORD;

    if (!receptionPassword) {
        const { randomBytes } = await import('crypto');
        receptionPassword = randomBytes(12).toString('base64url');
        console.warn('⚠️  RECEPTION_SEED_PASSWORD not set. Generated a one-time password:');
        console.warn(`    📝 ${receptionPassword}`);
        console.warn('    Save this password now — it will not be shown again.');
    }

    const receptionPasswordHash = await bcrypt.hash(receptionPassword, 12);
    const existingReception = await prisma.adminUser.findUnique({ where: { email: receptionEmail } });

    if (!existingReception) {
        const receptionUser = await prisma.adminUser.create({
            data: {
                email: receptionEmail,
                passwordHash: receptionPasswordHash,
                fullName: 'Reception Staff',
                role: 'RECEPTION',
            },
        });
        console.log(`✅ Created reception user: ${receptionUser.email}`);
    } else {
        console.log(`ℹ️ Reception user already exists: ${existingReception.email}`);
    }

    console.log('🎉 Seeding completed! Add rooms from the admin panel.');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
