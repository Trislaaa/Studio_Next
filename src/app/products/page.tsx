'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

const products = [
  {
    id: 'cad-software',
    title: 'CAD Software',
    subtitle: 'GetonAgain CAD Solutions',
    desc: 'Explore cutting-edge CAD software on Studio Next for precision pattern design, grading, and marker making. Elevate your garment production workflows with our industry-leading solutions.',
    image: '/images/products/ga-garment-cad.png',
    link: '/products/cad-software',
    features: ['Pattern Design', 'Grading', 'Marker Making', 'Photo Digitizing'],
  },
  {
    id: 'cad-hardware',
    title: 'CAD Hardware',
    subtitle: 'Plotters & Cutting Solutions',
    desc: 'Discover top-tier CAD hardware at Studio Next for enhanced design precision and efficiency. Our range includes inkjet plotters, cutting plotters, and automatic fabric cutting machines.',
    image: '/images/products/scope-inkjet-plotter.png',
    link: '/products/cad-hardware',
    features: ['Inkjet Plotters', 'Cutting Plotters', 'Automatic Cutters', 'Fabric Spreaders'],
  },
  {
    id: 'cam-solutions',
    title: 'CAM Solutions',
    subtitle: 'Production-Ready Automation',
    desc: 'Production-ready workflow tools for machining, prototyping, and manufacturing output. Complete cutting room automation solutions for the apparel industry.',
    image: '/images/products/cam.jpg',
    link: '/products/cam-solutions',
    features: ['Auto Cutting', 'Nesting', 'Production Planning', 'Industry 4.0 Ready'],
  },
];

export default function ProductsPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const navItems = [
    { label: 'HOME', href: '/' },
    { label: 'PRODUCTS', href: '/products' },
  ];

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#2c3532] font-sans selection:bg-[#d29d42] selection:text-white">
      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="fixed top-0 right-0 z-50 h-full w-70 bg-[#17251f] flex flex-col px-8 py-10 shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <button
                ref={closeButtonRef}
                onClick={() => setIsMobileMenuOpen(false)}
                className="self-end mb-10 w-10 h-10 flex items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center gap-3 mb-12">
                <Image src="/logo-s.png" alt="STUDIO NEXT" width={40} height={40} className="object-cover object-left w-10 h-10" />
                <div>
                  <p className="text-white font-serif text-lg">STUDIO NEXT<span className="align-super text-[0.55em] leading-none ml-0.5">TM</span></p>
                  <p className="text-[#d29d42] text-[8px] tracking-[0.3em] uppercase">Concept to creation</p>
                </div>
              </div>
              <nav className="flex flex-col gap-2">
                {[
                  { label: 'HOME', href: '/' },
                  { label: 'CAD SOFTWARE', href: '/products/cad-software' },
                  { label: 'CAD HARDWARE', href: '/products/cad-hardware' },
                  { label: 'CAM SOLUTIONS', href: '/products/cam-solutions' },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 + 0.15 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block text-white/80 hover:text-[#d29d42] text-sm tracking-[0.2em] font-medium uppercase py-4 border-b border-white/10 transition-colors"
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="relative z-30 w-full px-5 sm:px-8 lg:px-16 py-6 sm:py-8 flex justify-between items-center bg-[#0B2532] text-white">
        <Link href="/" className="flex items-center gap-3 sm:gap-4 group">
          <Image src="/logo-s.png" alt="STUDIO NEXT Logo" width={44} height={44} priority className="object-cover object-left sm:w-14 sm:h-14" />
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-serif tracking-wide">STUDIO NEXT<span className="align-super text-[0.55em] leading-none ml-0.5">TM</span></span>
            <span className="text-[#d29d42] text-[7px] sm:text-[8px] tracking-[0.3em] font-medium uppercase mt-1">Concept to creation</span>
          </div>
        </Link>

        <div className="hidden lg:flex gap-8 items-center text-[10px] tracking-[0.16em] font-medium uppercase">
          <Link href="/" className="hover:text-[#d29d42] transition-colors relative group">
            HOME
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
          </Link>
          <Link href="/products" className="hover:text-[#d29d42] transition-colors relative group text-[#d29d42]">
            PRODUCTS
            <span className="absolute -bottom-1 left-0 w-full h-px bg-[#d29d42]"></span>
          </Link>
          <Link href="/#services" className="hover:text-[#d29d42] transition-colors relative group">
            SERVICES
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
          </Link>
          <Link href="/#contact" className="hover:text-[#d29d42] transition-colors relative group">
            CONTACT US
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
          </Link>
        </div>

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

      {/* Hero Section */}
      <section className="relative bg-[#0B2532] py-20 sm:py-28 lg:py-36 px-5 sm:px-8 lg:px-24 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#d29d42] rounded-full blur-[120px]" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#d29d42] rounded-full blur-[150px]" />
        </div>
        <div className="max-w-screen-2xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-4 uppercase">PRODUCTS</h4>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif text-white mb-6 leading-tight">
              Complete CAD/CAM <span className="italic text-[#d29d42]">Solutions</span>
            </h1>
            <p className="text-white/80 max-w-2xl text-sm sm:text-base lg:text-lg font-light leading-relaxed">
              Studio Next offers a comprehensive range of CAD/CAM solutions for the apparel industry — from powerful design software to high-precision cutting and plotting hardware.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16 sm:py-24 lg:py-32 px-5 sm:px-8 lg:px-24 bg-[#EAE7E1]">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
            {products.map((product, i) => (
              <FadeInSection key={product.id} delay={i * 160}>
                <Link href={product.link} className="group block h-full">
                  <div className="h-full rounded-xl bg-white border border-[rgba(0,0,0,0.08)] shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-500 hover:-translate-y-3 hover:border-[#C7A86D] hover:shadow-[0_25px_60px_rgba(199,168,109,0.2)]">
                    <div className="relative h-56 sm:h-64 overflow-hidden bg-[#f8f6f1]">
                      <Image
                        src={product.image}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-contain p-6 transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                    <div className="p-6 sm:p-8">
                      <p className="text-[#C7A86D] text-[10px] tracking-[0.3em] font-semibold uppercase mb-2">{product.subtitle}</p>
                      <h3 className="text-[1.75rem] text-[#111111] mb-3 font-serif font-bold">{product.title}</h3>
                      <p className="text-sm text-[#5F6368] font-normal leading-relaxed mb-5">{product.desc}</p>
                      <div className="flex flex-wrap gap-2 mb-5">
                        {product.features.map((feature) => (
                          <span key={feature} className="text-[10px] tracking-[0.1em] uppercase px-3 py-1.5 rounded-full bg-[#EAE7E1] text-[#5F6368] font-semibold">
                            {feature}
                          </span>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-2 text-[#C7A86D] text-[11px] tracking-[0.16em] font-semibold uppercase border-b border-[#C7A86D]/60 group-hover:text-[#1e2f27] group-hover:border-[#1e2f27]/40 transition-colors">
                        Explore More
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#17251f] text-white py-14 sm:py-20 px-5 sm:px-8 lg:px-24">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-12 lg:gap-24 border-b border-[#2c4036]/50 pb-10 sm:pb-16">
            <div>
              <div className="flex items-center gap-4 mb-5 sm:mb-6">
                <Image src="/logo-s.png" alt="Logo" width={52} height={52} className="object-cover object-left" />
                <div>
                  <h3 className="text-xl sm:text-2xl font-serif tracking-wide">STUDIO NEXT<span className="align-super text-[0.55em] leading-none ml-0.5">TM</span></h3>
                  <span className="text-[#d29d42] text-[8px] tracking-[0.3em] font-medium uppercase mt-1">Concept to creation</span>
                </div>
              </div>
              <p className="text-[#84a395] text-sm font-light leading-relaxed max-w-sm">
                Studio Next is a leading CAD/CAM solutions provider delivering innovative, reliable cutting room automation and tailored services to enhance productivity.
              </p>
            </div>
            <div>
              <h4 className="text-[#d29d42] text-[10px] tracking-[0.2em] font-bold mb-5 sm:mb-6 uppercase">QUICK LINKS</h4>
              <ul className="space-y-3 sm:space-y-4 text-sm text-[#84a395] font-light">
                <li><Link href="/" className="hover:text-[#d29d42] transition-colors">Home</Link></li>
                <li><Link href="/products/cad-software" className="hover:text-[#d29d42] transition-colors">CAD Software</Link></li>
                <li><Link href="/products/cad-hardware" className="hover:text-[#d29d42] transition-colors">CAD Hardware</Link></li>
                <li><Link href="/products/cam-solutions" className="hover:text-[#d29d42] transition-colors">CAM Solutions</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[#d29d42] text-[10px] tracking-[0.2em] font-bold mb-5 sm:mb-6 uppercase">CONTACT US</h4>
              <ul className="space-y-4 sm:space-y-5 text-sm text-[#84a395] font-light">
                <li className="flex items-start gap-3 sm:gap-4">
                  <span className="text-[#d29d42] mt-0.5 shrink-0">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </span>
                  <span>508, K.P. Aurum, Marol Maroshi Road, Andheri (E), Mumbai – 400059</span>
                </li>
                <li className="flex items-center gap-3 sm:gap-4">
                  <span className="text-[#d29d42] shrink-0">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </span>
                  <a href="tel:+919324747424" className="hover:text-[#d29d42] transition-colors">+91 93247 47424</a>
                </li>
                <li className="flex items-center gap-3 sm:gap-4">
                  <span className="text-[#d29d42] shrink-0">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </span>
                  <a href="mailto:admin@studionextinc.com" className="hover:text-[#d29d42] transition-colors">admin@studionextinc.com</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-6 sm:pt-8 text-center text-[#84a395] text-xs font-light">
            © {new Date().getFullYear()} STUDIO NEXT. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

