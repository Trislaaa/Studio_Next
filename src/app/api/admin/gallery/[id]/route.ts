import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-guard';
import { GALLERY_CATEGORIES } from '../route';

const patchSchema = z.object({
    category: z.enum(GALLERY_CATEGORIES).nullable().optional(),
    isFeatured: z.boolean().optional(),
    title: z.string().trim().max(120).nullable().optional(),
});

// PATCH /api/admin/gallery/[id] — Update category / featured / title
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const { id } = await params;
        const body = await request.json();
        const validated = patchSchema.parse(body);

        const existing = await prisma.galleryImage.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: 'Gallery image not found' },
                { status: 404 }
            );
        }

        const updated = await prisma.galleryImage.update({
            where: { id },
            data: {
                ...(validated.category !== undefined && { category: validated.category }),
                ...(validated.isFeatured !== undefined && { isFeatured: validated.isFeatured }),
                ...(validated.title !== undefined && { title: validated.title }),
            },
        });

        return NextResponse.json({ success: true, image: updated }, { status: 200 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }
        console.error('Error updating gallery image:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update gallery image' },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/gallery/[id] — Remove gallery image record
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const { id } = await params;

        const existing = await prisma.galleryImage.findUnique({ where: { id } });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: 'Gallery image not found' },
                { status: 404 }
            );
        }

        await prisma.galleryImage.delete({ where: { id } });

        return NextResponse.json(
            {
                success: true,
                message: 'Gallery image deleted',
                publicId: existing.publicId,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error deleting gallery image:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete gallery image' },
            { status: 500 }
        );
    }
}
