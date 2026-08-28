import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Gauge, Flame, Check } from 'lucide-react';
import { M3Ripple } from './M3Ripple';

interface M3PingSliderProps {
  maxPing: number;
  onChangeMaxPing: (val: number) => void;
}

const PING_PRESETS = [
  {
    val: 150,
    label: '< 150 ms',
    desc: 'Турбо',
    color: '#10B981',
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  {
    val: 300,
    label: '< 300 ms',
    desc: 'Комфорт',
    color: '#EA580C',
    icon: <Gauge className="w-3.5 h-3.5" />,
  },
  {
    val: 500,
    label: '< 500 ms',
    desc: 'Стандарт',
    color: '#D97706',
    icon: <Flame className="w-3.5 h-3.5" />,
  },
  {
    val: 0,
    label: 'Все узлы',
    desc: 'Без лимита',
    color: '#FB923C',
    icon: <Check className="w-3.5 h-3.5" />,
  },
];

export const M3PingSlider: React.FC<M3PingSliderProps> = ({
  maxPing,
  onChangeMaxPing,
}) => {
  return (
    <div className="space-y-2.5 w-full">
      {/* 1. Quick Presets Segmented Pills with Spring Animation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PING_PRESETS.map((preset) => {
          const isSelected = maxPing === preset.val;

          return (
            <motion.button
              key={preset.val}
              onClick={() => onChangeMaxPing(preset.val)}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              className={`relative p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 text-center border transition-all duration-200 cursor-pointer overflow-hidden select-none shadow-xs ${
                isSelected
                  ? 'bg-[var(--bg-card)] border-[#EA580C] shadow-[0_0_16px_rgba(234,88,12,0.22)]'
                  : 'bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border-[var(--border-main)]'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="ping-pill-indicator"
                  className="absolute inset-0 bg-[#EA580C]/10 rounded-2xl border border-[#EA580C]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <div className="relative z-10 flex items-center gap-1.5 font-display text-xs font-bold text-[var(--text-main)]">
                <span style={{ color: preset.color }}>{preset.icon}</span>
                <span>{preset.label}</span>
              </div>

              <span className="relative z-10 text-[10px] font-mono text-[var(--text-muted)]">
                {preset.desc}
              </span>

              <M3Ripple color={preset.color} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
