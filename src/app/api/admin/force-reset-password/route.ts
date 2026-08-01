import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const receptionEmail = process.env.RECEPTION_SEED_EMAIL || 'reception@Studio nexthotel.com';
        const receptionPassword = process.env.RECEPTION_SEED_PASSWORD || 'Studio nextstaff@123';

        const passwordHash = await bcrypt.hash(receptionPassword, 12);
        
        const user = await prisma.adminUser.update({
            where: { email: receptionEmail },
            data: { passwordHash }
        });

        return NextResponse.json({ 
            success: true, 
            message: `Password successfully forcefully updated for ${user.email} to match .env.local!` 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
