import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useMorph, type ShapeName } from 'shape-morph/react';

interface MorphingFigureProps {
  shapes: ShapeName[];
  className?: string;
  cycleDuration?: number; // ms to morph between each shape
  floatDuration?: number; // s for idle floating wave
  initialY?: number;
  initialRotate?: number;
}

const MorphingFigure: React.FC<MorphingFigureProps> = ({
  shapes,
  className = '',
  cycleDuration = 5000,
  floatDuration = 14,
  initialY = -12,
  initialRotate = 6,
}) => {
  const [shapeIndex, setShapeIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const startShape = shapes[shapeIndex];
  const endShape = shapes[(shapeIndex + 1) % shapes.length];

  const { pathD } = useMorph(startShape, endShape, {
    progress,
    duration: cycleDuration * 0.85,
    easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t), // smooth easeInOutQuad
    size: 100,
  });

  useEffect(() => {
    // Start morphing toward 1
    const morphTimer = setTimeout(() => {
      setProgress(1);
    }, 400);

    // When morph completes, advance to next pair and reset progress
    const switchTimer = setTimeout(() => {
      setShapeIndex((prev) => (prev + 1) % shapes.length);
      setProgress(0);
    }, cycleDuration);

    return () => {
      clearTimeout(morphTimer);
      clearTimeout(switchTimer);
    };
  }, [shapeIndex, cycleDuration, shapes.length]);

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
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <path
            d={pathD}
            style={{
              fill: 'var(--bg-shape-fill)',
              stroke: 'var(--bg-shape-stroke)',
              strokeWidth: 1.3,
            }}
          />
        </svg>
      </motion.div>
    </div>
  );
};

// 4 Curated Sets of Material 3 Expressive Shapes from the Official 35-Shape Catalog
const topSet1: ShapeName[] = ['Clover4Leaf', 'Sunny', 'Heart', 'PuffyDiamond', 'Cookie9Sided', 'Clover4Leaf'];
const topSet2: ShapeName[] = ['Burst', 'Gem', 'Cookie12Sided', 'Ghostish', 'VerySunny', 'Burst'];
const bottomSet1: ShapeName[] = ['Cookie6Sided', 'Boom', 'Bun', 'SoftBurst', 'Flower', 'Cookie6Sided'];
const bottomSet2: ShapeName[] = ['Sunny', 'Puffy', 'ClamShell', 'Diamond', 'Clover8Leaf', 'Sunny'];

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

      {/* 2. Official AndroidX / Material 3 Expressive Morphing Figures with Fill & Stroke */}

      {/* Figure 1: Top-Left (Clover -> Sunny -> Heart -> PuffyDiamond -> Cookie9) */}
      <MorphingFigure
        shapes={topSet1}
        className="top-[6%] left-[4%] w-44 h-44 sm:w-56 sm:h-56 opacity-85 dark:opacity-75"
        cycleDuration={6000}
        floatDuration={13}
        initialY={-14}
        initialRotate={8}
      />

      {/* Figure 2: Top-Right (Burst -> Gem -> Cookie12 -> Ghostish -> VerySunny) */}
      <MorphingFigure
        shapes={topSet2}
        className="top-[10%] right-[4%] w-40 h-40 sm:w-52 sm:h-52 opacity-85 dark:opacity-75"
        cycleDuration={6800}
        floatDuration={15}
        initialY={12}
        initialRotate={-10}
      />

      {/* Figure 3: Bottom-Left (Cookie6 -> Boom -> Bun -> SoftBurst -> Flower) */}
      <MorphingFigure
        shapes={bottomSet1}
        className="bottom-[8%] left-[5%] w-44 h-44 sm:w-56 sm:h-56 opacity-80 dark:opacity-70"
        cycleDuration={6400}
        floatDuration={14}
        initialY={15}
        initialRotate={-8}
      />

      {/* Figure 4: Bottom-Right (Sunny -> Puffy -> ClamShell -> Diamond -> Clover8) */}
      <MorphingFigure
        shapes={bottomSet2}
        className="bottom-[6%] right-[4%] w-48 h-48 sm:w-60 sm:h-60 opacity-85 dark:opacity-75"
        cycleDuration={7200}
        floatDuration={16}
        initialY={-12}
        initialRotate={10}
      />
    </div>
  );
};
