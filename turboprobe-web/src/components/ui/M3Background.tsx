import React from 'react';
import { motion } from 'framer-motion';

// All shapes are defined with exactly 8 cubic bezier segments (1 M, 8 C, 1 Z)
// to ensure 100% fluid, mathematically seamless GPU shape-morphing.
export const MORPH_SHAPES = {
  // 1. 4-Leaf Organic Clover
  clover:
    'M 50 20 C 62 8, 76 8, 82 18 C 92 24, 92 38, 80 50 C 92 62, 92 76, 82 82 C 76 92, 62 92, 50 80 C 38 92, 24 92, 18 82 C 8 76, 8 62, 20 50 C 8 38, 8 24, 18 18 C 24 8, 38 8, 50 20 Z',

  // 2. 4-Point Sparkle Star (Pixel Star / Gemini)
  star4:
    'M 50 4 C 54 18, 58 26, 64 36 C 74 42, 82 46, 96 50 C 82 54, 74 58, 64 64 C 58 74, 54 82, 50 96 C 46 82, 42 74, 36 64 C 26 58, 18 54, 4 50 C 18 46, 26 42, 36 36 C 42 26, 46 18, 50 4 Z',

  // 3. 8-Lobe Scallop / Cookie (Android 15 Widget)
  cookie:
    'M 50 6 C 58 6, 68 12, 76 18 C 84 24, 90 32, 94 40 C 96 48, 96 52, 94 60 C 90 68, 84 76, 76 82 C 68 88, 58 94, 50 94 C 42 94, 32 88, 24 82 C 16 76, 10 68, 6 60 C 4 52, 4 48, 6 40 C 10 32, 16 24, 24 18 C 32 12, 42 6, 50 6 Z',

  // 4. Sunny Sunburst (Soft Sun with Radiating Lobes)
  sunny:
    'M 50 4 C 56 14, 68 14, 78 18 C 84 24, 88 36, 96 50 C 88 64, 84 76, 78 82 C 68 86, 56 86, 50 96 C 44 86, 32 86, 22 82 C 16 76, 12 64, 4 50 C 12 36, 16 24, 22 18 C 32 14, 44 14, 50 4 Z',

  // 5. G2 Superellipse Squircle
  squircle:
    'M 50 6 C 66 6, 80 12, 86 22 C 94 34, 94 44, 94 50 C 94 56, 94 66, 86 78 C 80 88, 66 94, 50 94 C 34 94, 20 88, 14 78 C 6 66, 6 56, 6 50 C 6 44, 6 34, 14 22 C 20 12, 34 6, 50 6 Z',
};

const morphSequence1 = [
  MORPH_SHAPES.clover,
  MORPH_SHAPES.star4,
  MORPH_SHAPES.cookie,
  MORPH_SHAPES.sunny,
  MORPH_SHAPES.squircle,
  MORPH_SHAPES.clover,
];

const morphSequence2 = [
  MORPH_SHAPES.star4,
  MORPH_SHAPES.cookie,
  MORPH_SHAPES.sunny,
  MORPH_SHAPES.squircle,
  MORPH_SHAPES.clover,
  MORPH_SHAPES.star4,
];

const morphSequence3 = [
  MORPH_SHAPES.cookie,
  MORPH_SHAPES.sunny,
  MORPH_SHAPES.squircle,
  MORPH_SHAPES.clover,
  MORPH_SHAPES.star4,
  MORPH_SHAPES.cookie,
];

const morphSequence4 = [
  MORPH_SHAPES.sunny,
  MORPH_SHAPES.squircle,
  MORPH_SHAPES.clover,
  MORPH_SHAPES.star4,
  MORPH_SHAPES.cookie,
  MORPH_SHAPES.sunny,
];

interface MorphingFigureProps {
  sequence: string[];
  className?: string;
  duration?: number;
  floatDuration?: number;
  initialY?: number;
  initialRotate?: number;
}

const MorphingFigure: React.FC<MorphingFigureProps> = ({
  sequence,
  className = '',
  duration = 20,
  floatDuration = 14,
  initialY = -12,
  initialRotate = 6,
}) => {
  return (
    <div className={`absolute ${className}`}>
      {/* Outer Floating & Breathing Container */}
      <motion.div
        animate={{
          y: [initialY, -initialY, initialY],
          rotate: [initialRotate, -initialRotate, initialRotate],
          scale: [0.96, 1.04, 0.96],
        }}
        transition={{
          duration: floatDuration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="w-full h-full"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-xs">
          {/* Continuous Morphing Filled Path with Soft Stroke */}
          <motion.path
            animate={{ d: sequence }}
            transition={{
              duration: duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              fill: 'var(--bg-shape-fill)',
              stroke: 'var(--bg-shape-stroke)',
              strokeWidth: 1.4,
            }}
          />
        </svg>
      </motion.div>
    </div>
  );
};

export const M3Background: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none transition-colors duration-300">
      {/* 1. Subtle Dot Matrix Grid with Radial Mask */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          backgroundImage: `radial-gradient(circle, var(--bg-dot-color) 1.2px, transparent 1.2px)`,
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 75% 65% at 50% 50%, black 25%, transparent 95%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 50%, black 25%, transparent 95%)',
        }}
      />

      {/* 2. Floating & Shape-Morphing Figures with Fill & Stroke */}

      {/* Figure 1: Top-Left Morphing Shape */}
      <MorphingFigure
        sequence={morphSequence1}
        className="top-[6%] left-[4%] w-44 h-44 sm:w-56 sm:h-56 opacity-80 dark:opacity-75"
        duration={18}
        floatDuration={12}
        initialY={-14}
        initialRotate={8}
      />

      {/* Figure 2: Top-Right Morphing Shape */}
      <MorphingFigure
        sequence={morphSequence2}
        className="top-[10%] right-[4%] w-40 h-40 sm:w-52 sm:h-52 opacity-80 dark:opacity-75"
        duration={22}
        floatDuration={15}
        initialY={12}
        initialRotate={-10}
      />

      {/* Figure 3: Bottom-Left Morphing Shape */}
      <MorphingFigure
        sequence={morphSequence3}
        className="bottom-[8%] left-[5%] w-44 h-44 sm:w-56 sm:h-56 opacity-75 dark:opacity-70"
        duration={20}
        floatDuration={14}
        initialY={15}
        initialRotate={-8}
      />

      {/* Figure 4: Bottom-Right Morphing Shape */}
      <MorphingFigure
        sequence={morphSequence4}
        className="bottom-[6%] right-[4%] w-48 h-48 sm:w-60 sm:h-60 opacity-80 dark:opacity-75"
        duration={24}
        floatDuration={16}
        initialY={-12}
        initialRotate={10}
      />
    </div>
  );
};
