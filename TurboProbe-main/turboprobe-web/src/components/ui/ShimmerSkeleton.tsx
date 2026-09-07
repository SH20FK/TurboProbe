import React from 'react';
import { motion } from 'framer-motion';

interface ShimmerSkeletonProps {
  count?: number;
  className?: string;
}

export const ShimmerSkeleton: React.FC<ShimmerSkeletonProps> = ({
  count = 4,
  className = '',
}) => {
  return (
    <div className={`space-y-2.5 p-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.05 }}
          className="relative h-11 w-full overflow-hidden rounded-2xl bg-[var(--bg-app)] border border-[var(--border-main)] flex items-center px-4 justify-between"
        >
          {/* Shimmer Light Sweep Overlay */}
          <div className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer-wave bg-gradient-to-r from-transparent via-[#C25E30]/10 to-transparent" />

          {/* Left Dummy Content */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-4 rounded-xs bg-[var(--border-main)] opacity-40" />
            <div className="w-12 h-4 rounded-md bg-[var(--border-main)] opacity-40" />
            <div className="w-24 sm:w-40 h-3.5 rounded-md bg-[var(--border-main)] opacity-30" />
          </div>

          {/* Right Dummy Content */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-3.5 rounded-md bg-[var(--border-main)] opacity-40" />
            <div className="w-6 h-6 rounded-full bg-[var(--border-main)] opacity-30" />
          </div>
        </motion.div>
      ))}
    </div>
  );
};
