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
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-[#1D1B20] border border-[#49454F]/30 rounded-2xl ${className}`}>
      {options.map((opt) => {
        const isSelected = opt.id === selectedId;

        return (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            type="button"
            className={`relative py-2.5 px-3 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-150 select-none overflow-hidden ${
              isSelected
                ? 'text-[#EADDFF]'
                : 'text-[#CAC4D0] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId="m3-active-segment-bg"
                className="absolute inset-0 bg-[#4F378B] rounded-xl shadow-md border border-[#D0BCFF]/30"
                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}

            <div className="relative z-10 flex items-center gap-1.5">
              {opt.icon && <span className="text-base leading-none">{opt.icon}</span>}
              <span className="text-xs sm:text-sm font-semibold tracking-tight font-display">
                {opt.label}
              </span>
            </div>

            {opt.desc && (
              <span className="relative z-10 text-[10px] opacity-75 font-mono mt-0.5 truncate max-w-full">
                {opt.desc}
              </span>
            )}

            <M3Ripple color="var(--md-sys-color-primary)" />
          </button>
        );
      })}
    </div>
  );
};
