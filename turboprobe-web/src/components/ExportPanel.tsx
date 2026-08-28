import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, HelpCircle, ChevronDown, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { HappIcon, FlClashIcon, V2RayIcon, SingBoxIcon } from './ServiceIcons';
import { M3SplitButton } from './ui/M3SplitButton';
import { M3Ripple } from './ui/M3Ripple';
import { M3NumberCounter } from './ui/M3NumberCounter';
import { CoolMode } from './ui/CoolMode';
import { useToast } from './ui/M3Toast';

interface ExportPanelProps {
  subUrl: string;
  filteredCount: number;
  selectedLimit: number;
  onChangeLimit: (limit: number) => void;
  allFilteredKeys: string[];
  onOpenQr: () => void;
  onDownloadClash: () => void;
}

const guideContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const guideItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.05, 0.7, 0.1, 1.0] as const,
    },
  },
};

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
  const toast = useToast();

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

      // Trigger Festive Canvas Confetti in Warm Terracotta, Gold & Amber
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.82 },
        colors: ['#EA580C', '#F59E0B', '#FB923C', '#10B981', '#FBBF24'],
      });

      toast.copy(subUrl, `Скопирована подписка (${effectiveCount} узлов)`);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const handleClientAction = async (clientName: string, schemeUrl: string, copyPayload?: string) => {
    try {
      if (copyPayload) {
        await navigator.clipboard.writeText(copyPayload);
      }
      setCopiedStatus(clientName);
      toast.success(`Открываем в ${clientName.toUpperCase()}`, 'Ссылка скопирована в буфер');
      setTimeout(() => setCopiedStatus(null), 2500);
      window.location.href = schemeUrl;
    } catch {
      toast.error('Ошибка открытия приложения');
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xl space-y-4 transition-colors duration-200">
      {/* 1. Header with Sliding Spring Limit Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[var(--bg-app)] border border-[var(--border-main)] flex items-center justify-center text-[#EA580C] dark:text-[#FB923C]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display text-xs sm:text-sm font-semibold text-[var(--text-main)]">
              Экспорт подписки
            </span>
            <span className="text-xs font-mono text-[var(--text-muted)] ml-2">
              (<M3NumberCounter value={effectiveCount} formatThousands={false} />{' '}
              {selectedLimit > 0 && selectedLimit < filteredCount ? (
                <>из <M3NumberCounter value={filteredCount} formatThousands={false} /> узлов</>
              ) : (
                'узлов'
              )})
            </span>
          </div>
        </div>

        {/* Segmented Limit Selector with Sliding Pill */}
        <div className="flex items-center gap-1 bg-[var(--bg-app)] p-1 rounded-full border border-[var(--border-main)] text-xs font-mono self-start sm:self-auto shadow-inner relative">
          <span className="text-[var(--text-muted)] px-2 text-[10px] font-semibold uppercase relative z-10">Лимит:</span>
          {[20, 50, 100, 0].map((lim) => {
            const isActive = selectedLimit === lim;

            return (
              <button
                key={lim}
                onClick={() => onChangeLimit(lim)}
                type="button"
                className={`relative px-3 py-1 rounded-full text-xs font-semibold cursor-pointer select-none overflow-hidden ${
                  isActive ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="limit-active-pill"
                    className="absolute inset-0 bg-[#EA580C] rounded-full shadow-xs border border-[#FB923C]/50"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{lim === 0 ? 'Все' : lim}</span>
                <M3Ripple color="#EA580C" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Hero Split-Button (1-Click Main Action) with CoolMode */}
      <div className="w-full">
        <CoolMode particleCount={16} spread={70} colors={['#EA580C', '#F59E0B', '#FB923C', '#10B981']} className="w-full">
          <M3SplitButton
            onCopy={handleCopyMainUrl}
            copied={copiedUrl}
            onOpenQr={onOpenQr}
            onDownloadYaml={onDownloadClash}
            count={effectiveCount}
          />
        </CoolMode>
      </div>

      {/* 3. Native App Import Grid with Instant Spring Physics */}
      <div className="space-y-2 pt-2 border-t border-[var(--border-main)]">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Импорт в 1 клик в ваше приложение:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Happ */}
          <CoolMode colors={['#EA580C', '#F59E0B', '#FB923C']} className="w-full">
            <motion.button
              onClick={() => handleClientAction('happ', `happ://add/${subUrl}#TurboProbe`, subUrl)}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              type="button"
              className="w-full relative py-2.5 px-3 rounded-2xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] hover:border-[#EA580C]/60 hover:shadow-[0_0_12px_rgba(234,88,12,0.25)] text-[var(--text-main)] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer overflow-hidden shadow-xs transition-colors"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedStatus === 'happ' ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center"
                  >
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3]" />
                  </motion.span>
                ) : (
                  <motion.span key="icon" initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center">
                    <HappIcon className="w-4 h-4 text-[#EA580C] dark:text-[#FB923C]" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="font-display font-semibold">Happ</span>
              <M3Ripple color="#EA580C" />
            </motion.button>
          </CoolMode>

          {/* v2rayNG / v2rayN */}
          <CoolMode colors={['#F59E0B', '#EA580C', '#10B981']} className="w-full">
            <motion.button
              onClick={() => handleClientAction('v2ray', `v2rayng://install-config?url=${encodeURIComponent(subUrl)}`, subUrl)}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              type="button"
              className="w-full relative py-2.5 px-3 rounded-2xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] hover:border-[#EA580C]/60 hover:shadow-[0_0_12px_rgba(234,88,12,0.25)] text-[var(--text-main)] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer overflow-hidden shadow-xs transition-colors"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedStatus === 'v2ray' ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center"
                  >
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3]" />
                  </motion.span>
                ) : (
                  <motion.span key="icon" initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center">
                    <V2RayIcon className="w-4 h-4 text-[#EA580C] dark:text-[#FB923C]" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="font-display font-semibold">v2rayNG / N</span>
              <M3Ripple color="#EA580C" />
            </motion.button>
          </CoolMode>

          {/* FlClash */}
          <CoolMode colors={['#10B981', '#34D399', '#EA580C']} className="w-full">
            <motion.button
              onClick={() => handleClientAction('flclash', `flclash://install-config?url=${encodeURIComponent(clashSubUrl)}&name=TurboProbe`, clashSubUrl)}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              type="button"
              className="w-full relative py-2.5 px-3 rounded-2xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] hover:border-[#10B981]/60 hover:shadow-[0_0_12px_rgba(16,185,129,0.25)] text-[var(--text-main)] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer overflow-hidden shadow-xs transition-colors"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedStatus === 'flclash' ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center"
                  >
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3]" />
                  </motion.span>
                ) : (
                  <motion.span key="icon" initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center">
                    <FlClashIcon className="w-4 h-4 text-[#10B981]" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="font-display font-semibold">FlClash</span>
              <M3Ripple color="#10B981" />
            </motion.button>
          </CoolMode>

          {/* Sing-box */}
          <CoolMode colors={['#F59E0B', '#EA580C', '#10B981']} className="w-full">
            <motion.button
              onClick={() => handleClientAction('singbox', `sing-box://import-remote-profile?url=${encodeURIComponent(subUrl)}#TurboProbe`, subUrl)}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              type="button"
              className="w-full relative py-2.5 px-3 rounded-2xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] hover:border-[#F59E0B]/60 hover:shadow-[0_0_12px_rgba(245,158,11,0.25)] text-[var(--text-main)] font-medium text-xs flex items-center justify-center gap-2 cursor-pointer overflow-hidden shadow-xs transition-colors"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedStatus === 'singbox' ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center"
                  >
                    <Check className="w-4 h-4 text-[#10B981] stroke-[3]" />
                  </motion.span>
                ) : (
                  <motion.span key="icon" initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex items-center">
                    <SingBoxIcon className="w-4 h-4 text-[#F59E0B]" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="font-display font-semibold">Sing-box</span>
              <M3Ripple color="#F59E0B" />
            </motion.button>
          </CoolMode>
        </div>
      </div>

      {/* 4. Help Accordion Bar */}
      <div className="pt-1">
        <button
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer select-none"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Инструкция по настройке клиентов</span>
          <motion.div
            animate={{ rotate: isGuideOpen ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0.05, 0.7, 0.1, 1.0] }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {isGuideOpen && (
            <motion.div
              key="guide"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: 'auto',
                opacity: 1,
                transition: {
                  height: { type: 'spring', stiffness: 350, damping: 32 },
                  opacity: { duration: 0.22, ease: [0.05, 0.7, 0.1, 1.0] },
                },
              }}
              exit={{
                height: 0,
                opacity: 0,
                transition: {
                  height: { duration: 0.2, ease: [0.3, 0, 0.8, 0.15] },
                  opacity: { duration: 0.15 },
                },
              }}
              className="overflow-hidden"
            >
              <motion.div
                variants={guideContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[var(--text-main)] pt-3"
              >
                <motion.div variants={guideItem} className="p-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-main)] space-y-1">
                  <span className="font-bold text-[#EA580C] dark:text-[#FB923C] block font-display">1. Клиент</span>
                  <p className="text-[var(--text-muted)] m-0 leading-relaxed text-[11px]">
                    Android: <strong>v2rayNG</strong> / <strong>Happ</strong><br />
                    iOS: <strong>Streisand</strong> / <strong>Sing-box</strong><br />
                    Windows: <strong>FlClash</strong> / <strong>v2rayN</strong>
                  </p>
                </motion.div>
                <motion.div variants={guideItem} className="p-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-main)] space-y-1">
                  <span className="font-bold text-[#EA580C] dark:text-[#FB923C] block font-display">2. Ссылка</span>
                  <p className="text-[var(--text-muted)] m-0 leading-relaxed text-[11px]">
                    Нажмите <strong>«Скопировать подписку»</strong> выше или отсканируйте QR.
                  </p>
                </motion.div>
                <motion.div variants={guideItem} className="p-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-main)] space-y-1">
                  <span className="font-bold text-[#EA580C] dark:text-[#FB923C] block font-display">3. Старт</span>
                  <p className="text-[var(--text-muted)] m-0 leading-relaxed text-[11px]">
                    Вставьте ссылку в клиенте, обновите подписку и включите VPN.
                  </p>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
