import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';

export const GALLERY_CATEGORIES = ['Rooms', 'Dining', 'Pool', 'Lobby', 'Exterior', 'Views'] as const;
export type GalleryCategory = typeof GALLERY_CATEGORIES[number];

const galleryUploadSchema = z.object({
    images: z
        .array(
            z.object({
                url: z.string().url(),
                publicId: z.string().min(1),
                title: z.string().trim().max(120).optional(),
                altText: z.string().trim().max(180).optional(),
                category: z.enum(GALLERY_CATEGORIES).optional(),
                isFeatured: z.boolean().optional(),
            })
        )
        .min(1)
        .max(50),
});

// GET /api/admin/gallery - List all gallery images (admin/manager)
export async function GET(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const images = await prisma.galleryImage.findMany({
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });

        return NextResponse.json({ success: true, images }, { status: 200 });
    } catch (error) {
        console.error('Error fetching admin gallery images:', error);
        return NextResponse.json(
            {
                success: false,
                error:
                    process.env.NODE_ENV === 'production'
                        ? 'Failed to fetch gallery images'
                        : `Failed to fetch gallery images: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            { status: 500 }
        );
    }
}

// POST /api/admin/gallery - Save multiple uploaded images
export async function POST(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const body = await request.json();
        const validated = galleryUploadSchema.parse(body);

        const publicIds = validated.images.map((image) => image.publicId);

        const existing = await prisma.galleryImage.findMany({
            where: { publicId: { in: publicIds } },
            select: { publicId: true },
        });

        const existingSet = new Set(existing.map((row: { publicId: string }) => row.publicId));
        const imagesToCreate = validated.images.filter((image) => !existingSet.has(image.publicId));

        if (imagesToCreate.length === 0) {
            return NextResponse.json(
                { success: false, error: 'All selected photos already exist in gallery' },
                { status: 409 }
            );
        }

        const maxOrder = await prisma.galleryImage.aggregate({
            _max: { sortOrder: true },
        });

        const startOrder = (maxOrder._max.sortOrder ?? -1) + 1;

        const createdImages = await prisma.$transaction(
            imagesToCreate.map((image, index) =>
                prisma.galleryImage.create({
                    data: {
                        imageUrl: image.url,
                        publicId: image.publicId,
                        title: image.title?.trim() || null,
                        altText: image.altText?.trim() || null,
                        category: image.category ?? null,
                        isFeatured: image.isFeatured ?? false,
                        sortOrder: startOrder + index,
                    },
                })
            )
        );

        return NextResponse.json(
            {
                success: true,
                createdCount: createdImages.length,
                images: createdImages,
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Error creating gallery images:', error);
        return NextResponse.json(
            {
                success: false,
                error:
                    process.env.NODE_ENV === 'production'
                        ? 'Failed to save gallery images'
                        : `Failed to save gallery images: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            { status: 500 }
        );
    }
}
