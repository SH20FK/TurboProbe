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
      animate={{
        borderRadius: selected ? '9999px' : '14px',
      }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      type="button"
      className={`relative inline-flex items-center gap-1.5 h-8.5 px-3 text-xs font-medium border select-none cursor-pointer overflow-hidden transition-colors duration-150 ${
        selected
          ? 'bg-[#EA580C] text-white border-[#FB923C]/70 shadow-[0_0_12px_rgba(234,88,12,0.3)] font-semibold'
          : 'bg-[var(--bg-chip)] text-[var(--text-muted)] border-[var(--border-main)] hover:bg-[var(--bg-chip-hover)] hover:text-[var(--text-main)] hover:border-[var(--border-hover)]'
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
                <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
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
          <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
        </span>
      ) : null}

      <span className="truncate">{label}</span>

      {typeof count === 'number' && (
        <span
          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold transition-colors ${
            selected ? 'bg-black/20 text-white' : 'bg-[var(--bg-app)] text-[var(--text-muted)]'
          }`}
        >
          {count}
        </span>
      )}

      <M3Ripple color={selected ? '#FFFFFF' : '#EA580C'} />
    </motion.button>
  );
};
