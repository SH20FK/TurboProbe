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
    <div className="p-5 sm:p-6 rounded-[28px] bg-[#1D1B20] border border-[#49454F]/40 shadow-lg space-y-4">
      
      {/* 1. Header with Server Limit Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#36343B] flex items-center justify-center text-[#D0BCFF]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display text-xs sm:text-sm font-semibold text-[#E6E0E9]">
              Ссылка на подписку
            </span>
            <span className="text-xs font-mono text-[#CAC4D0] ml-2">
              ({effectiveCount} {selectedLimit > 0 && selectedLimit < filteredCount ? `из ${filteredCount}` : 'узлов'})
            </span>
          </div>
        </div>

        {/* MD3 Segmented Limit Selector */}
        <div className="flex items-center gap-1 bg-[#141218] p-1 rounded-full border border-[#49454F]/40 text-xs font-mono self-start sm:self-auto shadow-inner">
          <span className="text-[#938F99] px-2 text-[10px] font-semibold uppercase">Лимит:</span>
          {[20, 50, 100, 0].map((lim) => {
            const isActive = selectedLimit === lim;

            return (
              <button
                key={lim}
                onClick={() => onChangeLimit(lim)}
                type="button"
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#4A4458] text-[#E8DEF8] shadow-sm'
                    : 'text-[#CAC4D0] hover:text-white hover:bg-[#2B2930]'
                }`}
              >
                {lim === 0 ? 'Все' : lim}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Subscription URL Input Bar (MD3 Outlined Style) */}
      <div className="flex items-center gap-2 p-1.5 pl-4 rounded-full bg-[#141218] border border-[#49454F]/50 focus-within:border-[#D0BCFF] transition-colors">
        <input
          type="text"
          readOnly
          value={subUrl}
          className="w-full bg-transparent text-xs sm:text-sm font-mono text-[#E6E0E9] outline-none select-all overflow-ellipsis"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onOpenQr}
          type="button"
          className="flex-shrink-0 px-4 py-2 rounded-full bg-[#36343B] hover:bg-[#49454F] text-xs font-medium text-[#E6E0E9] flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <QrCode className="w-3.5 h-3.5 text-[#D0BCFF]" />
          <span>QR</span>
        </motion.button>
      </div>

      {/* 3. Primary Full-Width MD3 Filled Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleCopyMainUrl}
        type="button"
        className={`w-full h-13 sm:h-14 px-6 rounded-full font-display font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md cursor-pointer transition-all ${
          copiedUrl
            ? 'bg-[#7BE08F] text-[#00390F]'
            : 'bg-[#D0BCFF] text-[#381E72] hover:bg-[#EADDFF]'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copiedUrl ? (
            <motion.div
              key="check"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 font-bold"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>Ссылка скопирована в буфер обмена!</span>
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              <span>Скопировать ссылку на подписку</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* 4. Quick App Import Grid (MD3 Action Chips) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {/* Happ */}
        <button
          onClick={() => handleClientAction('happ', `happ://add/${subUrl}#TurboProbe`, subUrl)}
          type="button"
          className="py-2.5 px-3 rounded-2xl bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/30 text-[#E6E0E9] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          {copiedStatus === 'happ' ? <Check className="w-4 h-4 text-[#7BE08F]" /> : <HappIcon className="w-4 h-4 text-[#D0BCFF]" />}
          <span>Happ</span>
        </button>

        {/* v2rayNG / v2rayN */}
        <button
          onClick={() => handleClientAction('v2ray', `v2rayng://install-config?url=${encodeURIComponent(subUrl)}`, subUrl)}
          type="button"
          className="py-2.5 px-3 rounded-2xl bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/30 text-[#E6E0E9] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          {copiedStatus === 'v2ray' ? <Check className="w-4 h-4 text-[#7BE08F]" /> : <ExternalLink className="w-4 h-4 text-[#D0BCFF]" />}
          <span>v2rayNG / N</span>
        </button>

        {/* FlClash */}
        <button
          onClick={() => handleClientAction('flclash', `flclash://install-config?url=${encodeURIComponent(clashSubUrl)}&name=TurboProbe`, clashSubUrl)}
          type="button"
          className="py-2.5 px-3 rounded-2xl bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/30 text-[#E6E0E9] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          {copiedStatus === 'flclash' ? <Check className="w-4 h-4 text-[#7BE08F]" /> : <FlClashIcon className="w-4 h-4 text-[#D0BCFF]" />}
          <span>FlClash</span>
        </button>

        {/* Sing-box */}
        <button
          onClick={() => handleClientAction('singbox', `sing-box://import-remote-profile?url=${encodeURIComponent(subUrl)}#TurboProbe`, subUrl)}
          type="button"
          className="py-2.5 px-3 rounded-2xl bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/30 text-[#E6E0E9] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          {copiedStatus === 'singbox' ? <Check className="w-4 h-4 text-[#7BE08F]" /> : <ExternalLink className="w-4 h-4 text-[#D0BCFF]" />}
          <span>Sing-box</span>
        </button>
      </div>

      {/* 5. Clash Meta YAML & Quick Help Bar */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <button
          onClick={onDownloadClash}
          type="button"
          className="inline-flex items-center gap-1.5 text-[#CAC4D0] hover:text-[#D0BCFF] transition-colors font-mono cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Скачать clash-meta.yaml</span>
        </button>

        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          type="button"
          className="inline-flex items-center gap-1 text-[#CAC4D0] hover:text-[#D0BCFF] transition-colors cursor-pointer"
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
            className="overflow-hidden border-t border-[#49454F]/30 pt-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#E6E0E9]">
              <div className="p-3.5 rounded-2xl bg-[#211F26] border border-[#49454F]/30 space-y-1">
                <span className="font-semibold text-[#D0BCFF] block font-display">1. Скачайте клиент</span>
                <p className="text-[#CAC4D0] m-0 leading-relaxed">
                  Android: <strong>v2rayNG</strong> или <strong>Happ</strong><br />
                  iOS: <strong>Streisand</strong>, <strong>FoXray</strong><br />
                  Windows: <strong>v2rayN</strong> или <strong>FlClash</strong>
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#211F26] border border-[#49454F]/30 space-y-1">
                <span className="font-semibold text-[#D0BCFF] block font-display">2. Скопируйте ссылку</span>
                <p className="text-[#CAC4D0] m-0 leading-relaxed">
                  Нажмите <strong>«Скопировать ссылку»</strong> выше или отсканируйте QR-код в мобильном приложении.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#211F26] border border-[#49454F]/30 space-y-1">
                <span className="font-semibold text-[#D0BCFF] block font-display">3. Подключитесь</span>
                <p className="text-[#CAC4D0] m-0 leading-relaxed">
                  В приложении нажмите <strong>«Импорт подписки»</strong>, обновите список и активируйте VPN.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};


