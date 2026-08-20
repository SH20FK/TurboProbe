import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ExternalLink, QrCode, Download, ShieldCheck, FileText } from 'lucide-react';

interface ExportPanelProps {
  subUrl: string;
  filteredCount: number;
  allFilteredKeys: string[];
  onOpenQr: () => void;
  onDownloadTxt: () => void;
  onDownloadClash: () => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  subUrl,
  filteredCount,
  allFilteredKeys,
  onOpenQr,
  onDownloadTxt,
  onDownloadClash,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKeys, setCopiedKeys] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(subUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (_) {}
  };

  const handleCopyKeys = async () => {
    if (allFilteredKeys.length === 0) return;
    try {
      await navigator.clipboard.writeText(allFilteredKeys.join('\n'));
      setCopiedKeys(true);
      setTimeout(() => setCopiedKeys(false), 2000);
    } catch (_) {}
  };

  const happUrl = `happ://add/${encodeURIComponent(subUrl)}`;

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-4">
      <div className="p-6 rounded-2xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 shadow-2xl relative overflow-hidden">
        
        {/* Subtle Wave Pattern on Hover */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 0.05 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"
        />

        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-green-400 font-mono flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Ваша персональная ссылка на подписку
          </span>
          <span className="text-xs font-mono text-neutral-400">
            Готово к импорту ({filteredCount} серверов)
          </span>
        </div>

        {/* Subscription URL Bar */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/60 border border-white/10 mb-5">
          <input
            type="text"
            readOnly
            value={subUrl}
            className="w-full bg-transparent text-xs sm:text-sm font-mono text-neutral-200 outline-none px-2 select-all overflow-ellipsis"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={handleCopyUrl}
            type="button"
            className="flex-shrink-0 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {copiedUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span>Скопировано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-300" />
                <span>Скопировать URL</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Copy All Filtered Keys (With Text Swap Blur & Icon Morph Animation) */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={handleCopyKeys}
            type="button"
            className="col-span-1 sm:col-span-2 py-3 px-4 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 cursor-pointer transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copiedKeys ? (
                <motion.div
                  key="check"
                  initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.8, rotate: -180 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.8 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex items-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Скопировано в буфер ({filteredCount} ключей)!</span>
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.8, rotate: 180 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.8 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>Скопировать все ключи сразу ({filteredCount})</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* 2. Open in Happ */}
          <motion.a
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            href={happUrl}
            className="py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer no-underline transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-blue-400" />
            <span>Открыть в Happ</span>
          </motion.a>

          {/* 3. Clash Meta YAML */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={onDownloadClash}
            type="button"
            className="py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Clash Meta .yaml</span>
          </motion.button>
        </div>

        {/* Secondary Buttons Row */}
        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-white/[0.06]">
          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={onOpenQr}
            type="button"
            className="px-3.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-neutral-300 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <QrCode className="w-3.5 h-3.5 text-neutral-400" />
            <span>QR-код для смартфона</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={onDownloadTxt}
            type="button"
            className="px-3.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-neutral-300 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-neutral-400" />
            <span>Скачать .txt</span>
          </motion.button>
        </div>

      </div>
    </section>
  );
};
