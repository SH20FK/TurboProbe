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
    <div ref={containerRef} className="relative inline-flex items-center w-full shadow-lg group">
      {/* 1. Main Action Button (Copy Sub) */}
      <motion.button
        onClick={onCopy}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.985 }}
        type="button"
        className={`relative flex-1 h-14 px-6 rounded-l-full font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer select-none overflow-hidden ${
          copied
            ? 'bg-[#7BE08F] text-[#00390F] shadow-[0_0_15px_rgba(123,224,143,0.35)]'
            : 'bg-[#D0BCFF] text-[#381E72] hover:bg-[#EADDFF] hover:shadow-[0_0_15px_rgba(208,188,255,0.25)]'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
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
        <M3Ripple color={copied ? '#00390F' : '#381E72'} />
      </motion.button>

      {/* 2. Vertical Divider */}
      <div className={`w-[1px] h-9 self-center transition-colors ${copied ? 'bg-[#00390F]/20' : 'bg-[#381E72]/20'}`} />

      {/* 3. Dropdown Menu Toggle */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        aria-label="Больше форматов экспорта"
        className={`relative px-4.5 h-14 rounded-r-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none overflow-hidden ${
          copied
            ? 'bg-[#7BE08F] text-[#00390F]'
            : 'bg-[#D0BCFF] text-[#381E72] hover:bg-[#EADDFF]'
        }`}
      >
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2, ease: [0.05, 0.7, 0.1, 1.0] }}>
          <ChevronDown className="w-5 h-5 stroke-[2.5]" />
        </motion.div>
        <M3Ripple color={copied ? '#00390F' : '#381E72'} />
      </motion.button>

      {/* 4. Dropdown Menu on Surface Container High */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            transition={{ duration: 0.18, ease: [0.05, 0.7, 0.1, 1.0] }}
            className="absolute right-0 top-full mt-2 w-68 bg-[#2B2930] border border-[#49454F]/40 rounded-3xl p-2 shadow-2xl z-50 overflow-hidden"
          >
            <motion.button
              onClick={() => {
                onOpenQr();
                setIsOpen(false);
              }}
              whileHover={{ scale: 1.02, x: 2 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              className="relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold text-[#E6E0E9] hover:bg-[#36343B] transition-colors cursor-pointer text-left"
            >
              <div className="w-7 h-7 rounded-xl bg-[#36343B] flex items-center justify-center text-[#D0BCFF]">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <span className="block font-display">Показать QR-код</span>
                <span className="text-[10px] text-[#CAC4D0] font-normal">Для сканирования на телефоне</span>
              </div>
              <M3Ripple />
            </motion.button>

            <motion.button
              onClick={() => {
                onDownloadYaml();
                setIsOpen(false);
              }}
              whileHover={{ scale: 1.02, x: 2 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              className="relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold text-[#E6E0E9] hover:bg-[#36343B] transition-colors cursor-pointer text-left mt-1"
            >
              <div className="w-7 h-7 rounded-xl bg-[#36343B] flex items-center justify-center text-[#D0BCFF]">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <span className="block font-display">Скачать Clash Meta YAML</span>
                <span className="text-[10px] text-[#CAC4D0] font-normal">Для FlClash, Clash Verge, Mihomo</span>
              </div>
              <M3Ripple />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
