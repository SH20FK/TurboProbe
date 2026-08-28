import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, QrCode, ShieldCheck, Download, HelpCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { HappIcon, FlClashIcon } from './ServiceIcons';

interface ExportPanelProps {
  subUrl: string;
  filteredCount: number;
  selectedLimit: number;
  onChangeLimit: (limit: number) => void;
  allFilteredKeys: string[];
  onOpenQr: () => void;
  onDownloadClash: () => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  subUrl,
  filteredCount,
  selectedLimit,
  onChangeLimit,
  allFilteredKeys: _allFilteredKeys,
  onOpenQr,
  onDownloadClash,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const effectiveCount = selectedLimit > 0 ? Math.min(selectedLimit, filteredCount) : filteredCount;

  const clashSubUrl = useMemo(() => {
    if (subUrl.includes('raw.githubusercontent.com') || subUrl.includes('.github.io')) {
      return 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/clash-meta.yaml';
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

  const handleClientAction = async (clientName: string, schemeUrl: string, copyPayload?: string) => {
    try {
      if (copyPayload) {
        await navigator.clipboard.writeText(copyPayload);
      }
      setCopiedStatus(clientName);
      setTimeout(() => setCopiedStatus(null), 2500);
      window.location.href = schemeUrl;
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-3.5">
      
      {/* 1. Header with Server Limit Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-200" />
            Ссылка на подписку
          </span>
          <span className="text-xs font-mono text-zinc-400">
            ({effectiveCount} {selectedLimit > 0 && selectedLimit < filteredCount ? `из ${filteredCount}` : 'серверов'})
          </span>
        </div>

        {/* Server Limit Selector Pills */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-mono self-start sm:self-auto">
          <span className="text-zinc-500 px-1 text-[10px] uppercase font-semibold">Лимит:</span>
          {[20, 50, 100, 0].map((lim) => {
            const isActive = selectedLimit === lim;

            return (
              <button
                key={lim}
                onClick={() => onChangeLimit(lim)}
                type="button"
                className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-zinc-800 text-white border border-zinc-600 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                {lim === 0 ? 'Все' : lim}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Subscription URL Input Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800">
        <input
          type="text"
          readOnly
          value={subUrl}
          className="w-full bg-transparent text-xs sm:text-sm font-mono text-zinc-300 outline-none px-2 select-all overflow-ellipsis"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onOpenQr}
          type="button"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <QrCode className="w-3.5 h-3.5 text-zinc-400" />
          <span>QR-код</span>
        </motion.button>
      </div>

      {/* 3. Primary Full-Width Copy Button (Soft Dark Linear Style) */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleCopyMainUrl}
        type="button"
        className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 border border-zinc-700 shadow-sm cursor-pointer transition-all hover:border-zinc-600"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copiedUrl ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 font-medium text-emerald-400"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Ссылка скопирована в буфер обмена!</span>
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 font-medium text-zinc-200"
            >
              <Copy className="w-4 h-4 text-zinc-400" />
              <span>Скопировать ссылку на подписку</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* 4. Quick App Import Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Happ */}
        <button
          onClick={() => handleClientAction('happ', `happ://add/${subUrl}#TurboProbe`, subUrl)}
          type="button"
          className="py-2 px-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedStatus === 'happ' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <HappIcon className="w-3.5 h-3.5 text-zinc-400" />}
          <span>Happ</span>
        </button>

        {/* v2rayNG / v2rayN */}
        <button
          onClick={() => handleClientAction('v2ray', `v2rayng://install-config?url=${encodeURIComponent(subUrl)}`, subUrl)}
          type="button"
          className="py-2 px-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedStatus === 'v2ray' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />}
          <span>v2rayNG / N</span>
        </button>

        {/* FlClash */}
        <button
          onClick={() => handleClientAction('flclash', `flclash://install-config?url=${encodeURIComponent(clashSubUrl)}&name=TurboProbe`, clashSubUrl)}
          type="button"
          className="py-2 px-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedStatus === 'flclash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FlClashIcon className="w-3.5 h-3.5 text-zinc-400" />}
          <span>FlClash</span>
        </button>

        {/* Sing-box */}
        <button
          onClick={() => handleClientAction('singbox', `sing-box://import-remote-profile?url=${encodeURIComponent(subUrl)}#TurboProbe`, subUrl)}
          type="button"
          className="py-2 px-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedStatus === 'singbox' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />}
          <span>Sing-box</span>
        </button>
      </div>

      {/* 5. Clash Meta YAML & Quick Help Bar */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <button
          onClick={onDownloadClash}
          type="button"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors font-mono cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Скачать clash-meta.yaml</span>
        </button>

        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          type="button"
          className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Инструкция по подключению</span>
          {isGuideOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 6. Collapsible Step-by-Step Guide */}
      <AnimatePresence>
        {isGuideOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-zinc-800 pt-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-zinc-300">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 space-y-1">
                <span className="font-semibold text-white block">1. Скачайте приложение</span>
                <p className="text-zinc-400 m-0 leading-relaxed">
                  Android: <strong>v2rayNG</strong> или <strong>Happ</strong><br />
                  iOS: <strong>Streisand</strong>, <strong>FoXray</strong> или <strong>V2Box</strong><br />
                  Windows: <strong>v2rayN</strong> или <strong>FlClash</strong>
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 space-y-1">
                <span className="font-semibold text-white block">2. Скопируйте ссылку</span>
                <p className="text-zinc-400 m-0 leading-relaxed">
                  Нажмите кнопку <strong>«Скопировать ссылку»</strong> выше или отсканируйте QR-код с экрана телефона.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 space-y-1">
                <span className="font-semibold text-white block">3. Импортируйте и включите</span>
                <p className="text-zinc-400 m-0 leading-relaxed">
                  В приложении нажмите <strong>«+» $\to$ «Импорт подписки»</strong>, обновите список и выберите самый быстрый узел.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

