import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const StarIcon: React.FC<{ className?: string; color?: string }> = ({ className = '', color = 'currentColor' }) => (
  <svg viewBox="0 0 160 160" className={`w-full h-full fill-current ${className}`} style={{ color }}>
    <path d="M80 0C80 0 84.2846 41.2925 101.496 58.504C118.707 75.7154 160 80 160 80C160 80 118.707 84.2846 101.496 101.496C84.2846 118.707 80 160 80 160C80 160 75.7154 118.707 58.504 101.496C41.2925 84.2846 0 80 0 80C0 80 41.2925 75.7154 58.504 58.504C75.7154 41.2925 80 0 80 0Z" />
  </svg>
);

interface Sparkle {
  id: number;
  x: string;
  y: string;
  color: string;
  size: number;
  delay: number;
}

interface SparklesTextProps {
  text?: string;
  children?: React.ReactNode;
  sparklesCount?: number;
  colors?: { first: string; second: string };
  className?: string;
}

export const SparklesText: React.FC<SparklesTextProps> = ({
  text,
  children,
  sparklesCount = 5,
  colors = { first: '#D0BCFF', second: '#7BE08F' },
  className = '',
}) => {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    const generateSparkles = () => {
      return Array.from({ length: sparklesCount }).map((_, i) => ({
        id: i,
        x: `${Math.floor(Math.random() * 104) - 2}%`,
        y: `${Math.floor(Math.random() * 104) - 2}%`,
        color: Math.random() > 0.5 ? colors.first : colors.second,
        size: Math.floor(Math.random() * 10) + 12,
        delay: Math.random() * 1.5,
      }));
    };

    setSparkles(generateSparkles());
    const interval = setInterval(() => {
      setSparkles(generateSparkles());
    }, 2800);

    return () => clearInterval(interval);
  }, [sparklesCount, colors.first, colors.second]);

  return (
    <span className={`relative inline-block ${className}`}>
      {/* Sparkles */}
      <AnimatePresence>
        {sparkles.map((sparkle) => (
          <motion.span
            key={sparkle.id}
            initial={{ scale: 0, rotate: 0, opacity: 0 }}
            animate={{
              scale: [0, 1.2, 0.8, 1, 0],
              rotate: [0, 90, 180],
              opacity: [0, 1, 1, 0.8, 0],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              repeatDelay: sparkle.delay,
              ease: 'easeInOut',
            }}
            className="absolute pointer-events-none z-10 block"
            style={{
              top: sparkle.y,
              left: sparkle.x,
              width: sparkle.size,
              height: sparkle.size,
            }}
          >
            <StarIcon color={sparkle.color} />
          </motion.span>
        ))}
      </AnimatePresence>

      {/* Main Text Content */}
      <span className="relative z-0">{children || text}</span>
    </span>
  );
};
