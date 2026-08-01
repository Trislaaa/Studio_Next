'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type PublicGalleryImage = {
    id: string;
    imageUrl: string;
    title: string | null;
    altText: string | null;
    category: string | null;
    isFeatured: boolean;
    createdAt: string;
};

type GalleryTile = PublicGalleryImage & { idx: number };

// ─── Category Filters ─────────────────────────────────────────────────────────

const FILTERS = ['All', 'Rooms', 'Dining', 'Pool', 'Lobby', 'Exterior', 'Views'] as const;
type Filter = typeof FILTERS[number];

// ─── Aspect Ratio Cycle ───────────────────────────────────────────────────────

const ASPECT_CLASSES = [
    'aspect-[4/3]',
    'aspect-[3/4]',
    'aspect-[16/10]',
    'aspect-[4/3]',
    'aspect-[3/4]',
    'aspect-[4/3]',
] as const;

function getAspectClass(idx: number) {
    return ASPECT_CLASSES[idx % ASPECT_CLASSES.length];
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function GallerySkeletons() {
    return (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
            {Array.from({ length: 9 }).map((_, i) => (
                <div
                    key={i}
                    className={`w-full break-inside-avoid rounded-2xl bg-[#e8e0d4] animate-pulse mb-5 ${ASPECT_CLASSES[i % ASPECT_CLASSES.length]}`}
                />
            ))}
        </div>
    );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

const shuffleVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? '40%' : '-40%',
        scale: 0.9,
        rotateY: direction > 0 ? 10 : -10,
        opacity: 0,
        zIndex: 2,
    }),
    center: {
        x: 0,
        scale: 1,
        rotateY: 0,
        opacity: 1,
        zIndex: 1,
    },
    exit: (direction: number) => ({
        x: direction > 0 ? '-40%' : '40%',
        scale: 0.9,
        rotateY: direction > 0 ? -10 : 10,
        opacity: 0,
        zIndex: 0,
    }),
};

function Lightbox({
    image,
    images,
    onClose,
    onNavigate,
}: {
    image: PublicGalleryImage;
    images: PublicGalleryImage[];
    onClose: () => void;
    onNavigate: (dir: 1 | -1) => void;
}) {
    const idx = images.findIndex(i => i.id === image.id);
    const [direction, setDirection] = useState(0);
    const wheelTimeout = useRef<NodeJS.Timeout | null>(null);

    const handleNav = useCallback((dir: 1 | -1) => {
        setDirection(dir);
        onNavigate(dir);
    }, [onNavigate]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') handleNav(1);
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') handleNav(-1);
        };

        const handleWheel = (e: WheelEvent) => {
            if (wheelTimeout.current) return;
            
            // Use whichever scroll direction is dominant (horizontal swipe vs vertical scroll)
            const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
            const delta = isHorizontal ? e.deltaX : e.deltaY;
            
            // Lower threshold to 15 for better trackpad support
            if (delta > 15) {
                if (idx < images.length - 1) handleNav(1);
                wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null }, 600);
            } else if (delta < -15) {
                if (idx > 0) handleNav(-1);
                wheelTimeout.current = setTimeout(() => { wheelTimeout.current = null }, 600);
            }
        };

        window.addEventListener('keydown', handleKey);
        window.addEventListener('wheel', handleWheel, { passive: true });
        
        return () => {
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('wheel', handleWheel);
            if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
        };
    }, [idx, images.length, onClose, handleNav]);

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center perspective-[1200px]"
            style={{ background: 'rgba(20,25,22,0.92)', backdropFilter: 'blur(16px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
        >
            {/* Prev */}
            {idx > 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); handleNav(-1); }}
                    className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 border border-white/20"
                    aria-label="Previous photo"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            {/* Next */}
            {idx < images.length - 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); handleNav(1); }}
                    className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 border border-white/20"
                    aria-label="Next photo"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Close */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 sm:top-8 sm:right-8 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 border border-white/20"
                aria-label="Close"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Main panel container for 3D presence */}
            <div className="relative w-full max-w-5xl mx-4 sm:mx-16 aspect-[16/10] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={image.id}
                        custom={direction}
                        variants={shuffleVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ 
                            x: { type: "spring", stiffness: 200, damping: 25 },
                            scale: { duration: 0.4 },
                            rotateY: { type: "spring", stiffness: 200, damping: 25 },
                            opacity: { duration: 0.3 }
                        }}
                        className="absolute inset-0 w-full h-full"
                        style={{ transformOrigin: "center center" }}
                    >
                        {/* Image */}
                        <Image
                            src={image.imageUrl}
                            alt={image.altText || image.title || 'Studio next gallery'}
                            fill
                            sizes="95vw"
                            className="object-contain"
                            priority
                        />
                        {/* Photo counter */}
                        <span className="absolute bottom-4 right-4 text-xs font-medium text-white bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full tabular-nums border border-white/10">
                            {idx + 1} / {images.length}
                        </span>
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// ─── Gallery Card ──────────────────────────────────────────────────────────────

function GalleryCard({ image, onOpen }: { image: GalleryTile; onOpen: () => void }) {
    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 60, scale: 0.9, rotateZ: image.idx % 2 === 0 ? -1 : 1 }}
            whileInView={{ opacity: 1, y: 0, scale: 1, rotateZ: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ 
                duration: 0.8, 
                delay: (image.idx % 3) * 0.1, 
                ease: [0.16, 1, 0.3, 1] 
            }}
            onClick={onOpen}
            className={`
                group relative w-full break-inside-avoid block mb-3 overflow-hidden rounded-md
                bg-[#e8e0d4] shadow-[0_4px_20px_-4px_rgba(62,54,46,0.15)]
                hover:shadow-[0_12px_40px_-8px_rgba(62,54,46,0.3)] hover:-translate-y-1
                border border-[#d8cfc5] hover:border-[#b5a294]
                transition-all duration-500 cursor-zoom-in
                ${getAspectClass(image.idx)}
            `}
            aria-label={`View ${image.title || 'photo'}`}
        >
            <Image
                src={image.imageUrl}
                alt={image.altText || image.title || 'Studio next photo'}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />

            {/* Hover overlay — subtle dark gradient for contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

            {/* Featured badge */}
            {image.isFeatured && (
                <span className="absolute top-3 left-3 bg-[#d29d42] text-white text-[9px] tracking-[0.2em] uppercase font-bold px-2.5 py-1 rounded-full shadow-sm">
                    Featured
                </span>
            )}

            {/* Zoom icon */}
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 shadow-sm">
                <svg className="w-4 h-4 text-[#1e2f27]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z" />
                </svg>
            </div>
        </motion.button>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GalleryPage() {
    const [images, setImages] = useState<PublicGalleryImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<PublicGalleryImage | null>(null);
    const [activeFilter, setActiveFilter] = useState<Filter>('All');
    
    // Scroll progress for hero parallax
    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 500], ['0%', '30%']);
    const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);

    useEffect(() => {
        const loadGallery = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/gallery');
                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(payload.error || 'Failed to fetch gallery photos');
                }
                const payload = await res.json();
                setImages(payload.images || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load gallery');
            } finally {
                setLoading(false);
            }
        };
        void loadGallery();
    }, []);

    // Filtered + indexed tiles
    const filteredTiles = useMemo<GalleryTile[]>(() => {
        const filtered = activeFilter === 'All'
            ? images
            : images.filter((img) => img.category === activeFilter);
        return filtered.map((img, idx) => ({ ...img, idx }));
    }, [images, activeFilter]);

    // Navigate lightbox
    const handleNavigate = (dir: 1 | -1) => {
        if (!selected) return;
        const idx = filteredTiles.findIndex(i => i.id === selected.id);
        const next = filteredTiles[idx + dir];
        if (next) setSelected(next);
    };

    const featuredCount = images.filter(i => i.isFeatured).length;

    return (
        <main className="min-h-screen bg-[#faf7f2] text-[#1e2f27] overflow-x-hidden relative">

            {/* ── Hero Banner ───────────────────────────────────────────────── */}
            <div className="relative min-h-[50vh] sm:min-h-[55vh] flex flex-col overflow-hidden mb-12">
                <motion.div style={{ y: heroY, scale: 1.05 }} className="absolute inset-0 z-0 origin-top">
                    <Image
                        src="https://res.cloudinary.com/dgzbvmxlv/image/upload/Studio next-hotel/gallery/file_h0ajov.jpg"
                        alt="Gallery Background"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#1e2f27]/80 via-[#1e2f27]/40 to-transparent"></div>
                </motion.div>

                {/* ── Header (Overlaid) ─────────────────────────────────────── */}
                <header className="relative z-10 w-full px-5 sm:px-8 lg:px-16 py-5 sm:py-8 flex justify-between items-center text-white">
                    <Link href="/" className="group flex items-center gap-3">
                        <div className="flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                            <img src="/logo.png" alt="Studio next Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg sm:text-xl md:text-2xl font-serif tracking-wide text-white">Studio next</span>
                            <span className="text-[#d29d42] text-[7px] sm:text-[8px] tracking-[0.3em] font-medium uppercase mt-1">THE HEART OF THE HILLS</span>
                        </div>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="hidden sm:inline-flex items-center gap-1.5 text-xs tracking-[0.2em] uppercase text-white hover:text-[#d29d42] font-semibold transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Home
                        </Link>
                        <Link
                            href="/book"
                            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-[#1e2f27] text-white rounded-sm text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-[#2c4036] transition-colors border border-transparent hover:border-[#d29d42]/30"
                        >
                            Book Now
                        </Link>
                    </div>
                </header>

                {/* ── Hero Content ──────────────────────────────────────────── */}
                <motion.div style={{ opacity: heroOpacity, y: useTransform(scrollY, [0, 300], [0, 50]) }} className="px-5 sm:px-8 text-center relative z-10 flex-1 flex flex-col items-center justify-center pt-6 pb-20 sm:pb-24 text-white">
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-3 sm:mb-4 uppercase"
                    >
                        Signature Collection
                    </motion.p>
                    <motion.h1
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.65, delay: 0.06 }}
                        className="text-3xl sm:text-5xl md:text-6xl font-serif mb-4 sm:mb-6 leading-tight"
                    >
                        The <span className="italic text-[#d29d42]">Studio next</span> Gallery
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.65, delay: 0.14 }}
                        className="text-white/90 text-sm sm:text-base md:text-lg font-light max-w-xl mx-auto leading-relaxed"
                    >
                        Explore every corner of our mountain retreat through our curated visual collection. Click any photo to view it in full.
                    </motion.p>

                    {/* Stats */}
                    {!loading && images.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-center gap-6 mt-8 justify-center"
                        >
                            <div className="text-center">
                                <p className="text-2xl font-serif">{images.length}</p>
                                <p className="text-[10px] tracking-[0.2em] uppercase text-white/70 mt-1">Photos</p>
                            </div>
                            <div className="w-px h-8 bg-white/20" />
                            {featuredCount > 0 && (
                                <>
                                    <div className="text-center">
                                        <p className="text-2xl font-serif text-[#d29d42]">{featuredCount}</p>
                                        <p className="text-[10px] tracking-[0.2em] uppercase text-white/70 mt-1">Featured</p>
                                    </div>
                                    <div className="w-px h-8 bg-white/20" />
                                </>
                            )}
                            <div className="text-center">
                                <p className="text-2xl font-serif">HD</p>
                                <p className="text-[10px] tracking-[0.2em] uppercase text-white/70 mt-1">Quality</p>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </div>

            {/* ── Filters ───────────────────────────────────────────────── */}
            {!loading && images.length > 0 && (
                <section className="w-full px-8 sm:px-12 lg:px-24 pb-8">
                    <div className="flex items-center gap-2 flex-wrap">
                        {FILTERS.map((f) => {
                            const count = f === 'All'
                                ? images.length
                                : images.filter((img) => img.category === f).length;
                            if (f !== 'All' && count === 0) return null;
                            return (
                                <button
                                    key={f}
                                    onClick={() => setActiveFilter(f)}
                                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs tracking-[0.16em] uppercase font-semibold transition-all duration-200 ${
                                        activeFilter === f
                                            ? 'bg-[#1e2f27] text-white shadow-md'
                                            : 'bg-[#ede8e0] text-[#5f7068] hover:bg-[#ddd5c9] hover:text-[#1e2f27]'
                                    }`}
                                >
                                    {f}
                                    <span className={`text-[9px] font-bold tabular-nums ${activeFilter === f ? 'text-white/70' : 'text-[#8a9e92]'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-4 h-px bg-gradient-to-r from-[#d8cfc5] via-[#e7ddcf] to-transparent" />
                </section>
            )}


            {/* ── Gallery Grid ──────────────────────────────────────────── */}
            <section className="w-full px-8 sm:px-12 lg:px-24 pb-24 sm:pb-32">
                {loading ? (
                    <GallerySkeletons />
                ) : error ? (
                    <div className="border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 flex items-center gap-3">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {error}
                    </div>
                ) : images.length === 0 ? (
                    <div className="border border-[#e7ddcf] bg-white p-14 text-center max-w-lg mx-auto">
                        <div className="w-16 h-16 bg-[#f0ebe3] border border-[#e0d5c5] flex items-center justify-center mx-auto mb-5">
                            <svg className="w-8 h-8 text-[#b5a294]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-[#1e2f27] text-lg font-serif mb-2">Gallery Is Being Curated</p>
                        <p className="text-[#7a8e82] text-sm">Our team will publish beautiful photos here shortly.</p>
                    </div>
                ) : (
                    /* CSS Columns Masonry — no JS column splitting needed */
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3">
                        <AnimatePresence>
                            {filteredTiles.map((image) => (
                                <GalleryCard
                                    key={image.id}
                                    image={image}
                                    onOpen={() => setSelected(image)}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </section>

            {/* ── CTA Strip ─────────────────────────────────────────────── */}
            {!loading && images.length > 0 && (
                <section className="border-t border-[#e7ddcf] bg-white">
                    <div className="w-full px-8 sm:px-12 lg:px-24 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div>
                            <p className="font-serif text-2xl text-[#1e2f27] mb-1">Ready to experience it in person?</p>
                            <p className="text-sm text-[#7a8e82]">Secure your dates and make these views yours.</p>
                        </div>
                        <Link
                            href="/book"
                            className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#1e2f27] text-white text-sm tracking-[0.15em] uppercase hover:bg-[#22352c] transition-colors shadow-lg"
                        >
                            Book Your Stay
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </Link>
                    </div>
                </section>
            )}

            {/* ── Lightbox ──────────────────────────────────────────────── */}
            <AnimatePresence>
                {selected && (
                    <Lightbox
                        image={selected}
                        images={filteredTiles}
                        onClose={() => setSelected(null)}
                        onNavigate={handleNavigate}
                    />
                )}
            </AnimatePresence>
        </main>
    );
}
