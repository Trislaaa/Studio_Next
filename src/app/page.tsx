'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { experiences, Experience } from '@/lib/experiences-data';
import ExperienceModal from '@/components/ExperienceModal';

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

function FadeInSection({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: delay / 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 3D Tilt Card Effect â€” disabled on touch devices for performance
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updateTouchState = () => {
      setIsTouchDevice(mediaQuery.matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    updateTouchState();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateTouchState);
      return () => mediaQuery.removeEventListener('change', updateTouchState);
    }

    mediaQuery.addListener(updateTouchState);
    return () => mediaQuery.removeListener(updateTouchState);
  }, []);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);
  const glareOpacity = useTransform(mouseXSpring, [-0.5, 0.5], [0, 0.1]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (isTouchDevice) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}
      className={`relative cursor-pointer perspective-1000 ${className}`}
    >
      <motion.div
        className="absolute inset-0 z-50 pointer-events-none rounded-xl"
        style={{
          background: "linear-gradient(105deg, transparent 20%, white 50%, transparent 80%)",
          opacity: glareOpacity,
          mixBlendMode: "overlay"
        }}
      />
      <div style={{ transform: "translateZ(30px)", transformStyle: "preserve-3d" }} className="w-full h-full">
        {children}
      </div>
    </motion.div>
  );
}

const productMenuItems = [
  { label: 'CAD Software', href: '/products/cad-software' },
  { label: 'CAD Hardware', href: '/products/cad-hardware' },
  { label: 'CAM Solutions', href: '/products/cam-solutions' },
];

const serviceMenuItems = [
  { label: 'Design Studio', href: '#design-studio' },
  { label: 'Sampling', href: '#sampling' },
  { label: 'Training & Placement', href: '#training-placement' },
];

type ServiceDetail = {
  id: string;
  title: string;
  description: string;
  intro: string[];
  sectionTitle: string;
  points: string[];
};

const serviceDetails: ServiceDetail[] = [
  {
    id: 'design-studio',
    title: 'Design Studio',
    description: 'Job-work design support for pattern making, grading, and consumption with reliable CAD file compatibility.',
    intro: [
      'Our Design Studio supports garment businesses with professional job-work services, from first pattern creation to final production-ready outputs.',
      'We keep the process practical and fast, so your team can move from buyer requirement to execution with fewer delays and less rework.',
    ],
    sectionTitle: 'Job Work Services Include',
    points: [
      'First pattern development from measurement specs and garment sample',
      'Graded pattern outputs for size runs',
      'Fabric consumption calculations for better planning',
      'File conversion between CAD formats including DXF, DXF AAMA, IBA, GGT, TMP, and Richpeace',
      'Pattern and marker plotting support for production teams',
      'Dedicated conversion support for Richpeace users via support@studionextinc.com',
    ],
  },
  {
    id: 'sampling',
    title: 'Sampling',
    description: 'From concept to approved garment samples, built by an experienced team using Richpeace CAD and high-end machinery.',
    intro: [
      'To support designers and small garment manufacturers, Studio Next runs a focused sampling unit that converts ideas into finished garments.',
      'Our experienced masters handle the full cycle with quality checks at each stage, backed by Richpeace CAD software and advanced machinery.',
    ],
    sectionTitle: 'Services Offered At Our Sampling Unit',
    points: [
      'Development of garment design concept',
      'Development of sample from design concept',
      'Production of approved samples',
    ],
  },
  {
    id: 'training-placement',
    title: 'Training & Placement',
    description: 'A structured 110-hour practical program that builds industry-ready pattern making and design skills with strong placement support.',
    intro: [
      'Studio Next offers a detailed 110-hour training program delivered in convenient modules over 2 months for Garment Masters and industry learners.',
      'The course blends core theory with hands-on software training so participants build real skills that match current market hiring demand.',
      'After training, our placement support helps candidates move into opportunities with confidence, with a strong track record in direct placements and recruiter connections.',
    ],
    sectionTitle: 'Program Highlights',
    points: [
      '110-hour structured curriculum over 2 months',
      'Focused pattern making and garment design training',
      'Hands-on practice using in-demand software tools',
      'Career guidance and placement assistance aligned with industry needs',
    ],
  },
];

function DropdownNavItem({
  label,
  items,
}: {
  label: string;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center gap-1 hover:text-[#d29d42] transition-colors relative group py-2"
      >
        <span>{label}</span>
        <svg className="w-3 h-3 transition-transform duration-200 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
      </button>

      <div className="absolute left-0 top-full pt-4 opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-50 min-w-64">
        <div className="rounded-sm border border-white/10 bg-[#0f1412] shadow-2xl overflow-hidden backdrop-blur-md">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block px-5 py-4 text-sm tracking-[0.12em] text-white/85 hover:text-[#d29d42] hover:bg-white/5 uppercase border-b border-white/5 last:border-b-0 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mobile Navigation Component
function MobileNav({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Menu Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="fixed top-0 right-0 z-50 h-full w-70 bg-[#17251f] flex flex-col px-8 py-10 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
          >
            <h2 id="mobile-nav-title" className="sr-only">Navigation menu</h2>
            {/* Close Button */}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="self-end mb-10 w-10 h-10 flex items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10 transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Logo */}
            <div className="flex items-center gap-3 mb-12">
              <Image src="/logo-s.png" alt="STUDIO NEXT" width={40} height={40} className="object-cover object-left w-10 h-10" />
              <div className="relative">
                <p className="text-white font-serif text-lg">STUDIO NEXT<span className="align-super text-[0.55em] leading-none ml-0.5">TM</span></p>
                <p className="text-[#d29d42] text-[8px] tracking-[0.3em] uppercase">Concept to creation</p>
              </div>
            </div>

            {/* Nav Links */}
            <nav className="flex flex-col gap-2">
              {[
                { label: 'HOME', href: '#home' },
                { label: 'ABOUT US', href: '#about' },
                { label: 'PRODUCTS', href: '#products' },
                { label: 'SERVICES', href: '#services' },
                { label: 'TESTIMONIALS', href: '#testimonials' },
                { label: 'EXPERIENCE CENTRE', href: '#experience-centre' },
                { label: 'CONTACT US', href: '#contact' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 + 0.15 }}
                >
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="block text-white/80 hover:text-[#d29d42] text-sm tracking-[0.2em] font-medium uppercase py-4 border-b border-white/10 transition-colors"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* Footer Label */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-auto"
            >
              <p className="text-center text-[#84a395] text-xs mt-6 font-light">
                © {new Date().getFullYear()} STUDIO NEXT
              </p>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function HeroHeading({ text, glow, isMobile }: { text: string; glow?: boolean; isMobile: boolean }) {
  if (isMobile) {
    return (
      <span className={`inline-block ${glow ? 'text-[#d29d42]' : ''}`}>
        {text}
      </span>
    );
  }

  const words = text.split(" ");
  return (
    <span className="inline-flex flex-wrap justify-center gap-x-4">
      {words.map((word, wIdx) => (
        <span key={wIdx} className="inline-flex">
          {word.split("").map((char, cIdx) => (
            <motion.span
              key={`${wIdx}-${cIdx}`}
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: (wIdx * 0.2) + (cIdx * 0.05),
              }}
              className={`inline-block hover:-translate-y-4 hover:scale-110 hover:text-[#d29d42] transition-transform duration-300 ${glow ? 'text-[#d29d42]' : ''}`}
              style={{ textShadow: "0px 10px 20px rgba(0,0,0,0.5)" }}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </span>
  );
}

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState<Experience | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceDetail | null>(null);
  const experienceGradients = [
    'radial-gradient(120% 100% at 50% 10%, #2f6a50 0%, #183a2d 45%, #071512 100%)',
    'radial-gradient(120% 100% at 50% 10%, #3a6384 0%, #1d3552 45%, #081523 100%)',
    'radial-gradient(120% 100% at 50% 10%, #6a5b3f 0%, #3b2f1e 45%, #161006 100%)',
    'radial-gradient(120% 100% at 50% 10%, #5f476d 0%, #312140 45%, #12081c 100%)',
    'radial-gradient(120% 100% at 50% 10%, #536948 0%, #2a3d26 45%, #0d160b 100%)',
  ];

  const { scrollYProgress } = useScroll();
  const heroParallaxY = useTransform(scrollYProgress, [0, 0.2], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Search UI state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const experienceScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollExperienceLeft, setCanScrollExperienceLeft] = useState(false);
  const [canScrollExperienceRight, setCanScrollExperienceRight] = useState(true);

  const getExperienceScrollAmount = (container: HTMLDivElement) => {
    const card = container.querySelector('[data-experience-card="true"]') as HTMLElement | null;
    const gap = window.innerWidth >= 1024 ? 48 : window.innerWidth >= 640 ? 32 : 20;
    return card ? card.offsetWidth + gap : Math.round(container.clientWidth * 0.85);
  };

  const updateExperienceArrowState = () => {
    const container = experienceScrollRef.current;
    if (!container) return;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    setCanScrollExperienceLeft(container.scrollLeft > 4);
    setCanScrollExperienceRight(container.scrollLeft < maxScrollLeft - 4);
  };

  const scrollExperienceCards = (direction: 'left' | 'right') => {
    const container = experienceScrollRef.current;
    if (!container) return;

    const scrollAmount = getExperienceScrollAmount(container);
    const delta = direction === 'right' ? scrollAmount : -scrollAmount;
    container.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const navSearchItems = [
    { label: 'HOME', href: '#home' },
    { label: 'ABOUT US', href: '#about' },
    { label: 'PRODUCTS', href: '#products' },
    { label: 'SERVICES', href: '#services' },
    { label: 'TESTIMONIALS', href: '#testimonials' },
    { label: 'EXPERIENCE CENTRE', href: '#experience-centre' },
    { label: 'CONTACT US', href: '#contact' },
  ];

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!selectedService) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedService(null);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [selectedService]);

  useEffect(() => {
    const container = experienceScrollRef.current;
    if (!container) return;

    updateExperienceArrowState();

    const handleScroll = () => updateExperienceArrowState();
    const handleResize = () => updateExperienceArrowState();

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [isClient]);



  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2c3532] font-sans selection:bg-[#d29d42] selection:text-white">

      {/* Mobile Nav Drawer */}
      <MobileNav isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* 1. Hero Section */}
      <section id="home" className="relative h-screen min-h-150 flex flex-col justify-between overflow-hidden">
        {/* Background: use contact section color only for hero */}
        <div className="absolute inset-0 z-0 bg-[#0B2532]"></div>

        {/* Navigation */}
        <nav className="relative z-30 w-full px-5 sm:px-8 lg:px-16 py-6 sm:py-8 flex justify-between items-center text-white">
          <Link href="/" className="flex items-center gap-3 sm:gap-4 group">
            <div className="flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
              <Image src="/logo-s.png" alt="STUDIO NEXT Logo" width={44} height={44} priority className="object-cover object-left sm:w-14 sm:h-14" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-serif tracking-wide">STUDIO NEXT<span className="align-super text-[0.55em] leading-none ml-0.5">TM</span></span>
              <span className="text-[#d29d42] text-[7px] sm:text-[8px] tracking-[0.3em] font-medium uppercase mt-1">Concept to creation</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex gap-8 items-center text-[10px] tracking-[0.16em] font-medium uppercase relative">
            <Link href="#home" className="hover:text-[#d29d42] transition-colors relative group">
              HOME
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="#about" className="hover:text-[#d29d42] transition-colors relative group">
              ABOUT US
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <DropdownNavItem label="PRODUCTS" items={productMenuItems} />
            <DropdownNavItem label="SERVICES" items={serviceMenuItems} />
            <Link href="#testimonials" className="hover:text-[#d29d42] transition-colors relative group">
              TESTIMONIALS
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="#experience-centre" className="hover:text-[#d29d42] transition-colors relative group">
              EXPERIENCE CENTRE
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="#contact" className="hover:text-[#d29d42] transition-colors relative group">
              CONTACT US
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
            </Link>
            {/* Search button */}
            <div className="relative">
              <button
                aria-label="Open search"
                onClick={() => setIsSearchOpen((s) => !s)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35" />
                  <circle cx="11" cy="11" r="6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                </svg>
              </button>

              {isSearchOpen && (
                <div className="absolute right-0 top-12 w-72 bg-white text-[#1e2f27] rounded-md shadow-2xl z-50">
                  <div className="p-2">
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setIsSearchOpen(false); }}
                      placeholder="Search sections..."
                      className="w-full px-3 py-2 rounded text-sm border border-gray-200 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-44 overflow-auto">
                    {(navSearchItems.filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase())).slice(0,6)).map((item) => (
                      <button
                        key={item.href}
                        onClick={() => { setIsSearchOpen(false); setSearchQuery(''); window.location.hash = item.href; }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#f6f3ee]"
                      >
                        {item.label}
                      </button>
                    ))}
                    {navSearchItems.filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">No results</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open navigation menu"
          >
            <span className="w-6 h-0.5 bg-white rounded-full"></span>
            <span className="w-4 h-0.5 bg-white rounded-full"></span>
            <span className="w-6 h-0.5 bg-white rounded-full"></span>
          </button>
        </nav>

        {/* Hero Content */}
        <motion.div
          style={{ y: heroParallaxY, opacity: heroOpacity }}
          className="relative z-30 flex flex-col items-center justify-center text-center px-5 sm:px-8 pb-8 sm:pb-12 mt-8 sm:mt-12 lg:mt-20"
        >
          {isClient && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
            >
              <div className="text-[#d29d42] text-[10px] sm:text-[11px] tracking-[0.25em] sm:tracking-[0.3em] font-semibold mb-5 sm:mb-8 uppercase">
                Since 2003
              </div>
              <h1 className="text-4xl sm:text-6xl lg:text-8xl font-serif text-white mb-4 sm:mb-6 tracking-tight leading-[1.1]" style={{ perspective: "1000px" }}>
                <span className="block mb-1 sm:mb-2 italic font-light">
                  <HeroHeading text="Providing Technology For Lifestyle" glow={true} isMobile={isMobile} />
                </span>
              </h1>
              <p className="text-white/85 max-w-sm sm:max-w-xl text-sm sm:text-base lg:text-lg mb-8 sm:mb-12 font-light leading-relaxed mx-auto mt-4 sm:mt-6">
                Intelligent CAD/CAM solutions for complete cutting room automation
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center w-full max-w-xs sm:max-w-none mx-auto">
                <Link href="/products" className="group relative overflow-hidden bg-[#d29d42] text-white px-7 sm:px-8 py-3.5 sm:py-4 text-[11px] tracking-[0.2em] font-semibold uppercase hover:bg-[#c38d32] transition-colors text-center">
                  <span className="relative z-10 group-hover:-translate-y-0.5 inline-block transition-transform duration-300">EXPLORE PRODUCTS</span>
                  <div className="absolute inset-0 h-full w-full transform -translate-x-full bg-white/20 skew-x-12 group-hover:animate-[shine_1s_ease-in-out]"></div>
                </Link>
                <Link href="#about" className="group border border-white/40 text-white px-7 sm:px-8 py-3.5 sm:py-4 text-[11px] tracking-[0.2em] font-semibold uppercase hover:bg-white hover:text-[#1e2f27] transition-all duration-500 backdrop-blur-sm text-center">
                  <span className="group-hover:-translate-y-0.5 inline-block transition-transform duration-300">DISCOVER MORE</span>
                </Link>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Scroll Indicator */}
        <div className="relative z-30 pb-8 sm:pb-12 flex justify-center w-full">
          <motion.div
            animate={{ y: [0, 10, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-3 sm:gap-4"
          >
            <span className="text-[9px] uppercase tracking-[0.4em] text-white">SCROLL</span>
            <div className="w-px h-8 sm:h-10 bg-linear-to-b from-white to-transparent" />
          </motion.div>
        </div>
      </section>

      {/* 2. Our Story Section */}
      <section id="about" className="relative py-10 sm:py-14 lg:py-16 px-5 sm:px-8 lg:px-24 max-w-screen-2xl mx-auto overflow-hidden z-20">
        <div className="grid lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-14 items-start relative z-10">
          <div className="lg:col-span-5">
            <FadeInSection>
              <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-4 sm:mb-6 uppercase">OUR STORY</h4>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#1e2f27] leading-tight mb-5 sm:mb-8">
                6000+ installations all across the country
              </h2>
              <p className="text-gray-600 mb-5 sm:mb-6 font-light leading-relaxed text-sm lg:text-base">
                Studio Next Technology Pvt. Ltd. is one of the leading CAD/CAM solution provider for complete cutting room automation, catering to the fashion & apparel industry. Head quartered in Mumbai, the Company has grown steadily since being founded in 2003, who have been professionals in the area of CAD/CAM solutions.
              </p>
              <p className="text-gray-600 font-light leading-relaxed text-sm lg:text-base">
                Studio Next team is expert in providing pre and post sales technical support, software training and implementations and our software & hardware troubleshooting experts handle these hi-end CAD/CAM solutions.
              </p>
            </FadeInSection>
          </div>
          <div className="lg:col-span-7 perspective-1000">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
              {[
                { title: 'Intelligent CAD/CAM', desc: 'Advanced solutions for cutting room automation', icon: 'cpu' },
                { title: 'Precision Pattern Design', desc: 'Accurate grading, marking & digital pattern creation', icon: 'pencil-ruler' },
                { title: 'Automated Fabric Cutting', desc: 'High-speed cutting with maximum efficiency', icon: 'scissors' },
                { title: 'End-to-End Manufacturing', desc: 'From design to production with seamless workflow', icon: 'workflow' },
              ].map((feature, i) => (
                <FadeInSection key={i} delay={i * 120} className="h-full">
                  <TiltCard className="h-full">
                    <div className="bg-white/90 backdrop-blur-md p-4 sm:p-6 lg:p-7 rounded-xl shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-gray-100 flex flex-col gap-2 sm:gap-3 h-full">
                      <div className="text-[#d29d42] h-5 w-5 sm:h-6 sm:w-6">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                          {feature.icon === 'cpu' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M7 7h10v10H7V7zm2 2v6h6V9H9z" />}
                          {feature.icon === 'pencil-ruler' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 20l4.5-1L20 7.5a1.5 1.5 0 000-2.1L18.6 4a1.5 1.5 0 00-2.1 0L6.4 14.1 5 18.5 4 20zm10-12l2 2m-5 5h4" />}
                          {feature.icon === 'scissors' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6a2 2 0 110-4 2 2 0 010 4zm12 12a2 2 0 110-4 2 2 0 010 4zM7.5 7.5l9 9M7.5 16.5l5.25-5.25M12.75 11.25l3.75-3.75" />}
                          {feature.icon === 'workflow' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7a3 3 0 116 0 3 3 0 01-6 0zm10 10a3 3 0 116 0 3 3 0 01-6 0zM7 17a3 3 0 116 0 3 3 0 01-6 0zm6-10h4a2 2 0 012 2v3m-7 5H9a2 2 0 01-2-2v-3m6 0h2" />}
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-[#111111] mb-1 sm:mb-2">{feature.title}</h3>
                        <p className="text-[12px] sm:text-[13px] text-[#5F6368] font-normal leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  </TiltCard>
                </FadeInSection>
              ))}
            </div>

            <div className="mt-8 sm:mt-10 lg:mt-12 max-w-xl">
              <FadeInSection>
                <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-3 sm:mb-4 uppercase">OUR MISSION</h4>
                <p className="text-white text-xl sm:text-2xl lg:text-3xl font-serif leading-tight">
                  Technology for all at a Honest Price
                </p>
              </FadeInSection>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Products Section */}
      <section id="products" className="bg-[#EAE7E1] relative py-16 sm:py-24 lg:py-40 px-5 sm:px-8 lg:px-24 overflow-hidden border-t border-black/5">
        <div className="max-w-screen-2xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-10 sm:mb-16">
              <h4 className="text-[#C7A86D] text-[10px] tracking-[0.3em] font-semibold mb-3 sm:mb-4 uppercase">PRODUCTS</h4>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl text-[#111111]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>Featured <span className="italic text-[#C7A86D]">Products</span></h2>
            </div>
          </FadeInSection>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {[
              { id: 'cad-software', title: 'CAD Software', desc: 'Explore cutting-edge CAD software on Studio Next for precision design and seamless workflows. Elevate your projects with our industry-leading solutions.', href: '/products/cad-software' },
              { id: 'cad-hardware', title: 'CAD Hardware', desc: 'Discover top-tier CAD hardware at Studio Next for enhanced design precision and efficiency. Elevate your workflow with our cutting-edge hardware solutions.', href: '/products/cad-hardware' },
              { id: 'cam-solutions', title: 'CAM Solutions', desc: 'Production-ready workflow tools for machining, prototyping, and manufacturing output.', href: '/products/cam-solutions' },
            ].map((product, i) => (
              <FadeInSection key={product.id} delay={i * 160}>
                <Link href={product.href} className="block h-full">
                  <div id={product.id} className="h-full rounded-xl bg-white border border-[rgba(0,0,0,0.08)] shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-6 sm:p-8 transition-all duration-300 hover:-translate-y-2 hover:border-[#C7A86D] hover:shadow-[0_20px_50px_rgba(199,168,109,0.15)]">
                    <h3 className="text-[1.75rem] sm:text-[1.75rem] text-[#111111] mb-2 sm:mb-3" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>{product.title}</h3>
                    <p className="text-sm text-[#5F6368] font-normal leading-relaxed">{product.desc}</p>
                  </div>
                </Link>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Services Section */}
      <section id="services" className="py-16 sm:py-24 lg:py-28 bg-[#EAE7E1] border-y border-black/5 px-5 sm:px-8 lg:px-24">
        <div className="max-w-screen-2xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-10 sm:mb-14">
              <h4 className="text-[#C7A86D] text-[10px] tracking-[0.3em] font-semibold mb-3 sm:mb-4 uppercase">SERVICES</h4>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl text-[#111111]" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>What We <span className="italic text-[#C7A86D]">Offer</span></h2>
            </div>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {serviceDetails.map((service, i) => (
              <FadeInSection key={service.id} delay={i * 140}>
                <div id={service.id} className="h-full rounded-xl bg-[#F8F8F8] border border-[rgba(17,17,17,0.08)] shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-6 sm:p-8 transition-all duration-300 hover:-translate-y-2 hover:border-[#C7A86D] hover:bg-white hover:shadow-[0_20px_50px_rgba(199,168,109,0.15)] flex flex-col">
                  <h3 className="text-[2.25rem] lg:text-[3rem] leading-[1.1] text-[#111111] mb-3" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>{service.title}</h3>
                  <p className="text-base text-[#5F6368] font-normal leading-relaxed">{service.description}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedService(service)}
                    className="mt-auto pt-6 inline-flex w-fit items-center gap-2 text-[#C7A86D] text-[11px] tracking-[0.16em] font-semibold uppercase border-b border-[#C7A86D]/60 hover:text-[#1e2f27] hover:border-[#1e2f27]/40 transition-colors"
                  >
                    Know more
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Experience Centre Section */}
      <section id="experience-centre" className="py-16 sm:py-24 lg:py-32 overflow-x-hidden bg-[#faf8f5]">
        <FadeInSection>
          <div className="text-center mb-10 sm:mb-14 px-5 sm:px-8 lg:px-24 max-w-7xl mx-auto">
            <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-3 sm:mb-4 uppercase">EXPLORE</h4>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#1e2f27] mb-4 sm:mb-6">Experience <span className="italic">Centre</span></h2>
            <p className="text-gray-500 max-w-2xl mx-auto font-light leading-relaxed text-sm">
              Studio Next's Experience Center showcases advanced garment automation technologies through hands-on demonstrations, enabling smarter manufacturing decisions and transforming industry practices.
            </p>
          </div>
        </FadeInSection>

        <div className="relative">
          <button
            type="button"
            onClick={() => scrollExperienceCards('left')}
            aria-label="Scroll experience images left"
            className={`absolute left-3 sm:left-6 lg:left-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#1e2f27]/85 text-white border border-white/20 shadow-lg hover:bg-[#1e2f27] transition-all flex items-center justify-center ${canScrollExperienceLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => scrollExperienceCards('right')}
            aria-label="Scroll experience images right"
            className={`absolute right-3 sm:right-6 lg:right-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#1e2f27]/85 text-white border border-white/20 shadow-lg hover:bg-[#1e2f27] transition-all flex items-center justify-center ${canScrollExperienceRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </button>

          <div
            ref={experienceScrollRef}
            className="flex gap-5 sm:gap-8 lg:gap-12 overflow-x-auto pt-4 pb-8 snap-x snap-mandatory scrollbar-hide perspective-1000 w-screen relative left-1/2 -translate-x-1/2 pl-5 pr-16 sm:pl-8 sm:pr-20 lg:pl-12 lg:pr-24 scroll-pl-5 sm:scroll-pl-8 lg:scroll-pl-12"
          >
          {experiences.map((exp, i) => (
            <motion.div
              key={exp.name}
              initial={{ rotateY: i % 3 === 0 ? "30deg" : i % 3 === 2 ? "-30deg" : "0deg", translateZ: i % 3 === 1 ? "30px" : "-30px", opacity: 0 }}
              whileInView={{ rotateY: "0deg", translateZ: "0px", opacity: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.15 }}
              style={{ transformStyle: "preserve-3d" }}
              className="h-full shrink-0 w-88 sm:w-[30rem] lg:w-[36rem] snap-start"
              data-experience-card="true"
            >
              <TiltCard className="h-full">
                <div
                  className="relative h-64 sm:h-72 lg:h-80 rounded-xl overflow-hidden group cursor-pointer"
                  onClick={() => {
                    setSelectedExperience(exp);
                    setIsModalOpen(true);
                  }}
                >
                  <div
                    className="absolute inset-0 transition-transform duration-1000 group-hover:scale-105"
                  >
                    {exp.image ? (
                      <Image
                        src={exp.image}
                        alt={exp.name}
                        fill
                        sizes="(max-width: 640px) 70vw, (max-width: 1024px) 40vw, 384px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0" style={{ background: experienceGradients[i % experienceGradients.length] }} />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-linear-to-t from-black/88 via-black/45 to-black/15 z-10" />
                  <div className="absolute bottom-0 left-0 p-6 sm:p-8 w-full z-20 flex flex-col justify-end h-full" style={{ transform: "translateZ(30px)" }}>
                    <h3 className="text-white text-xl sm:text-2xl font-serif font-medium transform transition-all duration-500 group-hover:-translate-y-2">{exp.name}</h3>
                    <div className="h-0 opacity-0 group-hover:h-auto group-hover:opacity-100 transition-all duration-500 overflow-hidden mt-3 transform translate-y-4 group-hover:translate-y-0">
                      <span className="text-[#d29d42] text-xs tracking-widest font-medium uppercase border-b border-[#d29d42] pb-0.5">Explore More</span>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          ))}
          </div>

          <div className="mt-8 sm:mt-10 flex justify-center px-5 sm:px-8 lg:px-24">
            <a
              href="/images/experience-center/studio-next-brochure-2025.pdf"
              download
              className="inline-flex items-center gap-2 rounded-full border border-[#d29d42]/40 bg-[#1e2f27] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-[#21352c] hover:border-[#d29d42]/70"
            >
              Download Brochure
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0 7-7m-7 7-7-7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* 6. Testimonials */}
      <section id="testimonials" className="bg-[#1e2f27] pt-12 sm:pt-20 lg:pt-24 pb-20 sm:pb-36 lg:pb-48 px-5 sm:px-8 lg:px-24 overflow-hidden relative border-t border-[#f6bd5e]/20">
        <div className="max-w-screen-2xl mx-auto relative z-10">
          <FadeInSection>
            <div className="text-center mb-10 sm:mb-16">
              <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-3 sm:mb-4 uppercase">TESTIMONIALS</h4>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-white">Guest <span className="italic">Stories</span></h2>
            </div>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8 perspective-1000 relative">
            {[
              {
                text: "We’ve been using Richpeace CAD software at our Daman and Surat facilities for 5 years, with significant benefits. Our arsenal includes 7 CAD workstations, 3 plotters, and a CNC Cutter. The software’s efficiency in generating production markers and technical sheets has been a game-changer for us. Studio Next’s consistent service and support have been pivotal in our growth.",
                name: "Shaleen Toshniwal",
                loc: "MD | Banswara Garments",
              },
              {
                text: "Richpeace CAD solutions were instrumental in doubling our production capacity, from 2000 to 4000 pieces daily. Our setup includes 5 pattern-making software sets and 2 pen plotters. These tools have not only enhanced our productivity but also the quality of our kids’ wear brand, Little Kangaroo. Studio Next stands out as a technologically sensitive and supportive partner.",
                name: "Arun Lalwani",
                loc: "MD | Romano Apparels, Mumbai",
              },
              {
                text: "Specializing in EU market sportswear, we face the challenge of creating numerous styles in small quantities. Richpeace CAD software transformed our pattern-making process, increasing our output significantly. With a virtual pattern library, 12 workstations, and 4 plotters, we’ve seen a marked improvement in efficiency. Studio Next’s prompt service has been a strong support in our journey.",
                name: "Amar Gupta",
                loc: "MD | International Design and Trade, Mumbai",
              }
            ].map((review, i) => (
              <motion.div
                key={i}
                initial={{ rotateY: i === 0 ? "30deg" : i === 2 ? "-30deg" : "0deg", translateZ: i === 1 ? "50px" : "-50px", opacity: 0 }}
                whileInView={{ rotateY: "-0deg", translateZ: "0px", opacity: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.2 }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <TiltCard className="h-full">
                  <div className="border border-[#2c4036] p-6 sm:p-8 lg:p-10 rounded-xl bg-[#21352c]/50 backdrop-blur-md flex flex-col justify-between h-full hover:bg-[#2c4036] transition-colors duration-500 transform shadow-2xl shadow-black/50">
                    <div className="transform translate-z-10">
                      <div className="flex gap-1 text-[#d29d42] text-sm mb-4 sm:mb-6">
                        <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                      </div>
                      <p className="text-white/90 italic font-light leading-relaxed mb-6 sm:mb-8 text-sm sm:text-[15px]">
                        &ldquo;{review.text}&rdquo;
                      </p>
                    </div>
                    <div className="transform translate-z-20">
                      <div className="text-white font-bold text-sm mb-1">{review.name}</div>
                      <div className="text-[#84a395] text-xs font-light">{review.loc}</div>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer id="contact" className="bg-[#17251f] text-white py-14 sm:py-20 px-5 sm:px-8 lg:px-24 overflow-hidden relative z-20">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-12 lg:gap-24 border-b border-[#2c4036]/50 pb-10 sm:pb-16">
            <FadeInSection delay={0}>
              <div>
                <div className="flex items-center gap-4 mb-5 sm:mb-6">
                  <Image src="/logo-s.png" alt="STUDIO NEXT Logo" width={52} height={52} className="object-cover object-left w-[52px] h-[52px]" />
                  <div className="flex flex-col">
                    <h3 className="text-xl sm:text-2xl font-serif tracking-wide">STUDIO NEXT<span className="align-super text-[0.55em] leading-none ml-0.5">TM</span></h3>
                    <span className="text-[#d29d42] text-[8px] tracking-[0.3em] font-medium uppercase mt-1">Concept to creation</span>
                  </div>
                </div>
                <p className="text-[#84a395] text-sm font-light leading-relaxed max-w-sm">
                  Studio Next is a leading CAD/CAM solutions provider delivering innovative, reliable cutting room automation and tailored services to enhance productivity and build long-term client partnerships.
                </p>
                <div className="mt-6 flex flex-col items-center gap-4">
                  {/* QR image: user's uploaded PNG */}
                  <Image src="/images/qrcode_340319031_bc49eb92d24b5a98d3f83dc5b6c1a88c.png" alt="Explore More QR" width={140} height={140} className="object-contain rounded-sm bg-white/5 p-2" />
                  <a href="/products" className="text-[#d29d42] mt-2">
                    <div className="text-[#d29d42] text-sm font-serif tracking-wide text-center">- Scan to Explore -</div>
                  </a>
                </div>
              </div>
            </FadeInSection>

            <FadeInSection delay={150}>
              <div>
                <h4 className="text-[#d29d42] text-[10px] tracking-[0.2em] font-bold mb-5 sm:mb-6 uppercase">QUICK LINKS</h4>
                <ul className="space-y-3 sm:space-y-4 text-sm text-[#84a395] font-light">
                  <li><Link href="#home" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Home</Link></li>
                  <li><Link href="#about" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">About Us</Link></li>
                  <li><Link href="#products" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Products</Link></li>
                  <li><Link href="#services" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Services</Link></li>
                  <li><Link href="#testimonials" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Testimonials</Link></li>
                  <li><Link href="#experience-centre" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Experience Centre</Link></li>
                  <li><Link href="#contact" className="hover:text-[#d29d42] transition-colors inline-block hover:translate-x-1 duration-300">Contact Us</Link></li>
                </ul>
              </div>
            </FadeInSection>

            <FadeInSection delay={300}>
              <div>
                <h4 className="text-[#d29d42] text-[10px] tracking-[0.2em] font-bold mb-5 sm:mb-6 uppercase">CONTACT US</h4>
                <ul className="space-y-4 sm:space-y-5 text-sm text-[#84a395] font-light">
                  <li className="flex items-start gap-3 sm:gap-4 group cursor-pointer">
                    <span className="text-[#d29d42] mt-0.5 shrink-0 group-hover:-rotate-12 transition-transform">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </span>
                    <a
                      href="https://www.google.com/maps/search/?api=1&query=508+K.P.+Aurum+Marol+Maroshi+Road+Andheri+East+Mumbai+400059"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#d29d42] transition-colors"
                    >
                      508, K.P. Aurum, Marol Maroshi Road, Andheri (E), Mumbai – 400059
                    </a>
                  </li>
                  <li className="flex items-center gap-3 sm:gap-4 group cursor-pointer">
                    <span className="text-[#d29d42] shrink-0 group-hover:scale-110 transition-transform">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </span>
                    <a href="tel:+919324747424" className="hover:text-[#d29d42] transition-colors">+91 93247 47424</a>
                  </li>
                  <li className="flex items-center gap-3 sm:gap-4 group cursor-pointer">
                    <span className="text-[#d29d42] shrink-0 group-hover:scale-110 transition-transform">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </span>
                    <a href="tel:02229203411" className="hover:text-[#d29d42] transition-colors">022 29203411</a>
                    <span className="text-[#84a395]">/</span>
                    <a href="tel:02229205594" className="hover:text-[#d29d42] transition-colors">29205594</a>
                  </li>
                  <li className="flex items-center gap-3 sm:gap-4 group cursor-pointer">
                    <span className="text-[#d29d42] shrink-0 group-hover:scale-110 transition-transform">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </span>
                    <a href="mailto:admin@studionextinc.com" className="hover:text-[#d29d42] transition-colors">admin@studionextinc.com</a>
                  </li>
                </ul>
              </div>
            </FadeInSection>
          </div>

          <div className="pt-6 sm:pt-8 text-center text-[#84a395] text-xs font-light">
            © {new Date().getFullYear()} STUDIO NEXT. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Styles */}
      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .translate-z-10 {
          transform: translateZ(10px);
        }
        .translate-z-20 {
          transform: translateZ(20px);
        }
        @keyframes shine {
          100% {
            transform: translateX(100%);
          }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <AnimatePresence>
        {selectedService && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 z-100 bg-black/60 backdrop-blur-xl"
              onClick={() => setSelectedService(null)}
            />

            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 100, scale: 0.9, rotateX: 15 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 1 }}
              className="fixed inset-0 z-101 flex items-center justify-center p-4 md:p-8"
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-modal-title"
              onClick={() => setSelectedService(null)}
            >
              <div
                className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                  backdropFilter: 'blur(40px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 80px -20px rgba(210, 157, 66, 0.15)',
                }}
              >
                <div className="absolute inset-0 rounded-3xl pointer-events-none bg-linear-to-b from-[#1e2f27]/90 to-[#17251f]/95" />

                <div className="relative z-10 overflow-y-auto max-h-[90vh] p-6 md:p-8 lg:p-10">
                  <motion.button
                    onClick={() => setSelectedService(null)}
                    className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                    }}
                    whileHover={{ scale: 1.1, background: 'rgba(255, 255, 255, 0.2)' }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Close service details"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L17 17M1 17L17 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </motion.button>

                  <div className="pr-8">
                    <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-3 uppercase">Service Details</h4>
                    <h2 id="service-modal-title" className="text-3xl md:text-4xl font-serif text-white mb-6">{selectedService.title}</h2>
                  </div>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-1 bg-linear-to-r from-[#d29d42]/40 to-transparent" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d29d42]" />
                    <div className="h-px flex-1 bg-linear-to-l from-[#d29d42]/40 to-transparent" />
                  </div>

                  <div className="space-y-4 mb-8">
                    {selectedService.intro.map((paragraph, index) => (
                      <p key={index} className="text-white/85 font-light leading-relaxed text-[15px] md:text-base">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  <h3 className="text-[#d29d42] text-sm tracking-[0.14em] uppercase mb-4 font-semibold">
                    {selectedService.sectionTitle}
                  </h3>

                  <ul className="space-y-3 mb-8">
                    {selectedService.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-white/90 text-sm md:text-[15px] leading-relaxed">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#d29d42] shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  <motion.button
                    onClick={() => setSelectedService(null)}
                    className="w-full sm:w-auto py-3 px-6 rounded-xl text-sm font-medium transition-all duration-300"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: 'rgba(255, 255, 255, 0.85)',
                    }}
                    whileHover={{ background: 'rgba(255, 255, 255, 0.12)', scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Close
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Experience Modal */}
      <ExperienceModal
        experience={selectedExperience}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedExperience(null);
        }}
      />
    </div>
  );
}

