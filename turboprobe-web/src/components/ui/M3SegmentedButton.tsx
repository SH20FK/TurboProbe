import React from 'react';
import { motion } from 'framer-motion';
import { M3Ripple } from './M3Ripple';

export interface SegmentOption {
  id: string;
  label: string;
  desc?: string;
  icon?: React.ReactNode;
}

interface M3SegmentedButtonProps {
  options: SegmentOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const M3SegmentedButton: React.FC<M3SegmentedButtonProps> = ({
  options,
  selectedId,
  onSelect,
  className = '',
}) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-lg relative transition-colors duration-200 ${className}`}>
      {options.map((opt) => {
        const isSelected = opt.id === selectedId;

        return (
          <motion.button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            className={`relative py-3 px-3 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-150 select-none overflow-hidden ${
              isSelected
                ? 'text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/[0.04]'
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId="m3-active-segment-bg"
                className="absolute inset-0 bg-[#0284C7] rounded-xl shadow-[0_2px_12px_rgba(2,132,199,0.35)] border border-[#38BDF8]/60"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}

            <div className="relative z-10 flex items-center gap-1.5">
              {opt.icon && (
                <motion.span
                  animate={{ scale: isSelected ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-base leading-none"
                >
                  {opt.icon}
                </motion.span>
              )}
              <span className="text-xs sm:text-sm font-bold tracking-tight font-display">
                {opt.label}
              </span>
            </div>

            {opt.desc && (
              <span className="relative z-10 text-[10px] opacity-80 font-mono mt-0.5 truncate max-w-full">
                {opt.desc}
              </span>
            )}

            <M3Ripple color="#38BDF8" />
          </motion.button>
        );
      })}
    </div>
  );
};
