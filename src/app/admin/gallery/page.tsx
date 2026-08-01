'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

const GALLERY_CATEGORIES = ['Rooms', 'Dining', 'Pool', 'Lobby', 'Exterior', 'Views'] as const;
type GalleryCategory = typeof GALLERY_CATEGORIES[number];

type GalleryImageRow = {
    id: string;
    imageUrl: string;
    publicId: string;
    title: string | null;
    altText: string | null;
    category: GalleryCategory | null;
    isFeatured: boolean;
    sortOrder: number;
    createdAt: string;
};

// ─── Category colour map (for badges) ────────────────────────────────────────

const CATEGORY_COLOURS: Record<GalleryCategory, string> = {
    Rooms:    'bg-blue-100 text-blue-700 border-blue-200',
    Dining:   'bg-orange-100 text-orange-700 border-orange-200',
    Pool:     'bg-cyan-100 text-cyan-700 border-cyan-200',
    Lobby:    'bg-purple-100 text-purple-700 border-purple-200',
    Exterior: 'bg-green-100 text-green-700 border-green-200',
    Views:    'bg-amber-100 text-amber-700 border-amber-200',
};

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getFileKey(file: File) {
    return `${file.name}-${file.size}-${file.lastModified}`;
}

function toTitleFromFileName(fileName: string) {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    return nameWithoutExt.replace(/[-_]+/g, ' ').trim();
}

// ─── Category Dropdown ────────────────────────────────────────────────────────

function CategoryDropdown({
    value,
    onChange,
    disabled,
}: {
    value: GalleryCategory | null;
    onChange: (cat: GalleryCategory | null) => void;
    disabled?: boolean;
}) {
    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange((e.target.value as GalleryCategory) || null)}
            disabled={disabled}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50 cursor-pointer w-full"
        >
            <option value="">— No category —</option>
            {GALLERY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
            ))}
        </select>
    );
}

// ─── Image Card ───────────────────────────────────────────────────────────────

function ImageCard({
    image,
    onDelete,
    onCategoryChange,
    isDeleting,
    isSaving,
}: {
    image: GalleryImageRow;
    onDelete: () => void;
    onCategoryChange: (cat: GalleryCategory | null) => void;
    isDeleting: boolean;
    isSaving: boolean;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl border border-slate-200/70 shadow-sm overflow-hidden"
        >
            {/* Image */}
            <div className="relative aspect-[4/3] bg-slate-100">
                <Image
                    src={image.imageUrl}
                    alt={image.altText || image.title || 'Gallery image'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1280px) 50vw, 33vw"
                />
                {/* Sort order badge */}
                <div className="absolute top-2 left-2 bg-black/55 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide">
                    #{image.sortOrder + 1}
                </div>
                {/* Featured badge */}
                {image.isFeatured && (
                    <div className="absolute top-2 right-2 bg-amber-500/90 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Featured
                    </div>
                )}
                {/* Category chip overlay */}
                {image.category && (
                    <div className={`absolute bottom-2 left-2 text-[10px] font-semibold border px-2 py-0.5 rounded-full ${CATEGORY_COLOURS[image.category]}`}>
                        {image.category}
                    </div>
                )}
                {/* Saving spinner */}
                {isSaving && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {/* Meta */}
            <div className="p-3 space-y-2.5">
                <p className="text-sm font-semibold text-slate-800 line-clamp-1">
                    {image.title || 'Untitled Photo'}
                </p>
                <p className="text-xs text-slate-400">
                    Added {new Date(image.createdAt).toLocaleDateString('en-IN')}
                </p>

                {/* Category selector */}
                <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Category
                    </label>
                    <CategoryDropdown
                        value={image.category}
                        onChange={onCategoryChange}
                        disabled={isSaving || isDeleting}
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                    <p className="text-[10px] text-slate-300 truncate">{image.publicId}</p>
                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                        {isDeleting ? 'Removing…' : 'Remove'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminGalleryPage() {
    const [images, setImages] = useState<GalleryImageRow[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [commonTitle, setCommonTitle] = useState('');
    const [commonCategory, setCommonCategory] = useState<GalleryCategory | null>(null);
    const [filterCategory, setFilterCategory] = useState<GalleryCategory | 'All'>('All');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const totalSelectedSizeMb = useMemo(
        () => selectedFiles.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024),
        [selectedFiles]
    );

    const filteredImages = useMemo(() => {
        if (filterCategory === 'All') return images;
        return images.filter((img) => img.category === filterCategory);
    }, [images, filterCategory]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { All: images.length };
        for (const cat of GALLERY_CATEGORIES) {
            counts[cat] = images.filter((img) => img.category === cat).length;
        }
        return counts;
    }, [images]);

    const uncategorisedCount = images.filter((img) => !img.category).length;

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchImages = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/gallery');
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || 'Failed to fetch gallery images');
            }
            const payload = await res.json();
            setImages(payload.images || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch gallery images');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void fetchImages(); }, []);

    // ── File selection ─────────────────────────────────────────────────────────

    const appendFiles = (incoming: FileList | File[] | null) => {
        if (!incoming || incoming.length === 0) return;
        setMessage(null);
        setError(null);
        const files = Array.from(incoming);
        const rejected: string[] = [];

        setSelectedFiles((prev) => {
            const existingKeys = new Set(prev.map(getFileKey));
            const toAdd: File[] = [];
            for (const file of files) {
                const key = getFileKey(file);
                if (existingKeys.has(key)) { rejected.push(`${file.name} (already selected)`); continue; }
                if (!ACCEPTED_TYPES.has(file.type)) { rejected.push(`${file.name} (invalid format)`); continue; }
                if (file.size > MAX_FILE_SIZE) { rejected.push(`${file.name} (larger than 5MB)`); continue; }
                toAdd.push(file);
                existingKeys.add(key);
            }
            if (rejected.length > 0) setError(`Some files were skipped: ${rejected.slice(0, 4).join(', ')}${rejected.length > 4 ? '…' : ''}`);
            return [...prev, ...toAdd];
        });
    };

    // ── Upload ─────────────────────────────────────────────────────────────────

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;
        setUploading(true);
        setError(null);
        setMessage(null);

        try {
            const uploadedItems: Array<{ url: string; publicId: string; title?: string; altText?: string; category?: GalleryCategory }> = [];

            for (const file of selectedFiles) {
                const key = getFileKey(file);
                setUploadProgress((prev) => ({ ...prev, [key]: 0 }));

                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', 'gallery');

                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!uploadRes.ok) {
                    const p = await uploadRes.json().catch(() => ({}));
                    throw new Error(p.error || `Upload failed for ${file.name}`);
                }

                const { url, filename } = await uploadRes.json();
                const fallbackTitle = toTitleFromFileName(file.name);
                uploadedItems.push({
                    url,
                    publicId: filename,
                    title: commonTitle.trim() || fallbackTitle,
                    altText: fallbackTitle,
                    ...(commonCategory ? { category: commonCategory } : {}),
                });
                setUploadProgress((prev) => ({ ...prev, [key]: 100 }));
            }

            const saveRes = await fetch('/api/admin/gallery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: uploadedItems }),
            });

            if (!saveRes.ok) {
                const p = await saveRes.json().catch(() => ({}));
                throw new Error(p.error || 'Failed to save images to gallery');
            }

            setMessage(`${uploadedItems.length} photo${uploadedItems.length === 1 ? '' : 's'} uploaded successfully.`);
            setSelectedFiles([]);
            setUploadProgress({});
            setCommonTitle('');
            setCommonCategory(null);
            await fetchImages();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload photos');
        } finally {
            setUploading(false);
        }
    };

    // ── Category update ────────────────────────────────────────────────────────

    const handleCategoryChange = async (image: GalleryImageRow, category: GalleryCategory | null) => {
        setSavingId(image.id);
        setError(null);
        // Optimistically update UI
        setImages((prev) =>
            prev.map((img) => img.id === image.id ? { ...img, category } : img)
        );

        try {
            const res = await fetch(`/api/admin/gallery/${image.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category }),
            });
            if (!res.ok) {
                const p = await res.json().catch(() => ({}));
                throw new Error(p.error || 'Failed to update category');
            }
            setMessage(`Category updated to "${category ?? 'None'}" for "${image.title || 'photo'}".`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update category');
            // Rollback
            setImages((prev) =>
                prev.map((img) => img.id === image.id ? { ...img, category: image.category } : img)
            );
        } finally {
            setSavingId(null);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────

    const handleDelete = async (image: GalleryImageRow) => {
        if (!window.confirm('Remove this photo from gallery? This cannot be undone.')) return;
        setDeletingId(image.id);
        setError(null);
        setMessage(null);

        try {
            const cloudRes = await fetch(`/api/upload?filename=${encodeURIComponent(image.publicId)}`, { method: 'DELETE' });
            if (!cloudRes.ok) {
                const p = await cloudRes.json().catch(() => ({}));
                throw new Error(p.error || 'Failed to delete from Cloudinary');
            }

            const dbRes = await fetch(`/api/admin/gallery/${image.id}`, { method: 'DELETE' });
            if (!dbRes.ok) {
                const p = await dbRes.json().catch(() => ({}));
                throw new Error(p.error || 'Failed to remove from gallery');
            }

            setImages((prev) => prev.filter((row) => row.id !== image.id));
            setMessage('Photo removed from gallery.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete image');
        } finally {
            setDeletingId(null);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header row */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-slate-500">Upload and manage property gallery images. Tag each photo with a category so guests can filter them on the website.</p>
                    <p className="text-xs text-slate-400 mt-1">Allowed formats: JPEG, PNG, WebP · max 5 MB each</p>
                </div>
                <button
                    onClick={() => void fetchImages()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Alerts */}
            <AnimatePresence>
                {message && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {message}
                    </motion.div>
                )}
                {error && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload panel */}
            <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Upload New Photos</p>

                <div className="grid sm:grid-cols-3 gap-4">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Optional title (applied to all)</label>
                        <input
                            value={commonTitle}
                            onChange={(e) => setCommonTitle(e.target.value)}
                            placeholder="e.g. Monsoon Collection"
                            className="input-field w-full"
                            disabled={uploading}
                        />
                    </div>

                    {/* Category pre-assign */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Category (applied to all)</label>
                        <select
                            value={commonCategory ?? ''}
                            onChange={(e) => setCommonCategory((e.target.value as GalleryCategory) || null)}
                            disabled={uploading}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        >
                            <option value="">— No category —</option>
                            {GALLERY_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex items-end gap-3">
                        <button type="button" onClick={() => { setSelectedFiles([]); setUploadProgress({}); }} disabled={uploading || selectedFiles.length === 0} className="btn-secondary">
                            Clear
                        </button>
                        <button type="button" onClick={handleUpload} disabled={uploading || selectedFiles.length === 0} className="btn-primary">
                            {uploading ? 'Uploading…' : `Upload ${selectedFiles.length || ''} Photo${selectedFiles.length === 1 ? '' : 's'}`}
                        </button>
                    </div>
                </div>

                {/* Drop zone */}
                <div
                    onDrop={(e) => { e.preventDefault(); appendFiles(e.dataTransfer.files); }}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-7 text-center hover:border-teal-400 transition-colors"
                >
                    <input id="gallery-file-upload" type="file" multiple accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" disabled={uploading} onChange={(e) => appendFiles(e.target.files)} />
                    <label htmlFor="gallery-file-upload" className="cursor-pointer block">
                        <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 15a4 4 0 014-4h2m4 0h4a4 4 0 010 8h-3m-4-4l3-3m0 0l3 3m-3-3v12" />
                            </svg>
                        </div>
                        <p className="text-sm font-semibold text-slate-700">Drag & drop here, or click to select</p>
                        <p className="text-xs text-slate-500 mt-1">You can add multiple photos at once.</p>
                    </label>
                </div>

                {/* Queue */}
                {selectedFiles.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected ({selectedFiles.length}) · {totalSelectedSizeMb.toFixed(2)} MB</p>
                        </div>
                        <div className="max-h-44 overflow-auto space-y-2 pr-1">
                            {selectedFiles.map((file, idx) => {
                                const key = getFileKey(file);
                                const progress = uploadProgress[key] ?? 0;
                                return (
                                    <div key={key} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                                        <div className="flex items-center justify-between gap-3 text-sm">
                                            <p className="text-slate-700 truncate">{file.name}</p>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                <button type="button" onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))} disabled={uploading} className="text-red-400 hover:text-red-600" aria-label={`Remove ${file.name}`}>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                        {uploading && (
                                            <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Category filter bar */}
            {images.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    {(['All', ...GALLERY_CATEGORIES] as const).map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                filterCategory === cat
                                    ? 'bg-teal-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {cat}
                            <span className={`ml-1.5 text-[10px] ${filterCategory === cat ? 'text-teal-100' : 'text-slate-400'}`}>
                                {categoryCounts[cat] ?? 0}
                            </span>
                        </button>
                    ))}
                    {uncategorisedCount > 0 && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full font-medium">
                            ⚠ {uncategorisedCount} untagged
                        </span>
                    )}
                </div>
            )}

            {/* Grid */}
            {loading ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 animate-pulse">
                            <div className="aspect-[4/3] rounded-lg bg-slate-200" />
                            <div className="mt-3 h-3 bg-slate-200 rounded w-2/3" />
                            <div className="mt-2 h-2 bg-slate-100 rounded w-1/3" />
                        </div>
                    ))}
                </div>
            ) : filteredImages.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                    <p className="text-slate-700 font-medium">{images.length === 0 ? 'No gallery photos yet.' : `No photos tagged as "${filterCategory}".`}</p>
                    <p className="text-sm text-slate-500 mt-1">{images.length === 0 ? 'Upload your first set above.' : 'Tag photos below or change the filter.'}</p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredImages.map((image) => (
                        <ImageCard
                            key={image.id}
                            image={image}
                            onDelete={() => void handleDelete(image)}
                            onCategoryChange={(cat) => void handleCategoryChange(image, cat)}
                            isDeleting={deletingId === image.id}
                            isSaving={savingId === image.id}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
