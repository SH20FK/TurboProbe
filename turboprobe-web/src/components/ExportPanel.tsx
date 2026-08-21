import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, QrCode, ShieldCheck } from 'lucide-react';
import { HappIcon, FlClashIcon } from './ServiceIcons';

interface ExportPanelProps {
  subUrl: string;
  filteredCount: number;
  allFilteredKeys: string[];
  onOpenQr: () => void;
  onDownloadClash: () => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  subUrl,
  filteredCount,
  allFilteredKeys: _allFilteredKeys,
  onOpenQr,
  onDownloadClash: _onDownloadClash,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedHapp, setCopiedHapp] = useState(false);
  const [copiedFlclash, setCopiedFlclash] = useState(false);

  const clashSubUrl = useMemo(() => {
    if (subUrl.includes('raw.githubusercontent.com') || subUrl.includes('.github.io')) {
      return 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/sub/clash.yaml';
    }
    return `${subUrl}${subUrl.includes('?') ? '&' : '?'}format=clash`;
  }, [subUrl]);

  const handleCopyMainUrl = async () => {
    try {
      await navigator.clipboard.writeText(subUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyHapp = async () => {
    try {
      await navigator.clipboard.writeText(subUrl);
      setCopiedHapp(true);
      setTimeout(() => setCopiedHapp(false), 2500);
      window.location.href = `happ://add/${subUrl}#TurboProbe`;
    } catch {
      // ignore
    }
  };

  const handleCopyFlclash = async () => {
    try {
      await navigator.clipboard.writeText(clashSubUrl);
      setCopiedFlclash(true);
      setTimeout(() => setCopiedFlclash(false), 2500);
      window.location.href = `flclash://install-config?url=${encodeURIComponent(clashSubUrl)}&name=TurboProbe`;
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 backdrop-blur-md border border-white/10 shadow-2xl space-y-3.5">
      
      {/* Clean Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-200" />
            Ссылка на подписку
          </span>
          <span className="text-xs font-mono text-zinc-400">
            ({filteredCount} серверов)
          </span>
        </div>
      </div>

      {/* 1. Subscription URL Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-black/60 border border-white/10">
        <input
          type="text"
          readOnly
          value={subUrl}
          className="w-full bg-transparent text-xs sm:text-sm font-mono text-zinc-200 outline-none px-2 select-all overflow-ellipsis"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={onOpenQr}
          type="button"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs font-medium text-zinc-200 flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <QrCode className="w-3.5 h-3.5 text-zinc-400" />
          <span>QR-код</span>
        </motion.button>
      </div>

      {/* 2. Big Full-Width White Copy Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        onClick={handleCopyMainUrl}
        type="button"
        className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-white/5 cursor-pointer transition-all"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copiedUrl ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 font-bold"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Ссылка скопирована в буфер!</span>
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 font-bold"
            >
              <Copy className="w-4 h-4" />
              <span>Скопировать ссылку на подписку</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* 3. Two equal quick-action buttons */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Happ */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={handleCopyHapp}
          type="button"
          className="py-2.5 px-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedHapp ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Импортировано!</span>
            </>
          ) : (
            <>
              <HappIcon className="w-3.5 h-3.5 text-zinc-300" />
              <span>Открыть в Happ</span>
            </>
          )}
        </motion.button>

        {/* FlClash */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={handleCopyFlclash}
          type="button"
          className="py-2.5 px-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedFlclash ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" />
              <span>Импортировано!</span>
            </>
          ) : (
            <>
              <FlClashIcon className="w-3.5 h-3.5 text-zinc-300" />
              <span>Открыть в FlClash</span>
            </>
          )}
        </motion.button>
      </div>

    </div>
  );
};
