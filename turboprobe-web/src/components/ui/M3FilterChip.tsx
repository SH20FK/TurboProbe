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
    <motion.button
      onClick={onToggle}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      type="button"
      className={`relative inline-flex items-center gap-1.5 h-8.5 px-3.5 text-xs font-medium rounded-full border transition-colors duration-150 select-none cursor-pointer overflow-hidden ${
        selected
          ? 'bg-[#4A4458] text-[#E8DEF8] border-[#D0BCFF]/50 shadow-[0_0_12px_rgba(208,188,255,0.2)] font-semibold'
          : 'bg-[#2B2930] text-[#CAC4D0] border-[#49454F]/40 hover:bg-[#36343B] hover:text-white hover:border-[#CAC4D0]/30'
      } ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <motion.span
            key="check"
            initial={{ scale: 0, width: 0, opacity: 0 }}
            animate={{ scale: 1, width: 'auto', opacity: 1 }}
            exit={{ scale: 0, width: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.05, 0.7, 0.1, 1.0] }}
            className="flex items-center"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5] text-[#D0BCFF]" />
          </motion.span>
        ) : icon ? (
          <motion.span
            key="icon"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            className="flex items-center"
          >
            {icon}
          </motion.span>
        ) : null}
      </AnimatePresence>

      <span className="truncate">{label}</span>

      {typeof count === 'number' && (
        <span
          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold transition-colors ${
            selected ? 'bg-[#332D41] text-[#D0BCFF]' : 'bg-[#1D1B20] text-[#938F99]'
          }`}
        >
          {count}
        </span>
      )}

      <M3Ripple color={selected ? '#D0BCFF' : '#CAC4D0'} />
    </motion.button>
  );
};
