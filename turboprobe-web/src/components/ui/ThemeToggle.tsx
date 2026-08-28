import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Palette } from 'lucide-react';
import { THEME_PRESETS, applyM3Theme } from '../../utils/m3Theme';
import { useToast } from './M3Toast';

interface AnimatedThemeToggleProps {
  className?: string;
}

export const AnimatedThemeToggle: React.FC<AnimatedThemeToggleProps> = ({ className = '' }) => {
  const [themeIndex, setThemeIndex] = useState<number>(0);
  const toast = useToast();

  const currentTheme = THEME_PRESETS[themeIndex % THEME_PRESETS.length];

  const cycleTheme = () => {
    const nextIdx = (themeIndex + 1) % THEME_PRESETS.length;
    setThemeIndex(nextIdx);
    const nextTheme = THEME_PRESETS[nextIdx];
    applyM3Theme(nextTheme.seed, nextTheme.schemeType, true);
    localStorage.setItem('turboprobe_m3_theme', nextTheme.id);
    toast.info(`Палитра: ${nextTheme.name}`, `Акцент изменен на ${nextTheme.accentColor}`);
  };

  useEffect(() => {
    const saved = localStorage.getItem('turboprobe_m3_theme');
    if (saved) {
      const idx = THEME_PRESETS.findIndex((p) => p.id === saved);
      if (idx !== -1) {
        setThemeIndex(idx);
        applyM3Theme(THEME_PRESETS[idx].seed, THEME_PRESETS[idx].schemeType, true);
      }
    }
  }, []);

  return (
    <button
      onClick={cycleTheme}
      type="button"
      title={`Сменить тему (${currentTheme.name})`}
      aria-label="Сменить тему оформления"
      className={`relative h-8 px-2.5 rounded-full bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/30 text-[#CAC4D0] hover:text-white flex items-center gap-1.5 cursor-pointer overflow-hidden transition-all duration-200 active:scale-95 shadow-xs ${className}`}
    >
      <motion.span
        key={currentTheme.id}
        initial={{ scale: 0.5, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        className="w-2.5 h-2.5 rounded-full ring-1 ring-white/30 flex-shrink-0"
        style={{ backgroundColor: currentTheme.accentColor }}
      />
      <Palette className="w-3.5 h-3.5 text-[#CAC4D0]" />
    </button>
  );
};
