import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const ANDROID_15_SHAPES = {
  cookie: 'M 50 0 C 65 0 75 10 85 15 C 95 20 100 35 100 50 C 100 65 90 75 85 85 C 80 95 65 100 50 100 C 35 100 20 95 15 85 C 10 75 0 65 0 50 C 0 35 10 20 15 15 C 20 10 35 0 50 0 Z',
  clover: 'M 50 15 C 62 2, 85 8, 85 28 C 85 40, 72 45, 60 50 C 72 55, 85 60, 85 72 C 85 92, 62 98, 50 85 C 38 98, 15 92, 15 72 C 15 60, 28 55, 40 50 C 28 45, 15 40, 15 28 C 15 8, 38 2, 50 15 Z',
  sunny: 'M 50 5 C 62 5 68 18 78 22 C 88 26 95 38 95 50 C 95 62 88 74 78 78 C 68 82 62 95 50 95 C 38 95 32 82 22 78 C 12 74 5 62 5 50 C 5 38 12 26 22 22 C 32 18 38 5 50 5 Z',
  star4: 'M 50 0 C 50 27.6, 27.6 50, 0 50 C 27.6 50, 50 72.4, 50 100 C 50 72.4, 72.4 50, 100 50 C 72.4 50, 50 27.6, 50 0 Z',
  scallop8: 'M 50 4 C 60 4, 68 12, 75 18 C 82 25, 92 28, 96 38 C 99 48, 96 58, 96 68 C 92 78, 82 81, 75 88 C 68 94, 60 100, 50 100 C 40 100, 32 94, 25 88 C 18 81, 8 78, 4 68 C 1 58, 1 48, 4 38 C 8 28, 18 25, 25 18 C 32 12, 40 4, 50 4 Z',
};

type ShapeKey = keyof typeof ANDROID_15_SHAPES;

interface ShapeMorphProps {
  currentShape?: ShapeKey;
  autoCycle?: boolean;
  cycleInterval?: number;
  className?: string;
  fill?: string;
  stroke?: string;
  size?: number;
}

export const ShapeMorph: React.FC<ShapeMorphProps> = ({
  currentShape,
  autoCycle = false,
  cycleInterval = 4000,
  className = '',
  fill = 'currentColor',
  stroke = 'none',
  size = 64,
}) => {
  const shapeKeys = Object.keys(ANDROID_15_SHAPES) as ShapeKey[];
  const [shapeIndex, setShapeIndex] = useState<number>(0);

  const activeShapeKey = currentShape || shapeKeys[shapeIndex];

  useEffect(() => {
    if (!autoCycle) return;
    const interval = setInterval(() => {
      setShapeIndex((prev) => (prev + 1) % shapeKeys.length);
    }, cycleInterval);
    return () => clearInterval(interval);
  }, [autoCycle, cycleInterval, shapeKeys.length]);

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <AnimatePresence mode="wait">
          <motion.path
            key={activeShapeKey}
            d={ANDROID_15_SHAPES[activeShapeKey]}
            fill={fill}
            stroke={stroke}
            strokeWidth={stroke !== 'none' ? 1.5 : 0}
            initial={{ scale: 0.85, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.85, opacity: 0, rotate: 15 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          />
        </AnimatePresence>
      </svg>
    </div>
  );
};
