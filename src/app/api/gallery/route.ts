import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/gallery - Public gallery photos for website visitors
// Supports optional ?category=Rooms|Dining|Pool|Lobby|Exterior|Views
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const category = searchParams.get('category');

        const images = await prisma.galleryImage.findMany({
            where: category ? { category } : undefined,
            orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
            select: {
                id: true,
                imageUrl: true,
                title: true,
                altText: true,
                category: true,
                isFeatured: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ success: true, images }, { status: 200 });
    } catch (error) {
        console.error('Error fetching public gallery images:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch gallery images' },
            { status: 500 }
        );
    }
}
