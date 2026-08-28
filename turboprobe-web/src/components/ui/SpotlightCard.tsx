import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
  spotlightSize?: number;
  borderHighlight?: boolean;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  spotlightColor = 'rgba(208, 188, 255, 0.08)',
  spotlightSize = 380,
  borderHighlight = true,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  };

  const backgroundGradient = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${mouseX}px ${mouseY}px, ${spotlightColor}, transparent 80%)`;
  const borderGradient = useMotionTemplate`radial-gradient(${spotlightSize * 0.7}px circle at ${mouseX}px ${mouseY}px, rgba(208, 188, 255, 0.35), transparent 70%)`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        mouseX.set(-1000);
        mouseY.set(-1000);
      }}
      className={`relative overflow-hidden rounded-[28px] border border-[#49454F]/30 bg-[#1D1B20] p-6 shadow-xl ${className}`}
      {...props}
    >
      {/* Border Beam Glow following cursor */}
      {borderHighlight && (
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-[28px] opacity-0 transition-opacity duration-200 z-0"
          style={{
            background: borderGradient,
            opacity: isHovered ? 1 : 0,
          }}
        />
      )}

      {/* Internal Radial Spotlight Glow following cursor */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 z-0"
        style={{
          background: backgroundGradient,
          opacity: isHovered ? 1 : 0,
        }}
      />

      {/* Main Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
