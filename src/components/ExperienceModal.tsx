'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import type { Experience } from '../lib/experiences-data';

interface ExperienceModalProps {
  experience: Experience | null;
  isOpen: boolean;
  onClose: () => void;
}

const modalGradients = [
  'radial-gradient(120% 100% at 20% 10%, #2f6a50 0%, #183a2d 45%, #071512 100%)',
  'radial-gradient(120% 100% at 20% 10%, #3a6384 0%, #1d3552 45%, #081523 100%)',
  'radial-gradient(120% 100% at 20% 10%, #6a5b3f 0%, #3b2f1e 45%, #161006 100%)',
  'radial-gradient(120% 100% at 20% 10%, #5f476d 0%, #312140 45%, #12081c 100%)',
  'radial-gradient(120% 100% at 20% 10%, #536948 0%, #2a3d26 45%, #0d160b 100%)',
];

function getExperienceGradient(name: string): string {
  const hash = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return modalGradients[hash % modalGradients.length];
}

export default function ExperienceModal({ experience, isOpen, onClose }: ExperienceModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!experience) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with heavy glassmorphism blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-100 bg-black/60 backdrop-blur-xl"
            onClick={onClose}
          />

          {/* 3D Glass Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9, rotateX: 15 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 100, scale: 0.9, rotateX: 15 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 25,
              mass: 1,
            }}
            className="fixed inset-0 z-101 flex items-center justify-center p-4 md:p-8"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="experience-modal-title"
            aria-describedby="experience-modal-description"
          >
            <div
              className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 80px -20px rgba(210, 157, 66, 0.15)',
                transformStyle: 'preserve-3d',
                perspective: '1000px',
              }}
            >
              {/* Glacy glass fill overlay */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(30, 47, 39, 0.85) 0%, rgba(23, 37, 31, 0.95) 100%)',
                }}
              />

              {/* Subtle gold shimmer effect */}
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                animate={{
                  background: [
                    'radial-gradient(ellipse at 20% 20%, rgba(210, 157, 66, 0.08) 0%, transparent 50%)',
                    'radial-gradient(ellipse at 80% 80%, rgba(210, 157, 66, 0.08) 0%, transparent 50%)',
                    'radial-gradient(ellipse at 20% 20%, rgba(210, 157, 66, 0.08) 0%, transparent 50%)',
                  ],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />

              {/* Content */}
              <div className="relative z-10 overflow-y-auto max-h-[90vh]">
                {/* Close button */}
                <motion.button
                  ref={closeButtonRef}
                  onClick={onClose}
                  className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                  }}
                  whileHover={{ scale: 1.1, background: 'rgba(255, 255, 255, 0.2)' }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Close experience details"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L17 17M1 17L17 1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </motion.button>

                {/* Header image */}
                <div className="relative h-64 md:h-80 w-full overflow-hidden bg-[#1e2f27]">
                  {experience.image ? (
                    <>
                      <Image
                        src={experience.image}
                        alt={experience.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 768px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-[#1e2f27]/20" />
                    </>
                  ) : (
                    <div className="absolute inset-0" style={{ background: getExperienceGradient(experience.name) }} />
                  )}
                  <div className="absolute inset-0 bg-linear-to-t from-[#1e2f27]/95 via-[#1e2f27]/45 to-[#1e2f27]/20" />

                  {/* Floating title on header */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="absolute bottom-6 left-6 md:bottom-8 md:left-8"
                  >
                    <h2 id="experience-modal-title" className="text-3xl md:text-4xl font-serif text-white">
                      {experience.name}
                    </h2>
                  </motion.div>
                </div>

                {/* Description Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="p-6 md:p-8"
                >
                  {/* Decorative divider */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-1 bg-linear-to-r from-[#d29d42]/40 to-transparent" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d29d42]" />
                    <div className="h-px flex-1 bg-linear-to-l from-[#d29d42]/40 to-transparent" />
                  </div>

                  {/* Description */}
                  <p id="experience-modal-description" className="text-white/80 font-light leading-relaxed text-[15px] mb-8">
                    {experience.description}
                  </p>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <motion.button
                      onClick={onClose}
                      className="w-full py-3 px-6 rounded-xl text-sm font-medium transition-all duration-300"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'rgba(255, 255, 255, 0.8)',
                      }}
                      whileHover={{ background: 'rgba(255, 255, 255, 0.12)', scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Close
                    </motion.button>
                  </div>
                </motion.div>
              </div>

              {/* 3D depth edge highlight */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.15)',
                }}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
