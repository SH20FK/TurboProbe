import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { M3Ripple } from './M3Ripple';

interface M3FilterChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  count?: number;
  className?: string;
}

export const M3FilterChip: React.FC<M3FilterChipProps> = ({
  label,
  selected,
  onToggle,
  icon,
  count,
  className = '',
}) => {
  return (
    <button
      onClick={onToggle}
      type="button"
      className={`relative inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border transition-all duration-150 select-none cursor-pointer overflow-hidden ${
        selected
          ? 'bg-[#4A4458] text-[#E8DEF8] border-[#D0BCFF]/40 shadow-xs'
          : 'bg-[#1D1B20] text-[#CAC4D0] border-[#49454F]/40 hover:bg-[#2B2930] hover:text-white'
      } ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <motion.span
            key="check"
            initial={{ scale: 0, width: 0 }}
            animate={{ scale: 1, width: 'auto' }}
            exit={{ scale: 0, width: 0 }}
            transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
            className="flex items-center"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5] text-[#D0BCFF]" />
          </motion.span>
        ) : icon ? (
          <motion.span key="icon" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center">
            {icon}
          </motion.span>
        ) : null}
      </AnimatePresence>

      <span className="truncate">{label}</span>

      {typeof count === 'number' && (
        <span
          className={`text-[10px] font-mono px-1 py-0.2 rounded-full ${
            selected ? 'bg-[#332D41] text-[#E8DEF8]' : 'bg-[#36343B] text-[#938F99]'
          }`}
        >
          {count}
        </span>
      )}

      <M3Ripple color={selected ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'} />
    </button>
  );
};
