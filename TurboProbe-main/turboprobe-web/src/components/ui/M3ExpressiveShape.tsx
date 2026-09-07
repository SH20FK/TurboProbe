import React from 'react';
import { motion } from 'framer-motion';

export const M3_SHAPES = {
  // 9-sided smooth cookie from Android 15 Clock & Lockscreen
  cookie: "M50,0 C65,0 75,10 85,15 C95,20 100,35 100,50 C100,65 90,75 85,85 C80,95 65,100 50,100 C35,100 20,95 15,85 C10,75 0,65 0,50 C0,35 10,20 15,15 C20,10 35,0 50,0 Z",
  // 4-leaf clover from Android M3 Expressive
  clover: "M50,0 C70,0 70,30 100,50 C70,70 70,100 50,100 C30,100 30,70 0,50 C30,30 30,0 50,0 Z",
  // 12-point smooth sunny from Android Weather
  sunny: "M50,5 C62,5 68,18 78,22 C88,26 95,38 95,50 C95,62 88,74 78,78 C68,82 62,95 50,95 C38,95 32,82 22,78 C12,74 5,62 5,50 C5,38 12,26 22,22 C32,18 38,5 50,5 Z",
  // 8-petal organic flower
  flower: "M50,0 C65,0 65,25 85,15 C100,25 85,50 100,65 C85,75 85,100 65,100 C50,85 35,100 20,100 C15,85 0,75 0,50 C15,35 0,25 15,15 C35,25 35,0 50,0 Z",
  // Smooth continuous pill
  pill: "M25,0 L75,0 C88.8,0 100,11.2 100,25 L100,75 C100,88.8 88.8,100 75,100 L25,100 C11.2,100 0,88.8 0,75 L0,25 C0,11.2 11.2,0 25,0 Z",
  // 8-point burst star
  burst: "M50,0 L61,24 L85,15 L78,39 L100,50 L78,61 L85,85 L61,78 L50,100 L39,78 L15,85 L22,61 L0,50 L22,39 L15,15 L39,24 Z"
};

interface M3ShapeProps {
  shape?: keyof typeof M3_SHAPES;
  className?: string;
  children?: React.ReactNode;
  rotateSlow?: boolean;
}

export const M3ExpressiveShape: React.FC<M3ShapeProps> = ({
  shape = 'cookie',
  className = 'w-16 h-16',
  children,
  rotateSlow = false,
}) => {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full fill-current">
        <motion.path
          d={M3_SHAPES[shape]}
          animate={rotateSlow ? { rotate: [0, 90, 180, 270, 360] } : undefined}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          whileHover={{ scale: 1.06, rotate: 12 }}
        />
      </svg>
      <div className="relative z-10 flex items-center justify-center">{children}</div>
    </div>
  );
};
