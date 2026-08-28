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

// CAM Solutions Products Data (ordered as per user request)
const camSolutionsList = [
  {
    id: 'fabric-spreader',
    title: 'SCOPE Pro – HX Series Spreader',
    subtitle: 'Precision Spreading for Bulk Production',
    description: 'An advanced automatic fabric spreading machine designed for high-volume cutting rooms. Ensures consistent, tension-free fabric layering with precision alignment for maximum cutting accuracy and efficiency.',
    image: '/images/products/scope pro hx series spreader.jpg',
    features: [
      'Automatic fabric spreading with programmable layer counts',
      'Tension-free spreading eliminates fabric distortion',
      'Face-to-face and face-to-one-side spreading modes',
      'Edge alignment system for precise fabric positioning',
      'Handles woven, knit, and non-woven fabrics',
      'Digital layer counter and end-of-roll detection',
      'Cutter bar for automatic fabric cutting at end of lay',
      'Reduces fabric waste and improves cutting accuracy',
    ],
    highlights: [
      { label: 'Type', value: 'Automatic Spreader' },
      { label: 'Control', value: 'Programmable' },
      { label: 'Fabrics', value: 'All Types' },
      { label: 'Best For', value: 'Bulk Cutting Rooms' },
    ],
  },
  {
    id: 'denim-cutter',
    title: 'SCOPE Pro – The Denim Cutter',
    subtitle: 'Specialized Cutting Solution for Denim & Heavy Fabrics',
    description: 'A specialized cutting solution engineered specifically for denim and heavy-weight fabrics. Built with reinforced components and advanced blade technology to handle the unique challenges of denim cutting in bulk production.',
    image: '/images/products/SCOPE Pro – The Denim Cutter.jpg',
    features: [
      'Reinforced cutting head for heavy fabric penetration',
      'Specialized blade system for denim and thick materials',
      'High-pressure vacuum for multi-layer denim cutting',
      'Handles rigid, stretch, and blended denim fabrics',
      'Precision cutting of multiple plies simultaneously',
      'Automated tool path optimization for denim lay plans',
      'Robust construction for continuous heavy-duty use',
      'Proven performance in leading denim manufacturing units',
    ],
    highlights: [
      { label: 'Specialization', value: 'Denim & Heavy Fabrics' },
      { label: 'Blade', value: 'Reinforced System' },
      { label: 'Layers', value: 'Multi-Ply Cutting' },
      { label: 'Best For', value: 'Denim Manufacturers' },
    ],
  },
  {
    id: 'cyg-yin-automatic-cutter',
    title: 'CYG YIN AUTOMATIC FABRIC CUTTING MACHINE',
    subtitle: 'High-Precision Automatic Fabric Cutting Solution',
    description: 'A powerful automatic fabric cutting machine designed for high-volume production environments. Delivers precision cutting with speed and efficiency, making it ideal for bulk garment manufacturing operations.',
    image: '/images/products/CYG YIN AUTOMATIC FABRIC CUTTING MACHINE.jpg',
    features: [
      'High-speed automatic fabric cutting for mass production',
      'Precision cutting with advanced servo motor control',
      'Handles woven, knit, and non-woven fabrics',
      'Computer-controlled cutting head for accuracy',
      'Vacuum table for secure fabric holding during cutting',
      'Automatic blade sharpening system',
      'Network-ready for direct CAD file transfer',
      'Reduces cutting time and fabric waste significantly',
    ],
    highlights: [
      { label: 'Technology', value: 'Automatic CNC Cutting' },
      { label: 'Fabrics', value: 'Woven, Knit & Non-Woven' },
      { label: 'Speed', value: 'High-Throughput' },
      { label: 'Best For', value: 'Bulk Production' },
    ],
  },
  {
    id: 'scope-auto-fabric-cutter',
    title: 'SCOPE Automatic Fabric Cutting Machine',
    subtitle: 'Intelligent Cutting Room Automation',
    description: 'A state-of-the-art automatic fabric cutting machine from the SCOPE Pro series, engineered for precision cutting in demanding production environments. Integrates seamlessly with CAD systems for end-to-end automated workflow.',
    image: '/images/products/SCOPE Automatic High Speed Sample Cutting Machine.jpg',
    features: [
      'Automated cutting with intelligent tool path optimization',
      'Servo-driven cutting head for exceptional precision',
      'Multi-ply cutting capability for bulk production',
      'Vacuum fixation system for stable fabric layering',
      'Direct CAD integration for file-to-cut workflow',
      'Automatic blade wear compensation',
      'User-friendly touchscreen control interface',
      'Energy-efficient operation with low maintenance',
    ],
    highlights: [
      { label: 'Series', value: 'SCOPE Pro' },
      { label: 'Control', value: 'CNC Automated' },
      { label: 'Cutting', value: 'Multi-Ply' },
      { label: 'Best For', value: 'Industrial Production' },
    ],
  },
  {
    id: 'scope-sample-cutter',
    title: 'SCOPE Automatic High Speed Sample Cutting Machine',
    subtitle: 'Rapid Sample Development & Prototyping',
    description: 'A high-speed automatic sample cutting machine designed to accelerate sample development and prototyping. Enables rapid turnaround from design to physical sample with exceptional accuracy and consistency.',
    image: '/images/products/scope-automatic-high-speed-sample-cutter.jpg',
    features: [
      'High-speed cutting for rapid sample development',
      'Precision blade cutting with adjustable depth and force',
      'Ideal for single-ply and small batch cutting',
      'Quick material setup and changeover',
      'Seamless CAD integration for direct file cutting',
      'Compact footprint suitable for design studios',
      'Reduces sample development time dramatically',
      'Consistent quality across all sample pieces',
    ],
    highlights: [
      { label: 'Speed', value: 'High-Speed Cutting' },
      { label: 'Application', value: 'Sample Development' },
      { label: 'Precision', value: 'Blade Cutting' },
      { label: 'Best For', value: 'Design Studios' },
    ],
  },
  {
    id: 'fabric-spreading-machine',
    title: 'SCOPE Automatic Fabric Spreading Machine',
    subtitle: 'Efficient Fabric Spreading for Bulk Production',
    description: 'An automatic fabric spreading machine designed for efficient, consistent fabric layering in high-volume cutting rooms. Ensures tension-free spreading with precise edge alignment to maximize cutting accuracy and minimize fabric waste.',
    image: '/images/products/scope automatic fabric spreading machine.jpg',
    features: [
      'Automatic fabric spreading with consistent tension control',
      'Programmable layer counts for precise production planning',
      'Edge alignment system for accurate fabric positioning',
      'Face-to-face and face-to-one-side spreading modes',
      'Handles woven, knit, and non-woven fabrics',
      'Digital layer counter and end-of-roll auto detection',
      'Automatic cutter bar for clean fabric separation',
      'Reduces fabric waste and improves cutting room productivity',
    ],
    highlights: [
      { label: 'Type', value: 'Automatic Spreader' },
      { label: 'Control', value: 'Programmable' },
      { label: 'Fabrics', value: 'All Types' },
      { label: 'Best For', value: 'Cutting Rooms' },
    ],
  },
];

interface CamDetail {
  id: string;
  title: string;
  subtitle: string;
  overview: string;
  benefits: string[];
  technicalSpecs: { label: string; value: string }[];
  applications: string[];
  whyChoose: string[];
}

const camSolutionsDetails: Record<string, CamDetail> = {
  'cyg-yin-automatic-cutter': {
    id: 'cyg-yin-automatic-cutter',
    title: 'CYG YIN Automatic Fabric Cutting Machine',
    subtitle: 'High-Precision Automatic Fabric Cutting Solution',
    overview: 'The CYG YIN Automatic Fabric Cutting Machine is a high-performance CNC cutting solution designed for modern garment manufacturing. It combines high-speed cutting capability with exceptional precision, enabling manufacturers to significantly increase production throughput while maintaining consistent cut quality. The machine features advanced servo motor control, automatic blade sharpening, and a vacuum table system that securely holds fabrics during cutting.',
    benefits: [
      'Dramatically increase cutting room throughput with automated operation',
      'Achieve consistent cut quality across all production batches',
      'Reduce fabric waste with precision nesting and cutting',
      'Minimize labor dependency with fully automatic cutting process',
      'Seamlessly integrate with existing CAD and production systems',
    ],
    technicalSpecs: [
      { label: 'Cutting Technology', value: 'CNC Automatic Cutting' },
      { label: 'Cutting Head', value: 'Servo Motor Driven' },
      { label: 'Blade System', value: 'Automatic Sharpening' },
      { label: 'Fabric Hold', value: 'Vacuum Table' },
      { label: 'Materials', value: 'Woven, Knit, Non-Woven' },
      { label: 'Connectivity', value: 'CAD Network Integration' },
    ],
    applications: [
      'Bulk fabric cutting for mass production orders',
      'Multi-ply cutting for high-volume manufacturing',
      'Precision cutting of complex pattern pieces',
      'Automated cutting room workflow integration',
      'Large-scale garment manufacturing operations',
    ],
    whyChoose: [
      'Proven performance in high-volume production environments',
      'Precision cutting reduces downstream sewing issues',
      'Significant labor cost savings with automated operation',
      'Backed by Studio Next expert installation and training',
      'Reliable after-sales support and maintenance service',
    ],
  },
  'scope-auto-fabric-cutter': {
    id: 'scope-auto-fabric-cutter',
    title: 'SCOPE Automatic Fabric Cutting Machine',
    subtitle: 'Intelligent Cutting Room Automation',
    overview: 'The SCOPE Automatic Fabric Cutting Machine represents the pinnacle of cutting room automation technology. Engineered for industrial-scale production, it features intelligent tool path optimization, multi-ply cutting capability, and seamless CAD integration. The machine delivers exceptional cutting accuracy while maximizing throughput, making it an indispensable asset for large garment manufacturing facilities.',
    benefits: [
      'Maximize cutting room productivity with automated high-speed cutting',
      'Achieve superior cut quality with intelligent tool path optimization',
      'Reduce material waste through precision cutting and nesting',
      'Streamline operations with direct CAD-to-cut workflow',
      'Lower total cost of ownership with energy-efficient design',
    ],
    technicalSpecs: [
      { label: 'Cutting Technology', value: 'CNC Servo-Driven' },
      { label: 'Cutting Capacity', value: 'Multi-Ply' },
      { label: 'Control System', value: 'Touchscreen CNC' },
      { label: 'Fabric Hold', value: 'Vacuum Fixation' },
      { label: 'Blade System', value: 'Auto Wear Compensation' },
      { label: 'Connectivity', value: 'Direct CAD Integration' },
    ],
    applications: [
      'Industrial-scale fabric cutting for mass production',
      'Multi-ply cutting for bulk manufacturing orders',
      'Automated cutting room for large garment factories',
      'Integration with ERP and production planning systems',
      'High-volume cutting for export-oriented manufacturers',
    ],
    whyChoose: [
      'Industrial-grade construction for 24/7 production',
      'Intelligent software optimizes cutting paths automatically',
      'Proven reliability in demanding manufacturing environments',
      'Comprehensive training and support from Studio Next',
      'Trusted by leading garment manufacturers across India',
    ],
  },
  'scope-sample-cutter': {
    id: 'scope-sample-cutter',
    title: 'SCOPE Automatic High Speed Sample Cutting Machine',
    subtitle: 'Rapid Sample Development & Prototyping',
    overview: 'The SCOPE Automatic High Speed Sample Cutting Machine is purpose-built for design studios and sample rooms that need rapid turnaround from digital design to physical sample. Its high-speed cutting capability and precision blade system enable quick iteration and development, helping brands reduce time-to-market for new styles.',
    benefits: [
      'Accelerate sample development cycle with high-speed cutting',
      'Reduce prototyping time from days to hours',
      'Achieve consistent sample quality across all iterations',
      'Eliminate manual cutting errors for accurate samples',
      'Enable faster design approvals and time-to-market',
    ],
    technicalSpecs: [
      { label: 'Cutting Speed', value: 'High-Speed Operation' },
      { label: 'Cutting Method', value: 'Precision Blade' },
      { label: 'Blade Control', value: 'Adjustable Depth & Force' },
      { label: 'Material Types', value: 'Fabric, Paper, Film' },
      { label: 'Setup Time', value: 'Quick Changeover' },
      { label: 'Connectivity', value: 'CAD Direct Integration' },
    ],
    applications: [
      'Rapid sample cutting for design studios',
      'Prototype development for new garment styles',
      'Small batch production for custom orders',
      'Fit sample cutting for approval process',
      'Pattern testing and validation before bulk cutting',
    ],
    whyChoose: [
      'Fastest sample cutting solution for design studios',
      'Exceptional cut accuracy ensures sample integrity',
      'Compact design fits perfectly in studio environments',
      'Seamless integration with pattern design software',
      'Backed by Studio Next expert support and training',
    ],
  },
  'denim-cutter': {
    id: 'denim-cutter',
    title: 'SCOPE Pro – The Denim Cutter',
    subtitle: 'Specialized Cutting Solution for Denim & Heavy Fabrics',
    overview: 'The SCOPE Pro Denim Cutter is a specialized automatic cutting machine engineered to handle the unique challenges of denim and heavy-weight fabric cutting. With reinforced components, a high-pressure vacuum system, and a specialized blade, it delivers clean, precise cuts through multiple layers of denim, significantly improving productivity for denim manufacturers.',
    benefits: [
      'Achieve clean cuts through multiple layers of denim',
      'Handle rigid, stretch, and blended denim with ease',
      'Increase denim cutting productivity significantly',
      'Reduce fabric waste with precision nesting for denim',
      'Eliminate manual cutting bottlenecks in denim production',
    ],
    technicalSpecs: [
      { label: 'Cutting Type', value: 'Denim & Heavy Fabrics' },
      { label: 'Blade', value: 'Reinforced Heavy-Duty' },
      { label: 'Vacuum', value: 'High-Pressure System' },
      { label: 'Layers', value: 'Multiple Ply Capacity' },
      { label: 'Denim Types', value: 'Rigid, Stretch, Blend' },
      { label: 'Construction', value: 'Heavy-Duty Industrial' },
    ],
    applications: [
      'Bulk denim cutting for jeans and jacket production',
      'Multi-ply cutting of heavy-weight fabrics',
      'Denim garment manufacturing for casual wear brands',
      'High-volume cutting of workwear and uniform fabrics',
      'Specialized cutting for non-woven and technical textiles',
    ],
    whyChoose: [
      'Purpose-built for denim cutting challenges',
      'Proven in leading Indian denim manufacturing units',
      'Superior cut quality reduces downstream rejection',
      'Robust design handles continuous heavy-duty use',
      'Comprehensive support from Studio Next denim specialists',
    ],
  },
  'fabric-spreader': {
    id: 'fabric-spreader',
    title: 'SCOPE Pro HX Series Automatic Fabric Spreader',
    subtitle: 'Precision Spreading for Bulk Production',
    overview: 'The SCOPE Pro HX Series Automatic Fabric Spreader is designed for high-volume cutting rooms that demand consistent, tension-free fabric layering. With programmable controls, automatic edge alignment, and multiple spreading modes, it ensures that fabric lays are perfectly prepared for cutting, reducing waste and improving overall cutting accuracy.',
    benefits: [
      'Ensure consistent fabric layering for accurate cutting',
      'Eliminate fabric distortion with tension-free spreading',
      'Reduce fabric waste with precise edge alignment',
      'Boost productivity with automatic programmable operation',
      'Improve cutting accuracy across all production runs',
    ],
    technicalSpecs: [
      { label: 'Spreading Width', value: 'Up to 72 inches' },
      { label: 'Layer Capacity', value: 'Programmable, up to 300 layers' },
      { label: 'Speed', value: 'Adjustable, up to 100 m/min' },
      { label: 'Fabric Types', value: 'Woven, Knit, Non-woven' },
      { label: 'Alignment', value: 'Automatic Edge Guide' },
      { label: 'Cutting', value: 'Auto Cutter Bar Included' },
    ],
    applications: [
      'Bulk fabric spreading for mass production orders',
      'Multi-ply layering for automatic cutting machines',
      'Face-to-face and face-to-one-side spreading',
      'High-volume denim and woven fabric spreading',
      'Knit fabric spreading with tension control',
    ],
    whyChoose: [
      'Proven reliability in high-volume production environments',
      'Handles the widest range of fabric types with ease',
      'Saves up to 3% fabric compared to manual spreading',
      'Backed by Studio Next expert installation and training',
      'Trusted by leading apparel manufacturers across India',
    ],
  },
  'fabric-spreading-machine': {
    id: 'fabric-spreading-machine',
    title: 'SCOPE Automatic Fabric Spreading Machine',
    subtitle: 'Efficient Fabric Spreading for Bulk Production',
    overview: 'The SCOPE Automatic Fabric Spreading Machine is designed for efficient, consistent fabric layering in high-volume cutting rooms. It delivers tension-free spreading with precise edge alignment to maximize cutting accuracy and minimize fabric waste. With programmable controls, automatic layer counting, and multiple spreading modes, it is an essential tool for modern garment manufacturing facilities aiming to optimize their cutting room operations.',
    benefits: [
      'Achieve consistent fabric layering for improved cutting accuracy',
      'Eliminate fabric distortion with precision tension control',
      'Reduce fabric waste with accurate edge alignment system',
      'Boost cutting room productivity with automatic operation',
      'Minimize labor dependency with programmable spreading cycles',
    ],
    technicalSpecs: [
      { label: 'Spreading Width', value: 'Up to 72 inches' },
      { label: 'Layer Capacity', value: 'Programmable up to 300 layers' },
      { label: 'Spreading Speed', value: 'Adjustable up to 100 m/min' },
      { label: 'Fabric Types', value: 'Woven, Knit, Non-woven' },
      { label: 'Alignment', value: 'Automatic Edge Guide System' },
      { label: 'Cutting', value: 'Automatic Cutter Bar Included' },
    ],
    applications: [
      'Bulk fabric spreading for mass production orders',
      'Multi-ply layering for automatic cutting machines',
      'Face-to-face and face-to-one-side spreading modes',
      'High-volume woven and knit fabric spreading operations',
      'Automated cutting room workflow integration',
    ],
    whyChoose: [
      'Proven reliability in high-volume production environments',
      'Handles a wide range of fabric types with consistent quality',
      'Saves up to 3% fabric compared to manual spreading methods',
      'Backed by Studio Next expert installation and training',
      'Trusted by leading apparel manufacturers across India',
    ],
  },
  'magic-plotter': {
    id: 'magic-plotter',
    title: 'SCOPE Pro Magic Inkjet Plotter',
    subtitle: 'High-Speed, Precision CAD Printing',
    overview: 'The SCOPE Pro Magic Inkjet Plotter is a professional-grade printing solution engineered for high-volume CAD output in garment manufacturing environments. It delivers exceptional print quality at high speeds for patterns, markers, and technical drawings. With robust industrial construction and efficient ink systems, it ensures reliable operation with low running costs.',
    benefits: [
      'Accelerate marker production with high-speed throughput',
      'Achieve crisp, clear prints that reduce interpretation errors',
      'Lower operational costs with efficient ink and media usage',
      'Seamless integration with existing CAD workstations',
      'Minimize downtime with robust, industrial-grade construction',
    ],
    technicalSpecs: [
      { label: 'Print Technology', value: 'Thermal Inkjet' },
      { label: 'Print Speed', value: 'High-Throughput' },
      { label: 'Resolution', value: '600 x 600 DPI' },
      { label: 'Media Width', value: 'Up to 72 inches' },
      { label: 'Media Type', value: 'Roll-fed paper, film' },
      { label: 'Connectivity', value: 'Ethernet, USB' },
    ],
    applications: [
      'Bulk marker printing for mass production',
      'Pattern printing for sample development',
      'Technical specification sheet output',
      'Graded pattern set printing',
      'Production documentation and archiving',
    ],
    whyChoose: [
      'Proven performance in high-volume production environments',
      'Low total cost of ownership with efficient ink system',
      'Robust construction for continuous 24/7 operation',
      'Backed by Studio Next expert support and service',
      'Compatible with all major CAD software formats',
    ],
  },
};

export default function CamSolutionsPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCam, setSelectedCam] = useState<CamDetail | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (!selectedCam) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCam(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [selectedCam]);

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
              <div className="flex items-center mb-10">
                <Image src="/logo-transparent.png" alt="Studio Next - Concept to Creation" width={280} height={92} className="h-14 sm:h-16 w-auto object-contain drop-shadow-sm" />
              </div>
              <nav className="flex flex-col gap-2">
                {[
                  { label: 'HOME', href: '/' },
                  { label: 'ALL PRODUCTS', href: '/products' },
                  { label: 'CAD SOFTWARE', href: '/products/cad-software' },
                  { label: 'CAD HARDWARE', href: '/products/cad-hardware' },
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
      <nav className="relative z-30 w-full px-5 sm:px-8 lg:px-16 py-4 sm:py-6 flex justify-between items-center bg-[#0B2532] text-white">
        <Link href="/" className="flex items-center group">
          <Image src="/logo-transparent.png" alt="Studio Next - Concept to Creation" width={320} height={104} priority className="h-16 sm:h-20 lg:h-24 w-auto object-contain drop-shadow-sm" />
        </Link>

        <div className="hidden lg:flex gap-8 items-center text-[10px] tracking-[0.16em] font-medium uppercase">
          <Link href="/" className="hover:text-[#d29d42] transition-colors relative group">
            HOME
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
          </Link>
          <Link href="/products" className="hover:text-[#d29d42] transition-colors relative group">
            PRODUCTS
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
          </Link>
          <Link href="/products/cad-software" className="hover:text-[#d29d42] transition-colors relative group">
            CAD SOFTWARE
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
          </Link>
          <Link href="/products/cad-hardware" className="hover:text-[#d29d42] transition-colors relative group">
            CAD HARDWARE
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
          </Link>
          <Link href="/products/cam-solutions" className="hover:text-[#d29d42] transition-colors relative group text-[#d29d42]">
            CAM SOLUTIONS
            <span className="absolute -bottom-1 left-0 w-full h-px bg-[#d29d42]"></span>
          </Link>
          <Link href="/#contact" className="hover:text-[#d29d42] transition-colors relative group">
            CONTACT
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
            <div className="flex items-center gap-3 mb-4">
              <Link href="/products" className="text-[#d29d42] text-[10px] tracking-[0.2em] font-semibold uppercase hover:underline">Products</Link>
              <span className="text-white/40 text-xs">/</span>
              <span className="text-white/60 text-[10px] tracking-[0.2em] uppercase">CAM Solutions</span>
            </div>
            <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-4 uppercase">CAM SOLUTIONS</h4>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif text-white mb-6 leading-tight">
              SCOPE Pro <span className="italic text-[#d29d42]">CAM Solutions</span>
            </h1>
            <p className="text-white/80 max-w-2xl text-sm sm:text-base lg:text-lg font-light leading-relaxed">
              Studio Next offers a comprehensive range of CAM (Computer-Aided Manufacturing) solutions — from automatic fabric cutting machines and high-speed sample cutters to specialized denim cutters, fabric spreaders, and professional inkjet plotters. Built for production-ready cutting room automation.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CAM Solutions Grid */}
      <section className="py-16 sm:py-24 lg:py-32 px-5 sm:px-8 lg:px-24 bg-[#EAE7E1]">
        <div className="max-w-screen-2xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-12 sm:mb-16">
              <h4 className="text-[#C7A86D] text-[10px] tracking-[0.3em] font-semibold mb-3 sm:mb-4 uppercase">Our CAM Range</h4>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl text-[#111111] font-serif font-bold">
                Complete CAM <span className="italic text-[#C7A86D]">Solutions</span>
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto mt-4 text-sm font-light">
                Six powerful production-ready solutions designed to automate your cutting room — from automatic fabric cutting and high-speed sample cutting to denim cutting, fabric spreading, and professional plotting.
              </p>
            </div>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
            {camSolutionsList.map((cam, i) => (
              <FadeInSection key={cam.id} delay={i * 120}>
                <div
                  className="h-full rounded-xl bg-white border border-[rgba(0,0,0,0.08)] shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-500 hover:-translate-y-3 hover:border-[#C7A86D] hover:shadow-[0_25px_60px_rgba(199,168,109,0.2)] cursor-pointer group"
                  onClick={() => setSelectedCam(camSolutionsDetails[cam.id])}
                >
                  <div className="relative h-48 sm:h-52 overflow-hidden bg-[#f8f6f1]">
                    <Image
                      src={cam.image}
                      alt={cam.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-contain p-6 transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                  <div className="p-6 sm:p-8">
                    <p className="text-[#C7A86D] text-[10px] tracking-[0.3em] font-semibold uppercase mb-2">{cam.subtitle}</p>
                    <h3 className="text-xl text-[#111111] mb-3 font-serif font-bold leading-tight">{cam.title}</h3>
                    <p className="text-sm text-[#5F6368] font-normal leading-relaxed mb-4">{cam.description}</p>
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {cam.highlights.map((h) => (
                        <div key={h.label} className="bg-[#EAE7E1] rounded-lg p-2.5">
                          <p className="text-[9px] tracking-[0.1em] uppercase text-[#5F6368] font-semibold">{h.label}</p>
                          <p className="text-xs font-bold text-[#111111] mt-0.5">{h.value}</p>
                        </div>
                      ))}
                    </div>
                    <ul className="space-y-2 mb-5">
                      {cam.features.slice(0, 4).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs text-[#5F6368]">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#C7A86D] shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCam(camSolutionsDetails[cam.id]);
                      }}
                      className="inline-flex items-center gap-2 text-[#C7A86D] text-[11px] tracking-[0.16em] font-semibold uppercase border-b border-[#C7A86D]/60 hover:text-[#1e2f27] hover:border-[#1e2f27]/40 transition-colors"
                    >
                      View Details
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>
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
              <div className="flex items-center mb-6">
                <Image src="/logo-transparent.png" alt="Studio Next - Concept to Creation" width={320} height={104} className="h-16 sm:h-20 lg:h-24 w-auto object-contain drop-shadow-sm" />
              </div>
              <p className="text-[#84a395] text-sm font-light leading-relaxed max-w-sm">
                Studio Next is a leading CAD/CAM solutions provider delivering innovative, reliable cutting room automation and tailored services.
              </p>
            </div>
            <div>
              <h4 className="text-[#d29d42] text-[10px] tracking-[0.2em] font-bold mb-5 sm:mb-6 uppercase">PRODUCTS</h4>
              <ul className="space-y-3 sm:space-y-4 text-sm text-[#84a395] font-light">
                <li><Link href="/products/cad-software" className="hover:text-[#d29d42] transition-colors">CAD Software</Link></li>
                <li><Link href="/products/cad-hardware" className="hover:text-[#d29d42] transition-colors">CAD Hardware</Link></li>
                <li><Link href="/products/cam-solutions" className="hover:text-[#d29d42] transition-colors">CAM Solutions</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[#d29d42] text-[10px] tracking-[0.2em] font-bold mb-5 sm:mb-6 uppercase">CONTACT</h4>
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

      {/* CAM Detail Modal */}
      <AnimatePresence>
        {selectedCam && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 z-100 bg-black/60 backdrop-blur-xl"
              onClick={() => setSelectedCam(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 100, scale: 0.9, rotateX: 15 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 1 }}
              className="fixed inset-0 z-101 flex items-center justify-center p-4 md:p-8"
              role="dialog"
              aria-modal="true"
              onClick={() => setSelectedCam(null)}
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
                    onClick={() => setSelectedCam(null)}
                    className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                    }}
                    whileHover={{ scale: 1.1, background: 'rgba(255, 255, 255, 0.2)' }}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Close"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M1 1L17 17M1 17L17 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </motion.button>

                  <div className="pr-8">
                    <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-3 uppercase">CAM Solution Details</h4>
                    <h2 className="text-2xl md:text-3xl font-serif text-white mb-2">{selectedCam.title}</h2>
                    <p className="text-[#d29d42] text-sm font-light">{selectedCam.subtitle}</p>
                  </div>

                  <div className="flex items-center gap-4 my-6">
                    <div className="h-px flex-1 bg-linear-to-r from-[#d29d42]/40 to-transparent" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d29d42]" />
                    <div className="h-px flex-1 bg-linear-to-l from-[#d29d42]/40 to-transparent" />
                  </div>

                  {/* Overview */}
                  <div className="mb-6">
                    <h3 className="text-[#d29d42] text-xs tracking-[0.14em] uppercase mb-3 font-semibold">Overview</h3>
                    <p className="text-white/85 font-light leading-relaxed text-[15px]">
                      {selectedCam.overview}
                    </p>
                  </div>

                  {/* Key Benefits */}
                  <div className="mb-6">
                    <h3 className="text-[#d29d42] text-xs tracking-[0.14em] uppercase mb-3 font-semibold">Key Benefits</h3>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {selectedCam.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2 text-white/85 text-sm">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#d29d42] shrink-0" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Technical Specs */}
                  <div className="mb-6">
                    <h3 className="text-[#d29d42] text-xs tracking-[0.14em] uppercase mb-3 font-semibold">Technical Specifications</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedCam.technicalSpecs.map((spec) => (
                        <div key={spec.label} className="bg-white/5 rounded-lg p-3 border border-white/10">
                          <p className="text-[9px] tracking-[0.1em] uppercase text-[#d29d42] font-semibold">{spec.label}</p>
                          <p className="text-white text-sm font-medium mt-1">{spec.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Applications */}
                  <div className="mb-6">
                    <h3 className="text-[#d29d42] text-xs tracking-[0.14em] uppercase mb-3 font-semibold">Applications</h3>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {selectedCam.applications.map((app) => (
                        <li key={app} className="flex items-start gap-2 text-white/85 text-sm">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#d29d42] shrink-0" />
                          <span>{app}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Why Choose */}
                  <div className="mb-8">
                    <h3 className="text-[#d29d42] text-xs tracking-[0.14em] uppercase mb-3 font-semibold">Why Choose This Solution?</h3>
                    <ul className="space-y-2">
                      {selectedCam.whyChoose.map((reason) => (
                        <li key={reason} className="flex items-start gap-2 text-white/85 text-sm">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#d29d42] shrink-0" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <motion.button
                    onClick={() => setSelectedCam(null)}
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
    </div>
  );
}

