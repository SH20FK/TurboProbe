import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Copy, Check, QrCode, Download } from 'lucide-react';
import { M3Ripple } from './M3Ripple';

interface M3SplitButtonProps {
  onCopy: () => void;
  copied: boolean;
  onOpenQr: () => void;
  onDownloadYaml: () => void;
  count: number;
}

export const M3SplitButton: React.FC<M3SplitButtonProps> = ({
  onCopy,
  copied,
  onOpenQr,
  onDownloadYaml,
  count,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-flex items-center w-full shadow-lg group select-none">
      {/* 1. Main Action Button (Copy Sub) */}
      <motion.button
        onClick={onCopy}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.985 }}
        type="button"
        className={`relative flex-1 h-14 px-6 rounded-l-full font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors duration-200 cursor-pointer overflow-hidden ${
          copied
            ? 'bg-[#059669] text-white shadow-[0_0_18px_rgba(5,150,105,0.35)]'
            : 'bg-[#C25E30] text-white hover:bg-[#A84A1E] hover:shadow-[0_0_14px_rgba(194,94,48,0.25)]'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="flex items-center gap-2 font-black"
            >
              <Check className="w-5 h-5 stroke-[3]" />
              <span>Ссылка скопирована!</span>
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <Copy className="w-4 h-4 stroke-[2.5]" />
              <span>Скопировать подписку ({count} узлов)</span>
            </motion.div>
          )}
        </AnimatePresence>
        <M3Ripple color="#FFFFFF" />
      </motion.button>

      {/* 2. Vertical Divider */}
      <div className="w-[1px] h-9 self-center bg-white/20" />

      {/* 3. Dropdown Menu Toggle */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        aria-label="Больше форматов экспорта"
        className={`relative px-4.5 h-14 rounded-r-full flex items-center justify-center transition-colors duration-200 cursor-pointer overflow-hidden ${
          copied
            ? 'bg-[#059669] text-white'
            : 'bg-[#C25E30] text-white hover:bg-[#A84A1E]'
        }`}
      >
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
          <ChevronDown className="w-5 h-5 stroke-[2.5]" />
        </motion.div>
        <M3Ripple color="#FFFFFF" />
      </motion.button>

      {/* 4. Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2 w-68 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-2 shadow-2xl z-50 overflow-hidden"
          >
            <motion.button
              onClick={() => {
                onOpenQr();
                setIsOpen(false);
              }}
              whileHover={{ scale: 1.015, x: 2 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              className="relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer text-left"
            >
              <div className="w-7 h-7 rounded-xl bg-[#C25E30]/15 flex items-center justify-center text-[#C25E30] dark:text-[#E08244]">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <span className="block font-display">Показать QR-код</span>
                <span className="text-[10px] text-[var(--text-muted)] font-normal">Для сканирования на телефоне</span>
              </div>
              <M3Ripple />
            </motion.button>

            <motion.button
              onClick={() => {
                onDownloadYaml();
                setIsOpen(false);
              }}
              whileHover={{ scale: 1.015, x: 2 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              className="relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer text-left mt-1"
            >
              <div className="w-7 h-7 rounded-xl bg-[#C25E30]/15 flex items-center justify-center text-[#C25E30] dark:text-[#E08244]">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <span className="block font-display">Скачать Clash Meta YAML</span>
                <span className="text-[10px] text-[var(--text-muted)] font-normal">Для FlClash, Clash Verge, Mihomo</span>
              </div>
              <M3Ripple />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
