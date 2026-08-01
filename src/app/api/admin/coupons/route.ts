import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { DiscountType } from '@prisma/client';

const couponSchema = z.object({
    code: z.string().min(3).toUpperCase(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z.number().positive(),
    validFrom: z.string(),
    validUntil: z.string(),
    maxUses: z.number().int().positive().nullable(),
    isActive: z.boolean().default(true),
});

// IST is UTC+5:30. Interpret a date string (YYYY-MM-DD or YYYY-MM-DDTHH:MM)
// as an IST date and return a UTC Date object.
// validFrom  → start of that day in IST: 00:00:00 IST
// validUntil → end   of that day in IST: 23:59:59 IST

function toISTStartOfDay(dateStr: string): Date {
    // Extract date part (YYYY-MM-DD) whether input is 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'
    const datePart = dateStr.split('T')[0];
    // 00:00:00 IST = 00:00:00+05:30 in RFC 3339
    return new Date(`${datePart}T00:00:00.000+05:30`);
}

function toISTEndOfDay(dateStr: string): Date {
    const datePart = dateStr.split('T')[0];
    // 23:59:59 IST = 23:59:59+05:30 = 18:29:59 UTC same day
    return new Date(`${datePart}T23:59:59.999+05:30`);
}

export async function GET() {
    try {
        const coupons = await prisma.coupon.findMany({
            orderBy: { createdAt: 'desc' },
        });

        // Convert Decimal to numbers for JSON serialization
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const serialized = coupons.map((c: any) => ({
            ...c,
            discountValue: c.discountValue.toNumber(),
        }));

        return NextResponse.json(serialized);
    } catch (error) {
        console.error('Failed to fetch coupons:', error);
        return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const data = couponSchema.parse(body);

        const existing = await prisma.coupon.findUnique({
            where: { code: data.code },
        });

        if (existing) {
            return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 });
        }

        const coupon = await prisma.coupon.create({
            data: {
                code: data.code,
                discountType: data.discountType as DiscountType,
                discountValue: data.discountValue,
                validFrom: toISTStartOfDay(data.validFrom),
                validUntil: toISTEndOfDay(data.validUntil),
                maxUses: data.maxUses,
                isActive: data.isActive,
            },
        });

        return NextResponse.json({
            ...coupon,
            discountValue: coupon.discountValue.toNumber(),
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
        }
        console.error('Failed to create coupon:', error);
        return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { id, isActive, validFrom, validUntil, discountType, discountValue, maxUses, code } = z
            .object({
                id: z.string(),
                isActive: z.boolean().optional(),
                validFrom: z.string().optional(),
                validUntil: z.string().optional(),
                discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
                discountValue: z.number().positive().optional(),
                maxUses: z.number().int().positive().nullable().optional(),
                code: z.string().min(3).toUpperCase().optional(),
            })
            .parse(body);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dataToUpdate: any = {};
        if (isActive !== undefined) dataToUpdate.isActive = isActive;
        if (validFrom !== undefined) dataToUpdate.validFrom = toISTStartOfDay(validFrom);
        if (validUntil !== undefined) dataToUpdate.validUntil = toISTEndOfDay(validUntil);
        if (discountType !== undefined) dataToUpdate.discountType = discountType as DiscountType;
        if (discountValue !== undefined) dataToUpdate.discountValue = discountValue;
        if (maxUses !== undefined) dataToUpdate.maxUses = maxUses;
        if (code !== undefined) {
            // Ensure code uniqueness on rename
            const conflict = await prisma.coupon.findFirst({
                where: { code, NOT: { id } },
            });
            if (conflict) {
                return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 });
            }
            dataToUpdate.code = code;
        }

        const coupon = await prisma.coupon.update({
            where: { id },
            data: dataToUpdate,
        });

        return NextResponse.json({
            ...coupon,
            discountValue: coupon.discountValue.toNumber(),
        });
    } catch (error) {
        console.error('Failed to update coupon:', error);
        return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 });
    }
}
