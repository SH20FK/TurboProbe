import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Vector Shapes
const PARTICLE_SHAPES = [
  // 4-Point Star
  'M50 0 C50 0 53 26 64 36 C74 47 100 50 100 50 C100 50 74 53 64 64 C53 74 50 100 50 100 C50 100 47 74 36 64 C26 53 0 50 0 50 C0 50 26 47 36 36 C47 26 50 0 50 0 Z',
  // 8-Lobe Scallop
  'M50,0 C65,0 65,25 85,15 C100,25 85,50 100,65 C85,75 85,100 65,100 C50,85 35,100 20,100 C15,85 0,75 0,50 C15,35 0,25 15,15 C35,25 35,0 50,0 Z',
  // 9-Lobe Cookie
  'M50,0 C65,0 75,10 85,15 C95,20 100,35 100,50 C100,65 90,75 85,85 C80,95 65,100 50,100 C35,100 20,95 15,85 C10,75 0,65 0,50 C0,35 10,20 15,15 C20,10 35,0 50,0 Z',
  // 4-Leaf Clover
  'M 50 15 C 62 2, 85 8, 85 28 C 85 40, 72 45, 60 50 C 72 55, 85 60, 85 72 C 85 92, 62 98, 50 85 C 38 98, 15 92, 15 72 C 15 60, 28 55, 40 50 C 28 45, 15 40, 15 28 C 15 8, 38 2, 50 15 Z',
];

const DEFAULT_WARM_COLORS = ['#EA580C', '#F59E0B', '#FB923C', '#10B981', '#FBBF24'];

interface Particle {
  id: number;
  x: number;
  y: number;
  destX: number;
  destY: number;
  rotate: number;
  scale: number;
  size: number;
  color: string;
  shape: string;
}

interface CoolModeProps {
  children: React.ReactNode;
  particleCount?: number;
  colors?: string[];
  particleSize?: number;
  spread?: number;
  className?: string;
  disabled?: boolean;
}

export const CoolMode: React.FC<CoolModeProps> = ({
  children,
  particleCount = 14,
  colors = DEFAULT_WARM_COLORS,
  particleSize = 16,
  spread = 80,
  className = '',
  disabled = false,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const rect = containerRef.current?.getBoundingClientRect();
      const originX = rect ? e.clientX - rect.left : 0;
      const originY = rect ? e.clientY - rect.top : 0;

      const newParticles: Particle[] = Array.from({ length: particleCount }).map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = (Math.random() * 0.7 + 0.3) * spread;
        const destX = originX + Math.cos(angle) * distance;
        const destY = originY + Math.sin(angle) * distance - Math.random() * 25;

        return {
          id: Date.now() + i + Math.random(),
          x: originX,
          y: originY,
          destX,
          destY,
          rotate: (Math.random() - 0.5) * 720,
          scale: Math.random() * 0.6 + 0.7,
          size: particleSize * (Math.random() * 0.5 + 0.75),
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: PARTICLE_SHAPES[Math.floor(Math.random() * PARTICLE_SHAPES.length)],
        };
      });

      setParticles((prev) => [...prev, ...newParticles]);
    },
    [disabled, particleCount, spread, colors, particleSize]
  );

  const removeParticle = useCallback((id: number) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={`relative inline-flex ${className}`}
    >
      {children}

      <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
        <AnimatePresence>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                x: p.x - p.size / 2,
                y: p.y - p.size / 2,
                scale: 0.2,
                opacity: 1,
                rotate: 0,
              }}
              animate={{
                x: p.destX - p.size / 2,
                y: p.destY - p.size / 2,
                scale: [0.2, p.scale, 0],
                opacity: [1, 1, 0],
                rotate: p.rotate,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
              }}
              onAnimationComplete={() => removeParticle(p.id)}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full" style={{ fill: p.color }}>
                <path d={p.shape} />
              </svg>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
