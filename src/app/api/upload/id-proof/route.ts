import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { config as loadDotenv } from 'dotenv';

/**
 * Public endpoint for guests to upload their ID proof document image
 * during the booking flow. No admin auth required.
 *
 * Security:
 *  - Max file size: 5 MB
 *  - Allowed types: JPEG, PNG, WebP
 *  - Uploads go to a dedicated `Studio next-hotel/id-proofs` folder
 *  - Cloudinary access_mode is kept private (not publicly listable)
 */

let isCloudinaryConfigured = false;
let hasAttemptedLocalEnvHydration = false;

function hydrateEnvForLocalDev() {
    if (hasAttemptedLocalEnvHydration) return;
    hasAttemptedLocalEnvHydration = true;
    if (process.env.NODE_ENV !== 'production') {
        loadDotenv({ path: '.env.local', override: false });
    }
}

function ensureCloudinaryConfigured(): { ok: true } | { ok: false; error: string } {
    if (isCloudinaryConfigured) return { ok: true };
    hydrateEnvForLocalDev();

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();

    if (cloudName && apiKey && apiSecret) {
        cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
        isCloudinaryConfigured = true;
        return { ok: true };
    }
    if (cloudinaryUrl) {
        cloudinary.config({ secure: true });
        isCloudinaryConfigured = true;
        return { ok: true };
    }

    return {
        ok: false,
        error: 'Cloudinary is not configured. ID proof upload is unavailable.',
    };
}

type CloudinaryUploadResult = { secure_url: string; public_id: string };

export async function POST(request: NextRequest) {
    try {
        const setup = ensureCloudinaryConfigured();
        if (!setup.ok) {
            return NextResponse.json({ error: setup.error }, { status: 500 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
                { status: 400 }
            );
        }

        // Validate size (max 5 MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 5 MB.' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'Studio next-hotel/id-proofs',
                    use_filename: true,
                    unique_filename: true,
                    resource_type: 'image',
                },
                (error, result) => {
                    if (error) return reject(error);
                    if (!result?.secure_url || !result.public_id) {
                        return reject(new Error('Upload did not return required fields'));
                    }
                    resolve({ secure_url: result.secure_url, public_id: result.public_id });
                }
            );
            uploadStream.end(buffer);
        });

        return NextResponse.json(
            { success: true, url: uploadResult.secure_url, publicId: uploadResult.public_id },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error uploading ID proof:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Failed to upload ID proof: ${message}` },
            { status: 500 }
        );
    }
}
