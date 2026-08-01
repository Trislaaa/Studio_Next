import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { config as loadDotenv } from 'dotenv';
import { requireAuth } from '@/lib/auth-guard';

let isCloudinaryConfigured = false;
let hasAttemptedLocalEnvHydration = false;

function hydrateEnvForLocalDev() {
    if (hasAttemptedLocalEnvHydration) {
        return;
    }

    hasAttemptedLocalEnvHydration = true;

    // In local development, this allows env changes to be picked up without
    // relying only on Next startup-time loading.
    if (process.env.NODE_ENV !== 'production') {
        loadDotenv({ path: '.env.local', override: false });
    }
}

function ensureCloudinaryConfigured(): { ok: true } | { ok: false; error: string } {
    if (isCloudinaryConfigured) {
        return { ok: true };
    }

    hydrateEnvForLocalDev();

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();

    if (cloudName && apiKey && apiSecret) {
        cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
            secure: true,
        });
        isCloudinaryConfigured = true;
        return { ok: true };
    }

    if (cloudinaryUrl) {
        // When CLOUDINARY_URL is present, the SDK reads credentials from process.env.
        cloudinary.config({ secure: true });
        isCloudinaryConfigured = true;
        return { ok: true };
    }

    const missingKeys: string[] = [];
    if (!cloudName) missingKeys.push('CLOUDINARY_CLOUD_NAME');
    if (!apiKey) missingKeys.push('CLOUDINARY_API_KEY');
    if (!apiSecret) missingKeys.push('CLOUDINARY_API_SECRET');

    const runtimeHint =
        process.env.VERCEL === '1'
            ? 'Add these in Vercel Project Settings -> Environment Variables, then redeploy.'
            : 'Set these in .env.local (or use CLOUDINARY_URL), then restart the Next.js server.';

    return {
        ok: false,
        error: `Cloudinary is not configured on server. Missing: ${missingKeys.join(', ') || 'unknown keys'}. ${runtimeHint}`,
    };
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
}

type CloudinaryUploadResult = {
    secure_url: string;
    public_id: string;
};

// POST /api/upload - Upload images (admin only)
export async function POST(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const cloudinarySetup = ensureCloudinaryConfigured();
        if (!cloudinarySetup.ok) {
            return NextResponse.json({ error: cloudinarySetup.error }, { status: 500 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const requestedFolder = (formData.get('folder') as string | null)?.toLowerCase() || 'rooms';

        const allowedFolders = new Set(['rooms', 'gallery', 'experiences']);
        if (!allowedFolders.has(requestedFolder)) {
            return NextResponse.json(
                { error: 'Invalid upload folder' },
                { status: 400 }
            );
        }

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
                { status: 400 }
            );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 5MB.' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload to Cloudinary using upload_stream
        const uploadResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `Studio next-hotel/${requestedFolder}`,
                    use_filename: true,
                    unique_filename: true,
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    if (!result?.secure_url || !result.public_id) {
                        reject(new Error('Cloudinary upload did not return required fields'));
                        return;
                    }

                    resolve({
                        secure_url: result.secure_url,
                        public_id: result.public_id,
                    });
                }
            );
            uploadStream.end(buffer);
        });

        return NextResponse.json(
            {
                success: true,
                url: uploadResult.secure_url,
                filename: uploadResult.public_id,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json(
            { error: `Failed to upload file to Cloudinary: ${getErrorMessage(error, 'Unknown error')}` },
            { status: 500 }
        );
    }
}

// Optional: DELETE endpoint to remove uploaded images
export async function DELETE(request: NextRequest) {
    try {
        const guard = await requireAuth(request, ['ADMIN', 'MANAGER']);
        if (guard.error) return guard.error;

        const cloudinarySetup = ensureCloudinaryConfigured();
        if (!cloudinarySetup.ok) {
            return NextResponse.json({ error: cloudinarySetup.error }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const publicId = searchParams.get('filename'); // We store public_id as filename

        if (!publicId) {
            return NextResponse.json(
                { error: 'No public ID provided' },
                { status: 400 }
            );
        }

        // Delete from Cloudinary
        const result = await cloudinary.uploader.destroy(publicId);

        if (result.result !== 'ok' && result.result !== 'not found') {
            throw new Error(`Cloudinary delete failed: ${result.result}`);
        }

        return NextResponse.json(
            { success: true, message: 'File deleted successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error deleting file:', error);
        return NextResponse.json(
            { error: `Failed to delete file from Cloudinary: ${getErrorMessage(error, 'Unknown error')}` },
            { status: 500 }
        );
    }
}
