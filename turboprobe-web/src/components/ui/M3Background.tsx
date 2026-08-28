import React from 'react';
import { motion } from 'framer-motion';

export const M3Background: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none transition-colors duration-300">
      {/* 1. Subtle M3 Dot-Matrix Grid with Center Fade */}
      <div
        className="absolute inset-0 z-10 transition-opacity duration-200"
        style={{
          backgroundImage: `radial-gradient(circle, var(--bg-dot-color) 1.1px, transparent 1.1px)`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, black 20%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, black 20%, transparent 90%)',
        }}
      />

      {/* 2. Google Pixel / Material You Ambient Living Mesh (Dynamic Tonal Glows) */}

      {/* Primary Terracotta Tonal Aura (Centers around the Hero Command Card) */}
      <motion.div
        animate={{
          x: [-40, 40, -40],
          y: [-30, 30, -30],
          scale: [0.95, 1.12, 0.95],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-[12%] left-1/2 -translate-x-1/2 w-[42rem] h-[32rem] sm:w-[54rem] sm:h-[40rem] rounded-full blur-[110px] pointer-events-none opacity-40 dark:opacity-28"
        style={{
          background: 'radial-gradient(circle, #C25E30 0%, #9C3D15 50%, transparent 75%)',
        }}
      />

      {/* Secondary Warm Amber Orb (Floating across top-right) */}
      <motion.div
        animate={{
          x: [30, -50, 30],
          y: [-25, 35, -25],
          scale: [1.05, 0.92, 1.05],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-[5%] right-[10%] w-[28rem] h-[28rem] sm:w-[38rem] sm:h-[38rem] rounded-full blur-[120px] pointer-events-none opacity-30 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, #E08244 0%, #B45309 60%, transparent 80%)',
        }}
      />

      {/* Tertiary Soft Bronze / Golden Glow (Floating across bottom-left) */}
      <motion.div
        animate={{
          x: [-35, 45, -35],
          y: [30, -25, 30],
          scale: [0.92, 1.08, 0.92],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute bottom-[8%] left-[8%] w-[32rem] h-[32rem] sm:w-[42rem] sm:h-[42rem] rounded-full blur-[130px] pointer-events-none opacity-25 dark:opacity-18"
        style={{
          background: 'radial-gradient(circle, #D97706 0%, #92400E 60%, transparent 80%)',
        }}
      />

      {/* Subtle Micro Vignette Gradient around viewport borders */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 50%, var(--bg-app) 100%)',
        }}
      />
    </div>
  );
};
