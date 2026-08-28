import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatedMorph, getShape, toPathD, easeInOutCubic, type ShapeName } from 'shape-morph';

interface MorphingFigureProps {
  shapes: ShapeName[];
  className?: string;
  /** Duration for each shape-to-shape morph (ms) */
  morphDuration?: number;
  /** Pause at destination before next morph (ms) */
  pauseDuration?: number;
  /** Framer Motion float cycle duration (s) */
  floatDuration?: number;
  initialY?: number;
  initialRotate?: number;
  /** Initial start delay (ms) to desync figures */
  startDelay?: number;
}

const MorphingFigure: React.FC<MorphingFigureProps> = ({
  shapes,
  className = '',
  morphDuration = 3800,
  pauseDuration = 1200,
  floatDuration = 14,
  initialY = -12,
  initialRotate = 6,
  startDelay = 0,
}) => {
  // Initialize with the computed SVG path of the first shape
  const [pathD, setPathD] = useState<string>(() =>
    toPathD(getShape(shapes[0]).cubics, 100),
  );

  const alive = useRef(true);
  const morphRef = useRef<AnimatedMorph | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;

    const cleanup = () => {
      if (morphRef.current) {
        morphRef.current.dispose();
        morphRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    /**
     * Smoothly morph from shapes[fromIdx] → shapes[toIdx],
     * then after pauseDuration kick off the next morph automatically.
     * This creates a seamless, gapless chain with NO state resets.
     */
    const runMorph = (fromIdx: number) => {
      if (!alive.current) return;

      const toIdx = (fromIdx + 1) % shapes.length;

      // Dispose previous morph instance before creating a new one
      if (morphRef.current) {
        morphRef.current.dispose();
        morphRef.current = null;
      }

      morphRef.current = new AnimatedMorph(shapes[fromIdx], shapes[toIdx], {
        duration: morphDuration,
        easing: easeInOutCubic,
        size: 100,
        onFrame: ({ pathD: d }) => {
          if (alive.current) setPathD(d);
        },
      });

      // Trigger the morph: animate progress 0 → 1
      morphRef.current.progress = 1;

      // After morph + pause, chain the next one seamlessly
      timerRef.current = setTimeout(() => {
        if (alive.current) runMorph(toIdx);
      }, morphDuration + pauseDuration);
    };

    // Stagger start so all 4 figures begin at different times
    timerRef.current = setTimeout(() => {
      if (alive.current) runMorph(0);
    }, startDelay);

    return () => {
      alive.current = false;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally stable — shapes/durations don't change after mount

  return (
    <div className={`absolute ${className}`}>
      {/* Outer Floating & Breathing Layer (Framer Motion) */}
      <motion.div
        animate={{
          y: [initialY, -initialY, initialY],
          rotate: [initialRotate, -initialRotate, initialRotate],
          scale: [0.97, 1.03, 0.97],
        }}
        transition={{
          duration: floatDuration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="w-full h-full"
      >
        {/* SVG Shape — path is updated by AnimatedMorph each frame */}
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <path
            d={pathD}
            style={{
              fill: 'var(--bg-shape-fill)',
              stroke: 'var(--bg-shape-stroke)',
              strokeWidth: 1.3,
              // Hardware-accelerate the SVG path repaints
              willChange: 'auto',
            }}
          />
        </svg>
      </motion.div>
    </div>
  );
};

// ─── Shape Sequences ───────────────────────────────────────────────────────────
// Curated from the official 35-shape AndroidX / Material 3 catalog.
// Each set is offset by 1 shape so the 4 figures are always in different states.

const topLeft: ShapeName[]    = ['Clover4Leaf', 'Sunny', 'Heart', 'PuffyDiamond', 'Cookie9Sided'];
const topRight: ShapeName[]   = ['Burst',       'Gem',   'Cookie12Sided', 'Ghostish', 'VerySunny'];
const bottomLeft: ShapeName[] = ['Cookie6Sided', 'Boom',  'Bun',  'SoftBurst',   'Flower'];
const bottomRight: ShapeName[]= ['Puffy',        'ClamShell', 'Diamond', 'Clover8Leaf', 'Pentagon'];

export const M3Background: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none transition-colors duration-300">

      {/* 1. Subtle Dot-Matrix Grid with Radial Center Mask */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, var(--bg-dot-color) 1.2px, transparent 1.2px)`,
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 75% 65% at 50% 50%, black 25%, transparent 95%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 50%, black 25%, transparent 95%)',
        }}
      />

      {/* 2. Four Corner Shapes — AnimatedMorph + Floating */}

      {/* Top-Left: Clover → Sunny → Heart → PuffyDiamond → Cookie9 */}
      <MorphingFigure
        shapes={topLeft}
        className="top-[5%] left-[3%] w-44 h-44 sm:w-56 sm:h-56 opacity-80 dark:opacity-70"
        morphDuration={4200}
        pauseDuration={900}
        floatDuration={13}
        initialY={-14}
        initialRotate={8}
        startDelay={0}
      />

      {/* Top-Right: Burst → Gem → Cookie12 → Ghostish → VerySunny */}
      <MorphingFigure
        shapes={topRight}
        className="top-[9%] right-[3%] w-40 h-40 sm:w-52 sm:h-52 opacity-80 dark:opacity-70"
        morphDuration={4600}
        pauseDuration={1000}
        floatDuration={15}
        initialY={12}
        initialRotate={-10}
        startDelay={1700}
      />

      {/* Bottom-Left: Cookie6 → Boom → Bun → SoftBurst → Flower */}
      <MorphingFigure
        shapes={bottomLeft}
        className="bottom-[7%] left-[4%] w-44 h-44 sm:w-56 sm:h-56 opacity-75 dark:opacity-65"
        morphDuration={4000}
        pauseDuration={1100}
        floatDuration={14}
        initialY={15}
        initialRotate={-8}
        startDelay={900}
      />

      {/* Bottom-Right: Puffy → ClamShell → Diamond → Clover8 → Pentagon */}
      <MorphingFigure
        shapes={bottomRight}
        className="bottom-[5%] right-[3%] w-48 h-48 sm:w-60 sm:h-60 opacity-80 dark:opacity-70"
        morphDuration={5000}
        pauseDuration={800}
        floatDuration={16}
        initialY={-12}
        initialRotate={10}
        startDelay={2600}
      />
    </div>
  );
};
