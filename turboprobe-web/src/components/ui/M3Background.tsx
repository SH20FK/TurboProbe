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

    const runMorph = (fromIdx: number) => {
      if (!alive.current) return;

      const toIdx = (fromIdx + 1) % shapes.length;

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

      morphRef.current.progress = 1;

      timerRef.current = setTimeout(() => {
        if (alive.current) runMorph(toIdx);
      }, morphDuration + pauseDuration);
    };

    timerRef.current = setTimeout(() => {
      if (alive.current) runMorph(0);
    }, startDelay);

    return () => {
      alive.current = false;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`absolute ${className}`}>
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
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full overflow-visible"
          style={{ filter: 'drop-shadow(0 0 28px rgba(194, 94, 48, 0.20))' }}
        >
          <path
            d={pathD}
            style={{
              fill: 'var(--bg-shape-fill)',
              stroke: 'var(--bg-shape-stroke)',
              strokeWidth: 1.2,
              willChange: 'auto',
            }}
          />
        </svg>
      </motion.div>
    </div>
  );
};

// ─── Shape Sequences ───────────────────────────────────────────────────────────
const topLeft: ShapeName[]     = ['Clover4Leaf', 'Sunny',       'Heart',      'PuffyDiamond',  'Cookie9Sided'];
const topRight: ShapeName[]    = ['Burst',        'Gem',         'Cookie12Sided', 'Ghostish',   'VerySunny'];
const bottomLeft: ShapeName[]  = ['Cookie6Sided', 'Boom',        'Bun',        'SoftBurst',     'Flower'];
const bottomRight: ShapeName[] = ['Puffy',        'ClamShell',   'Diamond',    'Clover8Leaf',   'Pentagon'];
const midLeft: ShapeName[]     = ['SoftBoom',     'Cookie7Sided','Oval',       'Clover4Leaf',   'Burst'];

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

      {/* 2. Five Shape-Morphing Figures */}

      {/* Top-Left — large, partially outside viewport */}
      <MorphingFigure
        shapes={topLeft}
        className="-top-16 -left-16 w-80 h-80 sm:w-96 sm:h-96 opacity-90 dark:opacity-80"
        morphDuration={4200}
        pauseDuration={900}
        floatDuration={13}
        initialY={-18}
        initialRotate={8}
        startDelay={0}
      />

      {/* Top-Right — large, partially outside viewport */}
      <MorphingFigure
        shapes={topRight}
        className="-top-12 -right-16 w-72 h-72 sm:w-88 sm:h-88 opacity-90 dark:opacity-80"
        morphDuration={4600}
        pauseDuration={1000}
        floatDuration={15}
        initialY={14}
        initialRotate={-10}
        startDelay={1700}
      />

      {/* Bottom-Left — large */}
      <MorphingFigure
        shapes={bottomLeft}
        className="-bottom-16 -left-14 w-80 h-80 sm:w-96 sm:h-96 opacity-85 dark:opacity-75"
        morphDuration={4000}
        pauseDuration={1100}
        floatDuration={14}
        initialY={18}
        initialRotate={-8}
        startDelay={900}
      />

      {/* Bottom-Right — extra large, bleeds into corner */}
      <MorphingFigure
        shapes={bottomRight}
        className="-bottom-20 -right-16 w-88 h-88 sm:w-[26rem] sm:h-[26rem] opacity-90 dark:opacity-80"
        morphDuration={5000}
        pauseDuration={800}
        floatDuration={16}
        initialY={-14}
        initialRotate={10}
        startDelay={2600}
      />

      {/* Mid-Left — smaller accent shape for depth */}
      <MorphingFigure
        shapes={midLeft}
        className="top-[38%] -left-20 w-56 h-56 sm:w-72 sm:h-72 opacity-60 dark:opacity-50"
        morphDuration={5400}
        pauseDuration={700}
        floatDuration={18}
        initialY={10}
        initialRotate={-6}
        startDelay={3400}
      />
    </div>
  );
};
