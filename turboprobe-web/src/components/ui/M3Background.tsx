import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export const M3_SHAPES = {
  // 1. 4-Point Smooth Star (Pixel Star / Gemini Sparkle)
  star4: 'M 50 0 C 50 27.614 27.614 50 0 50 C 27.614 50 50 72.386 50 100 C 50 72.386 72.386 50 100 50 C 72.386 50 50 27.614 50 0 Z',

  // 2. Cookie (9-Lobe Scallop - Android 15 Quick Settings & Widgets)
  cookie: 'M 50 0 C 65 0 75 10 85 15 C 95 20 100 35 100 50 C 100 65 90 75 85 85 C 80 95 65 100 50 100 C 35 100 20 95 15 85 C 10 75 0 65 0 50 C 0 35 10 20 15 15 C 20 10 35 0 50 0 Z',

  // 3. 4-Leaf Organic Clover
  clover: 'M 50 15 C 62 2 85 8 85 28 C 85 40 72 45 60 50 C 72 55 85 60 85 72 C 85 92 62 98 50 85 C 38 98 15 92 15 72 C 15 60 28 55 40 50 C 28 45 15 40 15 28 C 15 8 38 2 50 15 Z',

  // 4. Sunny Sunburst (12-Point Soft Sun)
  sunny: 'M 50 4 C 58 4 63 12 70 14 C 77 17 84 21 88 28 C 92 35 91 43 93 50 C 91 57 92 65 88 72 C 84 79 77 83 70 86 C 63 88 58 96 50 96 C 42 96 37 88 30 86 C 23 83 16 79 12 72 C 8 65 9 57 7 50 C 9 43 8 35 12 28 C 16 21 23 17 30 14 C 37 12 42 4 50 4 Z',

  // 5. G2 Superellipse Squircle
  squircle: 'M 50 0 C 82 0 100 18 100 50 C 100 82 82 100 50 100 C 18 100 0 82 0 50 C 0 18 18 0 50 0 Z',

  // 6. 8-Point Diamond Crystal Star
  burst8: 'M 50 0 L 61 24 L 85 15 L 78 39 L 100 50 L 78 61 L 85 85 L 61 78 L 50 100 L 39 78 L 15 85 L 22 61 L 0 50 L 22 39 L 15 15 L 39 24 Z',
};

export const M3Background: React.FC = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 45, stiffness: 110, mass: 0.8 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // 3-Layer Spatial Depth Parallax (Anti-phase and In-phase)
  const pFarX = useTransform(smoothX, (v) => v * -32);
  const pFarY = useTransform(smoothY, (v) => v * -32);
  const pMidX = useTransform(smoothX, (v) => v * -16);
  const pMidY = useTransform(smoothY, (v) => v * -16);
  const pNearX = useTransform(smoothX, (v) => v * 20);
  const pNearY = useTransform(smoothY, (v) => v * 20);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      mouseX.set((e.clientX / innerWidth - 0.5) * 2);
      mouseY.set((e.clientY / innerHeight - 0.5) * 2);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none transition-colors duration-300">
      {/* 1. Ambient Warm Mesh Glow Orbs (Subtle Warm Atmospheric Light) */}
      <div className="absolute -top-[15%] -left-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#C25E30]/8 via-[#D97736]/4 to-transparent blur-[130px]" />
      <div className="absolute top-[35%] -right-[15%] w-[650px] h-[650px] rounded-full bg-gradient-to-bl from-[#10B981]/6 via-[#059669]/3 to-transparent blur-[140px]" />
      <div className="absolute -bottom-[20%] left-[15%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-[#D97706]/7 via-[#C25E30]/4 to-transparent blur-[130px]" />

      {/* 2. Subtle Dot Matrix Grid with Radial Mask */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          backgroundImage: `radial-gradient(circle, var(--bg-dot-color) 1.2px, transparent 1.2px)`,
          backgroundSize: '30px 30px',
          maskImage: 'radial-gradient(ellipse 75% 65% at 50% 50%, black 25%, transparent 95%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 50%, black 25%, transparent 95%)',
        }}
      />

      {/* 3. High-Precision Telemetry Radar HUD & Orbit Arcs */}
      <motion.div
        style={{ x: pFarX, y: pFarY }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] h-[820px] opacity-15 dark:opacity-20"
      >
        <svg viewBox="0 0 800 800" className="w-full h-full stroke-[var(--bg-shape-stroke)] fill-none">
          {/* Outer Orbit */}
          <circle cx="400" cy="400" r="380" strokeWidth="1" strokeDasharray="3 9" />
          {/* Middle Arc with Precision Notches */}
          <circle cx="400" cy="400" r="250" strokeWidth="1.2" strokeDasharray="140 40 70 40" className="opacity-70" />
          {/* Inner Core Radar */}
          <circle cx="400" cy="400" r="130" strokeWidth="1" strokeDasharray="4 6" className="opacity-50" />
          {/* Axis Ticks */}
          <line x1="400" y1="10" x2="400" y2="35" strokeWidth="1.5" />
          <line x1="400" y1="765" x2="400" y2="790" strokeWidth="1.5" />
          <line x1="10" y1="400" x2="35" y2="400" strokeWidth="1.5" />
          <line x1="765" y1="400" x2="790" y2="400" strokeWidth="1.5" />
        </svg>
      </motion.div>

      {/* 4. Telemetry Corner Labels (+) */}
      <div className="absolute top-6 left-6 font-mono text-[9px] text-[var(--text-muted)]/50 tracking-wider flex items-center gap-1.5 hidden md:flex">
        <span className="text-[#10B981] font-bold">+</span>
        <span>SYS.PROBE // 55.7558°N, 37.6173°E</span>
      </div>
      <div className="absolute bottom-6 right-6 font-mono text-[9px] text-[var(--text-muted)]/50 tracking-wider flex items-center gap-1.5 hidden md:flex">
        <span>TELEMETRY.MESH // M3.EXPRESSIVE</span>
        <span className="text-[#C25E30] dark:text-[#E08244] font-bold">+</span>
      </div>

      {/* 5. Rich Multi-Layered Floating Material 3 Expressive Shapes */}

      {/* Shape 1: Top-Left Floating 4-Leaf Clover (Mid Layer) */}
      <motion.div
        style={{ x: pMidX, y: pMidY }}
        className="absolute top-[8%] left-[4%] w-48 h-48 opacity-45 dark:opacity-55"
      >
        <motion.div
          animate={{
            y: [-12, 12, -12],
            rotate: [0, 8, -8, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-[1.4]" style={{ stroke: 'var(--bg-shape-stroke)' }}>
            <path d={M3_SHAPES.clover} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Shape 2: Top-Right Floating Star 4 (Far Layer) */}
      <motion.div
        style={{ x: pFarX, y: pFarY }}
        className="absolute top-[12%] right-[5%] w-42 h-42 opacity-40 dark:opacity-50"
      >
        <motion.div
          animate={{
            y: [12, -12, 12],
            rotate: [0, -12, 12, 0],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-[1.4]" style={{ stroke: 'var(--bg-shape-stroke)' }}>
            <path d={M3_SHAPES.star4} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Shape 3: Mid-Right Floating Sunny Sunburst (Near Layer) */}
      <motion.div
        style={{ x: pNearX, y: pNearY }}
        className="absolute top-[46%] right-[3%] w-44 h-44 opacity-35 dark:opacity-45"
      >
        <motion.div
          animate={{
            y: [-10, 10, -10],
            rotate: [0, 15, -15, 0],
            scale: [0.97, 1.03, 0.97],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-[1.2]" style={{ stroke: 'var(--bg-shape-stroke)' }}>
            <path d={M3_SHAPES.sunny} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Shape 4: Mid-Left Floating Cookie Scallop (Near Layer) */}
      <motion.div
        style={{ x: pNearX, y: pNearY }}
        className="absolute top-[50%] left-[3%] w-46 h-46 opacity-40 dark:opacity-50"
      >
        <motion.div
          animate={{
            y: [14, -14, 14],
            rotate: [0, -10, 10, 0],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-[1.3]" style={{ stroke: 'var(--bg-shape-stroke)' }}>
            <path d={M3_SHAPES.cookie} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Shape 5: Bottom-Left Floating Burst 8 (Far Layer) */}
      <motion.div
        style={{ x: pFarX, y: pFarY }}
        className="absolute bottom-[10%] left-[6%] w-40 h-40 opacity-30 dark:opacity-40"
      >
        <motion.div
          animate={{
            y: [-12, 12, -12],
            rotate: [0, 14, -14, 0],
          }}
          transition={{
            duration: 24,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-[1.2]" style={{ stroke: 'var(--bg-shape-stroke)' }}>
            <path d={M3_SHAPES.burst8} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Shape 6: Bottom-Right Floating Squircle (Mid Layer) */}
      <motion.div
        style={{ x: pMidX, y: pMidY }}
        className="absolute bottom-[8%] right-[5%] w-52 h-52 opacity-35 dark:opacity-45"
      >
        <motion.div
          animate={{
            y: [12, -12, 12],
            rotate: [0, 8, -8, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-[1.4]" style={{ stroke: 'var(--bg-shape-stroke)' }}>
            <path d={M3_SHAPES.squircle} />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
};
