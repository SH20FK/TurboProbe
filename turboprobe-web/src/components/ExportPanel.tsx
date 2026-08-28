import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, HelpCircle, ChevronDown, ChevronUp, ExternalLink, Check } from 'lucide-react';
import { HappIcon, FlClashIcon } from './ServiceIcons';
import { M3SplitButton } from './ui/M3SplitButton';
import { M3Ripple } from './ui/M3Ripple';

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
    <div className="p-5 sm:p-6 rounded-[28px] bg-[#1D1B20] border border-[#49454F]/30 shadow-xl space-y-4">
      {/* 1. Header with Server Limit Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#2B2930] border border-white/5 flex items-center justify-center text-[#D0BCFF]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display text-xs sm:text-sm font-semibold text-[#E6E0E9]">
              Экспорт подписки
            </span>
            <span className="text-xs font-mono text-[#CAC4D0] ml-2">
              ({effectiveCount} {selectedLimit > 0 && selectedLimit < filteredCount ? `из ${filteredCount}` : 'узлов'})
            </span>
          </div>
        </div>

        {/* M3 Segmented Limit Selector */}
        <div className="flex items-center gap-1 bg-[#141218] p-1 rounded-full border border-[#49454F]/30 text-xs font-mono self-start sm:self-auto shadow-inner">
          <span className="text-[#938F99] px-2 text-[10px] font-semibold uppercase">Лимит:</span>
          {[20, 50, 100, 0].map((lim) => {
            const isActive = selectedLimit === lim;

            return (
              <button
                key={lim}
                onClick={() => onChangeLimit(lim)}
                type="button"
                className={`relative px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer select-none overflow-hidden ${
                  isActive
                    ? 'bg-[#4A4458] text-[#E8DEF8] shadow-xs'
                    : 'text-[#CAC4D0] hover:text-white hover:bg-[#2B2930]'
                }`}
              >
                {lim === 0 ? 'Все' : lim}
                <M3Ripple />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Hero M3 Split-Button (1-Click Main Action) */}
      <div className="w-full">
        <M3SplitButton
          onCopy={handleCopyMainUrl}
          copied={copiedUrl}
          onOpenQr={onOpenQr}
          onDownloadYaml={onDownloadClash}
          count={effectiveCount}
        />
      </div>

      {/* 3. Native App Import Grid */}
      <div className="space-y-2 pt-2 border-t border-[#49454F]/25">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#938F99]">
          Импорт в 1 клик в ваше приложение:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Happ */}
          <button
            onClick={() => handleClientAction('happ', `happ://add/${subUrl}#TurboProbe`, subUrl)}
            type="button"
            className="relative py-2.5 px-3 rounded-2xl bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/20 text-[#E6E0E9] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all overflow-hidden shadow-xs"
          >
            {copiedStatus === 'happ' ? <Check className="w-4 h-4 text-[#7BE08F]" /> : <HappIcon className="w-4 h-4 text-[#D0BCFF]" />}
            <span className="font-display font-semibold">Happ</span>
            <M3Ripple />
          </button>

          {/* v2rayNG / v2rayN */}
          <button
            onClick={() => handleClientAction('v2ray', `v2rayng://install-config?url=${encodeURIComponent(subUrl)}`, subUrl)}
            type="button"
            className="relative py-2.5 px-3 rounded-2xl bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/20 text-[#E6E0E9] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all overflow-hidden shadow-xs"
          >
            {copiedStatus === 'v2ray' ? <Check className="w-4 h-4 text-[#7BE08F]" /> : <ExternalLink className="w-4 h-4 text-[#D0BCFF]" />}
            <span className="font-display font-semibold">v2rayNG / N</span>
            <M3Ripple />
          </button>

          {/* FlClash */}
          <button
            onClick={() => handleClientAction('flclash', `flclash://install-config?url=${encodeURIComponent(clashSubUrl)}&name=TurboProbe`, clashSubUrl)}
            type="button"
            className="relative py-2.5 px-3 rounded-2xl bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/20 text-[#E6E0E9] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all overflow-hidden shadow-xs"
          >
            {copiedStatus === 'flclash' ? <Check className="w-4 h-4 text-[#7BE08F]" /> : <FlClashIcon className="w-4 h-4 text-[#D0BCFF]" />}
            <span className="font-display font-semibold">FlClash</span>
            <M3Ripple />
          </button>

          {/* Sing-box */}
          <button
            onClick={() => handleClientAction('singbox', `sing-box://import-remote-profile?url=${encodeURIComponent(subUrl)}#TurboProbe`, subUrl)}
            type="button"
            className="relative py-2.5 px-3 rounded-2xl bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/20 text-[#E6E0E9] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all overflow-hidden shadow-xs"
          >
            {copiedStatus === 'singbox' ? <Check className="w-4 h-4 text-[#7BE08F]" /> : <ExternalLink className="w-4 h-4 text-[#D0BCFF]" />}
            <span className="font-display font-semibold">Sing-box</span>
            <M3Ripple />
          </button>
        </div>
      </div>

      {/* 4. Help Accordion Bar */}
      <div className="pt-1">
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-[#CAC4D0] hover:text-white transition-colors cursor-pointer select-none"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Инструкция по настройке клиентов</span>
          {isGuideOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <AnimatePresence>
          {isGuideOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.05, 0.7, 0.1, 1.0] }}
              className="overflow-hidden pt-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#E6E0E9]">
                <div className="p-3 rounded-2xl bg-[#2B2930] border border-[#49454F]/20 space-y-1">
                  <span className="font-bold text-[#D0BCFF] block font-display">1. Клиент</span>
                  <p className="text-[#CAC4D0] m-0 leading-relaxed text-[11px]">
                    Android: <strong>v2rayNG</strong> / <strong>Happ</strong><br />
                    iOS: <strong>Streisand</strong><br />
                    Windows: <strong>FlClash</strong>
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-[#2B2930] border border-[#49454F]/20 space-y-1">
                  <span className="font-bold text-[#D0BCFF] block font-display">2. Ссылка</span>
                  <p className="text-[#CAC4D0] m-0 leading-relaxed text-[11px]">
                    Нажмите <strong>«Скопировать подписку»</strong> выше или отсканируйте QR.
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-[#2B2930] border border-[#49454F]/20 space-y-1">
                  <span className="font-bold text-[#D0BCFF] block font-display">3. Старт</span>
                  <p className="text-[#CAC4D0] m-0 leading-relaxed text-[11px]">
                    Вставьте ссылку в клиенте, обновите подписку и включите VPN.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
