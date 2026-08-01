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

// CAD Hardware Products Data
const cadHardwareList = [
  {
    id: 'scope-inkjet-plotter',
    title: 'SCOPE Inkjet Plotter',
    subtitle: 'High-Speed, Precision CAD Printing Solution',
    description: 'A professional inkjet plotter designed for high-volume pattern and marker printing. Delivers crisp, accurate outputs at high speeds, making it the ideal choice for busy cutting rooms and production environments.',
    image: '/images/products/scope-inkjet-plotter.png',
    features: [
      'High-speed printing for bulk marker and pattern output',
      'Precision inkjet technology with sharp, smudge-resistant prints',
      'Supports roll-fed media for continuous production',
      'Low operating cost with efficient ink consumption',
      'Network-ready for seamless integration with CAD workstations',
      'Durable build designed for 24/7 production environments',
      'Compatible with all major CAD file formats',
      'Easy media loading and user-friendly operation panel',
    ],
    highlights: [
      { label: 'Technology', value: 'Inkjet Printing' },
      { label: 'Media', value: 'Roll-Fed Paper' },
      { label: 'Speed', value: 'High-Throughput' },
      { label: 'Best For', value: 'Bulk Production' },
    ],
  },
  {
    id: 'scope-vertical-cutter-plotter',
    title: 'SCOPE Vertical Inkjet Cutter Plotter',
    subtitle: 'All-in-One Cutting & Drawing Solution',
    description: 'A versatile vertical inkjet cutter plotter that combines high-precision cutting with CAD drawing capabilities. Perfect for sample making, pattern cutting, and small batch production with exceptional accuracy.',
    image: '/images/products/scope-vertical-all-in-one-cutter-plotter.jpg',
    features: [
      'Dual-function: CAD drawing and precision cutting in one machine',
      'Vertical design saves valuable floor space',
      'Automatic tool head switching between pen and blade',
      'Cuts a wide range of materials including paper, cardstock, and film',
      'High-precision servo motor for accurate cuts',
      'Network connectivity for direct CAD file transfer',
      'Easy-to-use control software included',
      'Ideal for sample rooms and small-batch production',
    ],
    highlights: [
      { label: 'Function', value: 'Draw & Cut' },
      { label: 'Design', value: 'Vertical Stand' },
      { label: 'Precision', value: 'Servo Motor' },
      { label: 'Best For', value: 'Sample Rooms' },
    ],
  },
  {
    id: 'flatbed-cutting-plotter',
    title: 'Flatbed Inkjet Cutting Plotter',
    subtitle: 'High-Speed Precision Sample Cutting',
    description: 'A high-precision flatbed cutting plotter designed for rapid sample cutting and small batch production. Combines inkjet printing with precision blade cutting for streamlined workflow from design to finished sample.',
    image: '/images/products/flatbed-inkjet-cutting-plotter-high-speed.jpg',
    features: [
      'Flatbed design for precise, stable cutting of sample pieces',
      'High-speed inkjet printing with integrated cutting capability',
      'Ideal for sampling, prototyping, and short-run production',
      'Precision blade cutting with adjustable depth and force',
      'Handles a wide variety of materials including fabric, paper, and film',
      'CAD-integrated workflow for seamless file-to-cut operation',
      'Compact design suitable for design studios and sample rooms',
      'Reduces sample development time significantly',
    ],
    highlights: [
      { label: 'Type', value: 'Flatbed Cutter/Printer' },
      { label: 'Speed', value: 'High-Speed Sample Cutting' },
      { label: 'Precision', value: 'Blade + Inkjet' },
      { label: 'Best For', value: 'Sample Development' },
    ],
  },
  {
    id: 'pattern-digitizer',
    title: 'Pattern Digitizer',
    subtitle: 'Convert Physical Patterns to Digital CAD Files',
    description: 'A professional pattern digitizer that converts physical pattern pieces into precise digital CAD files. Eliminate manual digitizing errors and accelerate your pattern digitization process with high-accuracy optical technology.',
    image: '/images/products/pattern-digitizer.png',
    features: [
      'High-accuracy optical digitizing of physical pattern pieces',
      'Convert patterns to all major CAD formats including DXF',
      'Large digitizing area for full-size garment patterns',
      'Eliminates manual point-by-point digitizing errors',
      'Accelerates pattern archiving and digital library creation',
      'User-friendly interface with real-time preview',
      'Compatible with all major CAD software platforms',
      'Ideal for converting legacy paper patterns to digital',
    ],
    highlights: [
      { label: 'Technology', value: 'Optical Digitizing' },
      { label: 'Output', value: 'Digital CAD Patterns' },
      { label: 'Accuracy', value: 'High-Precision' },
      { label: 'Best For', value: 'Pattern Archiving' },
    ],
  },
  {
    id: 'scope-pro-vertical-cutter-plotter',
    title: 'SCOPE Pro Vertical Inkjet Cutter Plotter',
    subtitle: 'Automatic, Efficient & Precise Cutting Solution',
    description: 'An advanced pro-grade vertical inkjet cutter plotter designed for demanding production environments. Features automatic tool operation, high-speed cutting, and precision engineering for consistent, reliable performance.',
    image: '/images/products/scope-pro-vertical-inkjet-cutter-plotter.jpg',
    features: [
      'Professional-grade vertical design for heavy-duty production use',
      'Automatic tool head with intelligent pen and blade switching',
      'High-speed cutting for increased throughput in production',
      'Precision servo motor ensures accurate, repeatable cuts',
      'Network-ready for seamless CAD workstation integration',
      'Handles paper, cardstock, film, and light materials',
      'Robust construction for continuous production operation',
      'Ideal for high-volume sample and pattern cutting',
    ],
    highlights: [
      { label: 'Grade', value: 'Professional' },
      { label: 'Operation', value: 'Automatic Tool Head' },
      { label: 'Speed', value: 'High-Speed Production' },
      { label: 'Best For', value: 'Heavy-Duty Use' },
    ],
  },
  {
    id: 'scope-pro-spreader',
    title: 'SCOPE Pro HX Series Automatic Fabric Spreader',
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
      { label: 'Best For', value: 'Bulk Cutting' },
    ],
  },
];

interface HardwareDetail {
  id: string;
  title: string;
  subtitle: string;
  overview: string;
  benefits: string[];
  technicalSpecs: { label: string; value: string }[];
  applications: string[];
  whyChoose: string[];
}

const hardwareDetails: Record<string, HardwareDetail> = {
  'scope-inkjet-plotter': {
    id: 'scope-inkjet-plotter',
    title: 'SCOPE Inkjet Plotter',
    subtitle: 'High-Speed, Precision CAD Printing Solution',
    overview: 'The SCOPE Inkjet Plotter is a professional-grade printing solution engineered for the demanding environment of garment manufacturing. It delivers high-speed, high-quality CAD prints for patterns, markers, and technical drawings. Built with robust industrial components, it ensures reliable operation even under continuous production schedules, making it a trusted choice for cutting rooms across India.',
    benefits: [
      'Accelerate marker production with high-speed throughput',
      'Achieve crisp, clear prints that reduce interpretation errors',
      'Lower operational costs with efficient ink and media usage',
      'Seamless integration with existing CAD workstations',
      'Minimize downtime with robust, industrial-grade construction',
    ],
    technicalSpecs: [
      { label: 'Print Technology', value: 'Thermal Inkjet' },
      { label: 'Media Width', value: 'Up to 72 inches' },
      { label: 'Resolution', value: '600 x 600 DPI' },
      { label: 'Connectivity', value: 'Ethernet, USB' },
      { label: 'Media Type', value: 'Roll-fed paper, film' },
      { label: 'Support', value: 'Remote & On-site' },
    ],
    applications: [
      'Bulk marker printing for mass production',
      'Pattern printing for sample development',
      'Technical specification sheet output',
      'Graded pattern set printing',
      'Production documentation and archiving',
    ],
    whyChoose: [
      'Trusted by leading garment manufacturers across India',
      'Proven reliability in 24/7 production environments',
      'Backed by Studio Next expert support and service team',
      'Cost-effective total cost of ownership',
      'Compatible with all major CAD software formats',
    ],
  },
  'scope-vertical-cutter-plotter': {
    id: 'scope-vertical-cutter-plotter',
    title: 'SCOPE Vertical Inkjet Cutter Plotter',
    subtitle: 'All-in-One Cutting & Drawing Solution',
    overview: 'The SCOPE Vertical Inkjet Cutter Plotter is a space-saving, dual-function machine that combines precise CAD drawing with automatic cutting capabilities. Its vertical design makes it ideal for studios and sample rooms where floor space is at a premium. With automatic tool switching between pen and blade, it streamlines workflows from pattern design to physical sample production.',
    benefits: [
      'Save valuable floor space with vertical stand design',
      'Eliminate manual cutting with automated precision cutting',
      'Streamline sample room workflow with draw-and-cut capability',
      'Achieve consistent cut quality with servo motor precision',
      'Reduce turnaround time for sample development',
    ],
    technicalSpecs: [
      { label: 'Functions', value: 'Drawing & Cutting' },
      { label: 'Tool Head', value: 'Automatic Pen/Blade Switch' },
      { label: 'Motor', value: 'High-Precision Servo' },
      { label: 'Cutting Force', value: 'Up to 500g' },
      { label: 'Media Types', value: 'Paper, Cardstock, Film' },
      { label: 'Connectivity', value: 'Ethernet, USB' },
    ],
    applications: [
      'Sample pattern cutting for design studios',
      'Small batch production of cut pieces',
      'Cardboard template cutting for grading',
      'Technical drawing output for specification sheets',
      'Prototype development and rapid iteration',
    ],
    whyChoose: [
      'Unique vertical design for space-constrained studios',
      'Dual functionality eliminates need for separate machines',
      'Precision servo motor ensures accurate cuts every time',
      'Easy integration with existing pattern design software',
      'Comprehensive training and support from Studio Next',
    ],
  },
  'flatbed-cutting-plotter': {
    id: 'flatbed-cutting-plotter',
    title: 'Flatbed Inkjet Cutting Plotter',
    subtitle: 'High-Speed Precision Sample Cutting',
    overview: 'The Flatbed Inkjet Cutting Plotter is a versatile solution for design studios and sample rooms needing rapid turnaround from concept to physical sample. Combining high-speed inkjet printing with precision blade cutting on a stable flatbed surface, it enables seamless transition from CAD design to cut piece without manual intervention. Ideal for rapid prototyping, sample development, and short-run production.',
    benefits: [
      'Accelerate sample development with integrated print-and-cut workflow',
      'Achieve precise cuts with flatbed stability and accuracy',
      'Eliminate manual cutting errors for consistent sample quality',
      'Reduce material waste with optimized nesting during cutting',
      'Streamline design-to-sample pipeline for faster approvals',
    ],
    technicalSpecs: [
      { label: 'Bed Type', value: 'Flatbed' },
      { label: 'Functions', value: 'Printing & Cutting' },
      { label: 'Cutting Method', value: 'Precision Blade' },
      { label: 'Print Technology', value: 'Inkjet' },
      { label: 'Materials', value: 'Fabric, Paper, Film' },
      { label: 'Connectivity', value: 'Ethernet, USB' },
    ],
    applications: [
      'Rapid sample cutting for design studios',
      'Prototype development for new garment styles',
      'Short-run production of cut pieces',
      'Technical pattern cutting for fittings',
      'Small batch custom orders and made-to-measure',
    ],
    whyChoose: [
      'Integrated print-and-cut saves time and reduces handling',
      'Flatbed design ensures consistent, accurate cuts every time',
      'Perfect complement to digital pattern design workflows',
      'Compact footprint ideal for studio environments',
      'Backed by Studio Next expert installation and training',
    ],
  },
  'pattern-digitizer': {
    id: 'pattern-digitizer',
    title: 'Pattern Digitizer',
    subtitle: 'Convert Physical Patterns to Digital CAD Files',
    overview: 'The Pattern Digitizer is an essential tool for garment manufacturers looking to build a digital pattern library from physical patterns. Using high-accuracy optical technology, it captures every contour, notch, and detail of physical pattern pieces and converts them into precise digital CAD files. This eliminates hours of manual digitizing work and ensures pattern fidelity for repeat production runs.',
    benefits: [
      'Eliminate manual digitizing errors for consistent pattern accuracy',
      'Rapidly build a digital pattern library from physical archives',
      'Preserve legacy patterns in reusable digital formats',
      'Accelerate onboarding of new styles from physical samples',
      'Reduce pattern development costs with faster digitizing workflow',
    ],
    technicalSpecs: [
      { label: 'Technology', value: 'Optical Scanning' },
      { label: 'Digitizing Area', value: 'Full garment pattern size' },
      { label: 'Output Formats', value: 'DXF, AAMA, and more' },
      { label: 'Accuracy', value: 'Sub-millimeter precision' },
      { label: 'Speed', value: 'Up to 5x faster than manual' },
      { label: 'Compatibility', value: 'All major CAD platforms' },
    ],
    applications: [
      'Convert legacy paper patterns to digital format',
      'Digitize physical samples for reproduction',
      'Build digital pattern library for brand archives',
      'Quickly replicate patterns from existing garments',
      'Standardize patterns across multiple manufacturing units',
    ],
    whyChoose: [
      'Highest accuracy optical digitizing for garment patterns',
      'Eliminates need for expensive digitizing tablets',
      'Seamless integration with GetonAgain and other CAD software',
      'Backed by Studio Next expert support team',
      'Proven solution trusted by leading manufacturers',
    ],
  },
  'scope-pro-vertical-cutter-plotter': {
    id: 'scope-pro-vertical-cutter-plotter',
    title: 'SCOPE Pro Vertical Inkjet Cutter Plotter',
    subtitle: 'Automatic, Efficient & Precise Cutting Solution',
    overview: 'The SCOPE Pro Vertical Inkjet Cutter Plotter is built for demanding production environments that require consistent, high-quality cutting day after day. With its professional-grade construction, automatic tool head operation, and high-speed cutting capabilities, it delivers reliable performance for high-volume pattern cutting and sample production. The vertical design saves valuable floor space while maximizing productivity.',
    benefits: [
      'Boost production cutting throughput with high-speed operation',
      'Reduce manual labor with automatic tool head switching',
      'Save floor space with space-efficient vertical design',
      'Achieve consistent cut quality across all production runs',
      'Minimize downtime with robust professional-grade construction',
    ],
    technicalSpecs: [
      { label: 'Grade', value: 'Professional / Production' },
      { label: 'Functions', value: 'Automatic Draw & Cut' },
      { label: 'Tool Head', value: 'Auto Pen/Blade Switch' },
      { label: 'Motor', value: 'Industrial Servo' },
      { label: 'Cutting Force', value: 'Up to 800g' },
      { label: 'Connectivity', value: 'Ethernet, USB, Wi-Fi' },
    ],
    applications: [
      'High-volume pattern cutting for production',
      'Heavy-duty sample cutting for bulk orders',
      'Automated drawing and cutting for marker planning',
      'Template and stencil cutting for repeat production',
      'Integration with automatic cutting room workflows',
    ],
    whyChoose: [
      'Professional-grade construction for continuous production use',
      'Faster cutting speeds than standard plotters',
      'Automatic operation reduces need for operator intervention',
      'Backed by Studio Next comprehensive service and support',
      'Trusted by leading garment manufacturers across India',
    ],
  },
  'scope-pro-spreader': {
    id: 'scope-pro-spreader',
    title: 'SCOPE Pro HX Series Automatic Fabric Spreader',
    subtitle: 'Precision Spreading for Bulk Production',
    overview: 'The SCOPE Pro HX Series is an advanced automatic fabric spreading machine designed to handle high-volume cutting room operations. It delivers consistent, tension-free fabric layering with programmable layer counts and precise edge alignment. This machine significantly improves cutting accuracy while reducing fabric waste, making it an essential tool for bulk garment manufacturing.',
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
};

export default function CadHardwarePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedHardware, setSelectedHardware] = useState<HardwareDetail | null>(null);
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
    if (!selectedHardware) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedHardware(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [selectedHardware]);

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
                  { label: 'ALL PRODUCTS', href: '/products' },
                  { label: 'CAD SOFTWARE', href: '/products/cad-software' },
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
          <Link href="/products" className="hover:text-[#d29d42] transition-colors relative group">
            PRODUCTS
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
          </Link>
          <Link href="/products/cad-software" className="hover:text-[#d29d42] transition-colors relative group">
            CAD SOFTWARE
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
          </Link>
          <Link href="/products/cad-hardware" className="hover:text-[#d29d42] transition-colors relative group text-[#d29d42]">
            CAD HARDWARE
            <span className="absolute -bottom-1 left-0 w-full h-px bg-[#d29d42]"></span>
          </Link>
          <Link href="/products/cam-solutions" className="hover:text-[#d29d42] transition-colors relative group">
            CAM SOLUTIONS
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-[#d29d42] transition-all duration-300 group-hover:w-full"></span>
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
              <span className="text-white/60 text-[10px] tracking-[0.2em] uppercase">CAD Hardware</span>
            </div>
            <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-4 uppercase">CAD HARDWARE</h4>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-serif text-white mb-6 leading-tight">
              SCOPE Professional <span className="italic text-[#d29d42]">Hardware</span>
            </h1>
            <p className="text-white/80 max-w-2xl text-sm sm:text-base lg:text-lg font-light leading-relaxed">
              Studio Next offers a comprehensive range of SCOPE CAD hardware — from high-speed inkjet plotters and precision cutter plotters to pattern digitizers and automatic fabric spreading machines. Built for reliability and precision in demanding production environments.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Hardware Grid */}
      <section className="py-16 sm:py-24 lg:py-32 px-5 sm:px-8 lg:px-24 bg-[#EAE7E1]">
        <div className="max-w-screen-2xl mx-auto">
          <FadeInSection>
            <div className="text-center mb-12 sm:mb-16">
              <h4 className="text-[#C7A86D] text-[10px] tracking-[0.3em] font-semibold mb-3 sm:mb-4 uppercase">Our Hardware Range</h4>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl text-[#111111] font-serif font-bold">
                Complete CAD <span className="italic text-[#C7A86D]">Hardware</span>
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto mt-4 text-sm font-light">
                Six powerful hardware solutions designed to streamline your cutting room — from high-speed plotting and precision cutting to pattern digitizing and automated spreading.
              </p>
            </div>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10">
            {cadHardwareList.map((hardware, i) => (
              <FadeInSection key={hardware.id} delay={i * 120}>
                <div
                  className="h-full rounded-xl bg-white border border-[rgba(0,0,0,0.08)] shadow-[0_10px_30px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-500 hover:-translate-y-3 hover:border-[#C7A86D] hover:shadow-[0_25px_60px_rgba(199,168,109,0.2)] cursor-pointer group"
                  onClick={() => setSelectedHardware(hardwareDetails[hardware.id])}
                >
                  <div className="relative h-48 sm:h-52 overflow-hidden bg-[#f8f6f1]">
                    <Image
                      src={hardware.image}
                      alt={hardware.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-contain p-6 transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                  <div className="p-6 sm:p-8">
                    <p className="text-[#C7A86D] text-[10px] tracking-[0.3em] font-semibold uppercase mb-2">{hardware.subtitle}</p>
                    <h3 className="text-xl text-[#111111] mb-3 font-serif font-bold leading-tight">{hardware.title}</h3>
                    <p className="text-sm text-[#5F6368] font-normal leading-relaxed mb-4">{hardware.description}</p>
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {hardware.highlights.map((h) => (
                        <div key={h.label} className="bg-[#EAE7E1] rounded-lg p-2.5">
                          <p className="text-[9px] tracking-[0.1em] uppercase text-[#5F6368] font-semibold">{h.label}</p>
                          <p className="text-xs font-bold text-[#111111] mt-0.5">{h.value}</p>
                        </div>
                      ))}
                    </div>
                    <ul className="space-y-2 mb-5">
                      {hardware.features.slice(0, 4).map((feature) => (
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
                        setSelectedHardware(hardwareDetails[hardware.id]);
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
              <div className="flex items-center gap-4 mb-5 sm:mb-6">
                <Image src="/logo-s.png" alt="Logo" width={52} height={52} className="object-cover object-left" />
                <div>
                  <h3 className="text-xl sm:text-2xl font-serif tracking-wide">STUDIO NEXT<span className="align-super text-[0.55em] leading-none ml-0.5">TM</span></h3>
                  <span className="text-[#d29d42] text-[8px] tracking-[0.3em] font-medium uppercase mt-1">Concept to creation</span>
                </div>
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

      {/* Hardware Detail Modal */}
      <AnimatePresence>
        {selectedHardware && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="fixed inset-0 z-100 bg-black/60 backdrop-blur-xl"
              onClick={() => setSelectedHardware(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 100, scale: 0.9, rotateX: 15 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 1 }}
              className="fixed inset-0 z-101 flex items-center justify-center p-4 md:p-8"
              role="dialog"
              aria-modal="true"
              onClick={() => setSelectedHardware(null)}
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
                    onClick={() => setSelectedHardware(null)}
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
                    <h4 className="text-[#d29d42] text-[10px] tracking-[0.3em] font-bold mb-3 uppercase">Hardware Details</h4>
                    <h2 className="text-2xl md:text-3xl font-serif text-white mb-2">{selectedHardware.title}</h2>
                    <p className="text-[#d29d42] text-sm font-light">{selectedHardware.subtitle}</p>
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
                      {selectedHardware.overview}
                    </p>
                  </div>

                  {/* Key Benefits */}
                  <div className="mb-6">
                    <h3 className="text-[#d29d42] text-xs tracking-[0.14em] uppercase mb-3 font-semibold">Key Benefits</h3>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {selectedHardware.benefits.map((benefit) => (
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
                      {selectedHardware.technicalSpecs.map((spec) => (
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
                      {selectedHardware.applications.map((app) => (
                        <li key={app} className="flex items-start gap-2 text-white/85 text-sm">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#d29d42] shrink-0" />
                          <span>{app}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Why Choose */}
                  <div className="mb-8">
                    <h3 className="text-[#d29d42] text-xs tracking-[0.14em] uppercase mb-3 font-semibold">Why Choose This Hardware?</h3>
                    <ul className="space-y-2">
                      {selectedHardware.whyChoose.map((reason) => (
                        <li key={reason} className="flex items-start gap-2 text-white/85 text-sm">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#d29d42] shrink-0" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <motion.button
                    onClick={() => setSelectedHardware(null)}
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

