import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check } from 'lucide-react';
import { THEME_PRESETS, type ThemePreset } from '../utils/m3Theme';
import { M3Ripple } from './ui/M3Ripple';

interface ThemePickerProps {
  activePreset: ThemePreset;
  onSelectPreset: (presetId: string) => void;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({ activePreset, onSelectPreset }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/40 text-[#CAC4D0] hover:text-white transition-all text-xs font-semibold select-none cursor-pointer"
      >
        <span
          className="w-3 h-3 rounded-full shadow-xs ring-1 ring-white/20"
          style={{ backgroundColor: activePreset.accentColor }}
        />
        <span className="font-display hidden sm:inline">{activePreset.name}</span>
        <Palette className="w-3.5 h-3.5 text-[#D0BCFF]" />
        <M3Ripple />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-48 bg-[#2B2930] border border-[#49454F]/40 rounded-2xl p-1.5 shadow-2xl z-50 overflow-hidden"
          >
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#938F99]">
              Material You Палитры
            </div>
            {THEME_PRESETS.map((preset) => {
              const isSelected = preset.id === activePreset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    onSelectPreset(preset.id);
                    setIsOpen(false);
                  }}
                  type="button"
                  className={`relative w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#4A4458] text-[#EADDFF]'
                      : 'text-[#E6E0E9] hover:bg-[#36343B]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full ring-1 ring-white/20"
                      style={{ backgroundColor: preset.accentColor }}
                    />
                    <span className="font-display">{preset.name}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#D0BCFF]" />}
                  <M3Ripple />
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
