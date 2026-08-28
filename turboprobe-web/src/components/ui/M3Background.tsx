import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export const M3_SHAPES = {
  // 4-Point Smooth Star (Pixel Clock / Android 15 Quick Settings)
  star4: 'M 50 0 C 50 27.6, 27.6 50, 0 50 C 27.6 50, 50 72.4, 50 100 C 50 72.4, 72.4 50, 100 50 C 72.4 50, 50 27.6, 50 0 Z',

  // 8-Lobe Scallop / Cookie (Pixel Badge)
  scallop8: 'M 50 4 C 60 4, 68 12, 75 18 C 82 25, 92 28, 96 38 C 99 48, 96 58, 96 68 C 92 78, 82 81, 75 88 C 68 94, 60 100, 50 100 C 40 100, 32 94, 25 88 C 18 81, 8 78, 4 68 C 1 58, 1 48, 4 38 C 8 28, 18 25, 25 18 C 32 12, 40 4, 50 4 Z',

  // 4-Leaf Clover (Pixel Organic Widget)
  clover: 'M 50 15 C 62 2, 85 8, 85 28 C 85 40, 72 45, 60 50 C 72 55, 85 60, 85 72 C 85 92, 62 98, 50 85 C 38 98, 15 92, 15 72 C 15 60, 28 55, 40 50 C 28 45, 15 40, 15 28 C 15 8, 38 2, 50 15 Z',

  // Squircle G2 Superellipse
  squircle: 'M 100 50 C 100 12, 88 0, 50 0 C 12 0, 0 12, 0 50 C 0 88, 12 100, 50 100 C 88 100, 100 88, 100 50 Z',
};

export const M3Background: React.FC = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 40, stiffness: 100, mass: 1 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 30;
      const y = (e.clientY / innerHeight - 0.5) * 30;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* 1. Subtle M3 Dot Matrix Grid with Radial Mask */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage: `radial-gradient(circle, #FFFFFF 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 100%)',
        }}
      />

      {/* 2. Interactive Parallax Floating Shapes */}

      {/* Shape 1: Top-Left Floating 4-leaf Clover */}
      <motion.div
        style={{ x: smoothX, y: smoothY }}
        className="absolute top-[8%] left-[5%] w-48 h-48 opacity-[0.045]"
      >
        <motion.div
          animate={{
            y: [-12, 12, -12],
            rotate: [0, 8, -8, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full stroke-white fill-none stroke-[1.2]">
            <path d={M3_SHAPES.clover} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Shape 2: Top-Right Floating 4-Point Star */}
      <motion.div
        style={{ x: smoothX, y: smoothY }}
        className="absolute top-[14%] right-[6%] w-40 h-40 opacity-[0.04]"
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
          <svg viewBox="0 0 100 100" className="w-full h-full stroke-white fill-none stroke-[1.2]">
            <path d={M3_SHAPES.star4} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Shape 3: Mid-Left Floating Scallop Cookie */}
      <motion.div
        style={{ x: smoothX, y: smoothY }}
        className="absolute top-[48%] -left-12 w-56 h-56 opacity-[0.035]"
      >
        <motion.div
          animate={{
            y: [-15, 15, -15],
            rotate: [0, 15, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full stroke-white fill-none stroke-[1.2]">
            <path d={M3_SHAPES.scallop8} />
          </svg>
        </motion.div>
      </motion.div>

      {/* Shape 4: Bottom-Right Floating Squircle */}
      <motion.div
        style={{ x: smoothX, y: smoothY }}
        className="absolute bottom-[10%] right-[8%] w-52 h-52 opacity-[0.04]"
      >
        <motion.div
          animate={{
            y: [15, -15, 15],
            rotate: [0, -8, 8, 0],
            scale: [1, 1.04, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full stroke-white fill-none stroke-[1.2]">
            <path d={M3_SHAPES.squircle} />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
};
