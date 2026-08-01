import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { code } = await request.json();

        if (!code) {
            return NextResponse.json(
                { error: 'Coupon code is required' },
                { status: 400 }
            );
        }

        const coupon = await prisma.coupon.findUnique({
            where: { code: code.toUpperCase() },
        });

        if (!coupon) {
            return NextResponse.json(
                { error: 'Invalid coupon code' },
                { status: 404 }
            );
        }

        if (!coupon.isActive) {
            return NextResponse.json(
                { error: 'This coupon is no longer active' },
                { status: 400 }
            );
        }

        const now = new Date();
        if (now < coupon.validFrom) {
            return NextResponse.json(
                { error: 'This coupon is not valid yet' },
                { status: 400 }
            );
        }

        if (now > coupon.validUntil) {
            return NextResponse.json(
                { error: 'This coupon has expired' },
                { status: 400 }
            );
        }

        if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
            return NextResponse.json(
                { error: 'This coupon has reached its usage limit' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            valid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: parseFloat(coupon.discountValue.toString()),
            },
        });
    } catch (error) {
        console.error('Coupon validation error:', error);
        return NextResponse.json(
            { error: 'Internal server error while validating coupon' },
            { status: 500 }
        );
    }
}
