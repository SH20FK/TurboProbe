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
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      type="button"
      className={`relative inline-flex items-center gap-1.5 h-8.5 px-3 text-xs font-medium rounded-full border select-none cursor-pointer overflow-hidden transition-colors duration-150 ${
        selected
          ? 'bg-[#4A4458] text-[#E8DEF8] border-[#D0BCFF]/60 shadow-[0_0_10px_rgba(208,188,255,0.15)] font-semibold'
          : 'bg-[#2B2930] text-[#CAC4D0] border-[#49454F]/40 hover:bg-[#36343B] hover:text-white hover:border-[#CAC4D0]/30'
      } ${className}`}
    >
      {/* Leading Icon / Checkmark with fixed slot to prevent layout shifting */}
      {icon ? (
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 relative">
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                key="check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex items-center justify-center"
              >
                <Check className="w-3.5 h-3.5 stroke-[3] text-[#D0BCFF]" />
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="flex items-center justify-center"
              >
                {icon}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : selected ? (
        <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 -ml-0.5">
          <Check className="w-3.5 h-3.5 stroke-[3] text-[#D0BCFF]" />
        </span>
      ) : null}

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
