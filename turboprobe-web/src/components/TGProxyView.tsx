import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  ShieldCheck,
  Zap,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  Copy,
  QrCode,
  Download,
  Check,
  Lock,
  ExternalLink,
  Shield,
  Gauge,
  Flame,
  Search,
} from 'lucide-react';
import { useToast } from './ui/M3Toast';
import { M3Ripple } from './ui/M3Ripple';
import { M3NumberCounter } from './ui/M3NumberCounter';
import { SparklesText } from './ui/SparklesText';
import { CountryFlag } from './CountryFlags';
import type { TgProxyItem } from '../types';

interface TGProxyViewProps {
  onOpenQr: (url: string) => void;
}

const TG_PROXIES_MIRRORS = [
  './tg/proxies.json',
  '../tg/proxies.json',
  'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/docs/tg/proxies.json',
  'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/tg/proxies.json',
];

const TG_PRESETS = [
  { id: 'faketls', name: 'Fake-TLS', desc: 'Обход ТСПУ', icon: 'shield', proto: 'mtproto', maxPing: 0 },
  { id: 'turbo', name: 'Турбо-Пинг', desc: '< 120 ms', icon: 'zap', proto: 'all', maxPing: 120 },
  { id: 'socks5', name: 'SOCKS5', desc: 'DC Tunnel', icon: 'socks', proto: 'socks5', maxPing: 0 },
  { id: 'all', name: 'Все прокси', desc: 'Полный пул', icon: 'globe', proto: 'all', maxPing: 0 },
];

const PING_STEPS = [
  { val: 120, label: '< 120 ms', desc: 'Турбо', color: '#10B981', icon: <Zap className="w-3.5 h-3.5" /> },
  { val: 250, label: '< 250 ms', desc: 'Комфорт', color: '#2AABEE', icon: <Gauge className="w-3.5 h-3.5" /> },
  { val: 400, label: '< 400 ms', desc: 'Стандарт', color: '#D97706', icon: <Flame className="w-3.5 h-3.5" /> },
  { val: 0, label: 'Все узлы', desc: 'Без лимита', color: '#2481CC', icon: <Check className="w-3.5 h-3.5" /> },
];

/**
 * Extracts and decodes Fake-TLS SNI domain (e.g. apple.com, cloudflare.com, google.com)
 */
function extractTlsDomain(secret?: string | null): { domain: string | null; type: 'faketls' | 'dd' | 'classic' } {
  if (!secret) return { domain: null, type: 'classic' };
  const hex = secret.trim().toLowerCase();

  if (hex.startsWith('ee')) {
    const domainHex = hex.slice(34);
    if (domainHex.length >= 4) {
      try {
        let domain = '';
        for (let i = 0; i < domainHex.length; i += 2) {
          const code = parseInt(domainHex.slice(i, i + 2), 16);
          if (code >= 32 && code <= 126) domain += String.fromCharCode(code);
        }
        if (domain.includes('.') && domain.length >= 3) {
          return { domain, type: 'faketls' };
        }
      } catch {}
    }
    return { domain: 'TLS-маскировка', type: 'faketls' };
  }

  if (hex.startsWith('dd')) {
    return { domain: null, type: 'dd' };
  }

  return { domain: null, type: 'classic' };
}

export const TGProxyView: React.FC<TGProxyViewProps> = ({ onOpenQr }) => {
  const toast = useToast();

  const [proxies, setProxies] = useState<TgProxyItem[]>(() => {
    try {
      const cached = localStorage.getItem('tg_cached_proxies');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [stats, setStats] = useState({
    total: 0,
    total_mtproto: 0,
    total_socks5: 0,
    best_ping: 0,
    updated_at: '',
  });

  const [activePreset, setActivePreset] = useState<string>('faketls');
  const [selectedProto, setSelectedProto] = useState<'all' | 'mtproto' | 'socks5'>('mtproto');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [maxPing, setMaxPing] = useState<number>(0);
  const [selectedLimit, setSelectedLimit] = useState<number>(50);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFineTuneOpen, setIsFineTuneOpen] = useState<boolean>(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => proxies.length === 0);

  // Load Proxies Data
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const cacheBust = Date.now();
      const urls = TG_PROXIES_MIRRORS.map((m) => `${m}?t=${cacheBust}`);

      try {
        const res = await Promise.any(
          urls.map(async (url) => {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
          })
        );

        if (isMounted && res && Array.isArray(res.proxies)) {
          const list: TgProxyItem[] = res.proxies;
          setProxies(list);

          const best = list.length > 0 ? Math.min(...list.map((p) => p.ping_ms || 999)) : 0;
          const newStats = {
            total: list.length,
            total_mtproto: res.total_mtproto || list.filter((p) => p.proto === 'mtproto').length,
            total_socks5: res.total_socks5 || list.filter((p) => p.proto === 'socks5').length,
            best_ping: best > 0 && best < 999 ? Math.round(best) : 0,
            updated_at: res.updated_at || '',
          };
          setStats(newStats);

          try {
            localStorage.setItem('tg_cached_proxies', JSON.stringify(list));
            localStorage.setItem('tg_cached_stats', JSON.stringify(newStats));
          } catch {}
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load TG proxies:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
  }, []);

  // Filter Logic
  const filteredProxies = useMemo(() => {
    return proxies.filter((p) => {
      if (selectedProto !== 'all') {
        if (selectedProto === 'mtproto' && p.proto !== 'mtproto') return false;
        if (selectedProto === 'socks5' && p.proto !== 'socks5') return false;
      }

      if (selectedCountry !== 'all' && (p.country || 'GLOBAL') !== selectedCountry) {
        return false;
      }

      if (maxPing > 0 && p.ping_ms > maxPing) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const host = `${p.server}:${p.port}`.toLowerCase();
        const country = (p.country_label || p.country || '').toLowerCase();
        const { domain } = extractTlsDomain(p.secret);
        const domainStr = (domain || '').toLowerCase();

        if (!host.includes(q) && !country.includes(q) && !domainStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [proxies, selectedProto, selectedCountry, maxPing, searchQuery]);

  const displayList = useMemo(() => {
    return selectedLimit > 0 ? filteredProxies.slice(0, selectedLimit) : filteredProxies;
  }, [filteredProxies, selectedLimit]);

  // Country counts
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    proxies.forEach((p) => {
      const c = p.country || 'GLOBAL';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [proxies]);

  // Preset Handlers
  const handleSelectPreset = (presetId: string) => {
    setActivePreset(presetId);
    const p = TG_PRESETS.find((x) => x.id === presetId);
    if (!p) return;

    setSelectedProto(p.proto as any);
    setMaxPing(p.maxPing);
    setSelectedCountry('all');
  };

  // Connect Fastest in 1 click
  const handleConnectFastest = useCallback(() => {
    if (filteredProxies.length === 0) {
      toast.error('Нет доступных прокси!');
      return;
    }
    const fastest = filteredProxies[0];
    toast.success('Подключение в Telegram...', `${fastest.server}:${fastest.port}`);
    window.location.href = fastest.tg_link;
  }, [filteredProxies, toast]);

  // Copy single link with micro-feedback
  const handleCopySingle = useCallback(
    (link: string, id: string) => {
      toast.copy(link, 'Ссылка MTProto скопирована');
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    },
    [toast]
  );

  // Copy all visible links
  const handleCopyAll = useCallback(() => {
    if (displayList.length === 0) {
      toast.error('Нет прокси для копирования!');
      return;
    }
    const text = displayList.map((p) => p.tg_link).join('\n');
    toast.copy(text, `Скопировано ${displayList.length} MTProto ссылок`);
  }, [displayList, toast]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 select-none">
      {/* 1. HERO HEADER (Matches TurboProbe Header Style) */}
      <div className="relative rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-6 sm:p-8 shadow-xl overflow-hidden flex flex-col items-center text-center transition-colors duration-200">
        {/* Telegram Plane Logo with Smooth Glow */}
        <motion.div
          whileHover={{ scale: 1.05, rotate: 3 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="relative mb-4 cursor-pointer flex items-center justify-center"
        >
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-[22px] bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] p-4 flex items-center justify-center text-white shadow-lg shadow-sky-500/25">
            <Send className="w-full h-full fill-current" />
          </div>
        </motion.div>

        {/* Title */}
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[var(--text-main)] m-0 flex items-center justify-center gap-2">
          <span>TGProxy</span>
          <SparklesText
            text="Hub"
            sparklesCount={4}
            colors={{ first: '#2AABEE', second: '#74C0FC' }}
            className="font-display font-black text-[#2AABEE]"
          />
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-[var(--text-muted)] max-w-md font-body">
          Суверенные прокси <span className="text-[var(--text-main)] font-semibold">MTProto Fake-TLS</span> и{' '}
          <span className="text-[var(--text-main)] font-semibold">SOCKS5</span> с обходом ТСПУ
        </p>

        {/* 3 KPI Telemetry Badges */}
        <div className="w-full grid grid-cols-3 gap-2 sm:gap-3 mt-6">
          {/* 1. Total Proxies */}
          <div className="relative rounded-2xl bg-[var(--bg-app)] border border-[var(--border-main)] p-2.5 sm:p-3.5 flex flex-col items-center justify-center shadow-xs">
            <div className="flex items-center gap-1 sm:gap-1.5 text-[var(--text-muted)] text-[10px] sm:text-xs font-mono font-medium uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2AABEE]" />
              <span className="hidden sm:inline">Проверено</span>
              <span className="sm:hidden">Узлов</span>
            </div>
            <div className="font-display text-base sm:text-2xl font-bold text-[var(--text-main)] flex items-baseline gap-1">
              <M3NumberCounter value={stats.total || proxies.length} formatThousands={false} />
              <span className="text-[10px] sm:text-xs font-mono text-[var(--text-muted)] font-normal">MTProto</span>
            </div>
          </div>

          {/* 2. Best Ping */}
          <div className="relative rounded-2xl bg-[var(--bg-app)] border border-[var(--border-main)] p-2.5 sm:p-3.5 flex flex-col items-center justify-center shadow-xs">
            <div className="flex items-center gap-1 sm:gap-1.5 text-[var(--text-muted)] text-[10px] sm:text-xs font-mono font-medium uppercase tracking-wider mb-1">
              <Zap className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="hidden sm:inline">Мин. задержка</span>
              <span className="sm:hidden">Пинг</span>
            </div>
            <div className="font-display text-base sm:text-2xl font-bold text-[#10B981] flex items-baseline gap-1">
              <span>{stats.best_ping > 0 ? stats.best_ping : '—'}</span>
              <span className="text-[10px] sm:text-xs font-mono text-[var(--text-muted)] font-normal">ms</span>
            </div>
          </div>

          {/* 3. Sync Status */}
          <div className="relative rounded-2xl bg-[var(--bg-app)] border border-[var(--border-main)] p-2.5 sm:p-3.5 flex flex-col items-center justify-center shadow-xs">
            <div className="flex items-center gap-1 sm:gap-1.5 text-[var(--text-muted)] text-[10px] sm:text-xs font-mono font-medium uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>Сверка</span>
            </div>
            <div className="font-display text-base sm:text-2xl font-bold text-[var(--text-main)] flex items-baseline gap-1">
              <span>{stats.updated_at ? stats.updated_at.split(' ')[1]?.slice(0, 5) : '20:15'}</span>
              <span className="text-[10px] sm:text-xs font-mono text-[var(--text-muted)] font-normal">UTC</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER PANEL (Matches TurboProbe FilterPanel Style) */}
      <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-4 sm:p-6 shadow-xl transition-colors duration-200 space-y-4">
        {/* Preset Selector Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TG_PRESETS.map((preset) => {
            const isSelected = activePreset === preset.id;
            return (
              <motion.button
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                whileHover={{ y: -1, scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                className={`relative p-3 sm:p-3.5 rounded-2xl flex flex-col items-start justify-between text-left border transition-all duration-150 cursor-pointer overflow-hidden select-none shadow-xs ${
                  isSelected
                    ? 'bg-[var(--bg-card)] border-[#2481CC] shadow-[0_0_15px_rgba(36,129,204,0.18)]'
                    : 'bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border-[var(--border-main)]'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="tg-preset-pill-indicator"
                    className="absolute inset-0 bg-[#2481CC]/12 rounded-2xl border border-[#2481CC]"
                    transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  />
                )}

                <div className="relative z-10 w-full flex items-center justify-between mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs ${
                      isSelected ? 'bg-[#2481CC] text-white shadow-xs' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                    }`}
                  >
                    {preset.icon === 'shield' && <Shield className="w-3.5 h-3.5" />}
                    {preset.icon === 'zap' && <Zap className="w-3.5 h-3.5" />}
                    {preset.icon === 'socks' && <Globe className="w-3.5 h-3.5" />}
                    {preset.icon === 'globe' && <Send className="w-3.5 h-3.5" />}
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="font-display text-xs sm:text-sm font-bold text-[var(--text-main)]">
                    {preset.name}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                    {preset.desc}
                  </div>
                </div>

                <M3Ripple color="#2481CC" />
              </motion.button>
            );
          })}
        </div>

        {/* Collapsible Fine-Tuning Accordion */}
        <div className="border-t border-[var(--border-main)] pt-3">
          <button
            onClick={() => setIsFineTuneOpen(!isFineTuneOpen)}
            type="button"
            className="w-full flex items-center justify-between py-2 text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#2AABEE]" />
              <span className="font-semibold">Тонкая настройка (протоколы, пинг, страны)</span>
            </div>
            <motion.div
              animate={{ rotate: isFineTuneOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </button>

          <AnimatePresence>
            {isFineTuneOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden space-y-4 pt-3"
              >
                {/* Ping Steps Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                    <span>Фильтр задержки:</span>
                    <span className="text-[#2AABEE] font-bold">
                      {maxPing > 0 ? `< ${maxPing} ms` : 'Все узлы'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PING_STEPS.map((step) => {
                      const isSelected = maxPing === step.val;
                      return (
                        <motion.button
                          key={step.val}
                          onClick={() => setMaxPing(step.val)}
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--bg-card)] border-[#2481CC] shadow-xs'
                              : 'bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border-[var(--border-main)]'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 font-display text-xs font-bold text-[var(--text-main)]">
                            <span style={{ color: step.color }}>{step.icon}</span>
                            <span>{step.label}</span>
                          </div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">{step.desc}</div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Protocols Chips */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-[var(--text-muted)]">Протокол шифрования:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'mtproto', 'socks5'] as const).map((proto) => {
                      const isSelected = selectedProto === proto;
                      const label = proto === 'all' ? 'Все' : proto === 'mtproto' ? '🛡️ Fake-TLS' : '🧦 SOCKS5';
                      const count = proto === 'all' ? proxies.length : stats[`total_${proto}` as keyof typeof stats];
                      return (
                        <button
                          key={proto}
                          onClick={() => setSelectedProto(proto)}
                          className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-[#2481CC] text-white font-semibold shadow-xs'
                              : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
                          }`}
                        >
                          <span>{label}</span>
                          <span className="opacity-80 text-[10px]">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Countries Chips */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-[var(--text-muted)]">Геолокация:</div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    <button
                      onClick={() => setSelectedCountry('all')}
                      className={`px-3 py-1 rounded-full text-xs font-mono transition-all cursor-pointer ${
                        selectedCountry === 'all'
                          ? 'bg-[#2481CC] text-white font-semibold'
                          : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
                      }`}
                    >
                      Все страны
                    </button>
                    {countryCounts.map(([code, count]) => {
                      const isSelected = selectedCountry === code;
                      return (
                        <button
                          key={code}
                          onClick={() => setSelectedCountry(code)}
                          className={`px-3 py-1 rounded-full text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-[#2481CC] text-white font-semibold'
                              : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
                          }`}
                        >
                          <CountryFlag countryCode={code} className="w-3.5 h-2.5 rounded-xs" />
                          <span>{code === 'GLOBAL' ? 'Серверы' : code}</span>
                          <span className="opacity-80 text-[10px]">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 3. EXPORT PANEL (Matches TurboProbe ExportPanel Style) */}
      <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-4 sm:p-6 shadow-xl transition-colors duration-200 space-y-4">
        {/* Header with Count & Limit Pills */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <Send className="w-3.5 h-3.5 text-[#2AABEE]" />
            <span>Экспорт прокси ({displayList.length} из {proxies.length} узлов)</span>
          </div>

          <div className="flex items-center gap-1 bg-[var(--bg-app)] p-1 rounded-xl border border-[var(--border-main)]">
            <span className="text-[11px] text-[var(--text-muted)] px-1.5 hidden sm:inline">Лимит:</span>
            {[20, 50, 100, 0].map((lim) => {
              const isActive = selectedLimit === lim;
              return (
                <button
                  key={lim}
                  onClick={() => setSelectedLimit(lim)}
                  className={`relative px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer text-xs ${
                    isActive ? 'text-white font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tg-export-limit-active"
                      className="absolute inset-0 bg-[#2481CC] rounded-lg shadow-xs"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{lim === 0 ? 'Все' : lim}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Big Primary Action Split Button */}
        <div className="flex items-stretch gap-2">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConnectFastest}
            className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#2481CC] to-[#2AABEE] text-white font-display text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 cursor-pointer"
          >
            <Send className="w-4 h-4 fill-current" />
            <span>Подключить лучший прокси ({displayList.length} узлов)</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleCopyAll}
            title="Скопировать все ссылки"
            className="px-4 rounded-2xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-main)] flex items-center justify-center cursor-pointer shadow-xs"
          >
            <Copy className="w-4 h-4 text-[#2AABEE]" />
          </motion.button>
        </div>

        {/* Quick App & Utility Buttons Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            onClick={handleConnectFastest}
            className="py-2 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-mono font-semibold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-[#2AABEE]" />
            <span>Telegram App</span>
          </button>

          <button
            onClick={handleCopyAll}
            className="py-2 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-mono font-semibold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-[#2AABEE]" />
            <span>Все ключи</span>
          </button>

          <button
            onClick={() => {
              if (displayList.length > 0) onOpenQr(displayList[0].tg_link);
            }}
            className="py-2 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-mono font-semibold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-[#2AABEE]" />
            <span>QR-код</span>
          </button>

          <a
            href="https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt"
            download
            className="py-2 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-mono font-semibold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
          >
            <Download className="w-3.5 h-3.5 text-[#2AABEE]" />
            <span>Скачать .txt</span>
          </a>
        </div>
      </div>

      {/* 4. NODE PREVIEW LIST (Matches TurboProbe NodePreviewList Style) */}
      <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xl overflow-hidden transition-colors duration-200">
        {/* Accordion Header */}
        <button
          onClick={() => setIsTelemetryOpen(!isTelemetryOpen)}
          type="button"
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[var(--bg-card-hover)]/60 transition-colors text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[var(--bg-app)] border border-[var(--border-main)] flex items-center justify-center text-[#2AABEE]">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <span className="font-display text-xs sm:text-sm font-semibold text-[var(--text-main)]">
                Телеметрия проверенных узлов
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)] ml-2">
                (<M3NumberCounter value={displayList.length} formatThousands={false} /> доступно)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] font-body hidden sm:inline">
              {isTelemetryOpen ? 'Скрыть список' : 'Показать список'}
            </span>
            <motion.div
              animate={{ rotate: isTelemetryOpen ? 180 : 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="p-1 rounded-full bg-[var(--bg-app)] text-[var(--text-muted)]"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </div>
        </button>

        {/* Expandable Table Content */}
        <AnimatePresence initial={false}>
          {isTelemetryOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-[var(--border-main)]"
            >
              {/* Search Bar inside Telemetry */}
              <div className="p-3 bg-[var(--bg-app)] border-b border-[var(--border-main)]">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Поиск по IP / SNI домену (apple.com, cloudflare.com)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#2AABEE]/60 transition-colors"
                  />
                </div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-[var(--border-main)] max-h-[460px] overflow-y-auto">
                {displayList.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-[var(--text-muted)]">
                    {isLoading ? 'Загрузка проверенных узлов...' : 'Нет узлов под выбранные фильтры.'}
                  </div>
                ) : (
                  displayList.map((p, idx) => {
                    const { domain, type: secretType } = extractTlsDomain(p.secret);
                    const isFakeTls = p.proto === 'mtproto' && secretType === 'faketls';
                    const pingColor =
                      p.ping_ms < 120 ? 'text-[#10B981]' : p.ping_ms < 250 ? 'text-[#2AABEE]' : 'text-[#E08244]';
                    const pingBg =
                      p.ping_ms < 120 ? 'bg-[#10B981]' : p.ping_ms < 250 ? 'bg-[#2AABEE]' : 'bg-[#E08244]';
                    const cardId = `${p.server}-${p.port}-${idx}`;
                    const isCopied = copiedId === cardId;

                    return (
                      <div
                        key={cardId}
                        className="p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 hover:bg-[var(--bg-card-hover)]/40 transition-colors group"
                      >
                        {/* Left: Index + Flag + Host */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-[11px] text-[var(--text-muted)] w-5 text-right shrink-0">
                            {idx + 1}
                          </span>

                          <CountryFlag
                            countryCode={p.country || 'GLOBAL'}
                            className="w-4 h-3 rounded-xs shrink-0 shadow-xs"
                          />

                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[var(--text-main)] truncate">
                                {p.server}:{p.port}
                              </span>

                              {isFakeTls ? (
                                <span className="px-1.5 py-0.2 rounded-md bg-[#10B981]/15 text-[#10B981] text-[9px] font-mono font-bold">
                                  Fake-TLS
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded-md bg-[#2AABEE]/15 text-[#2AABEE] text-[9px] font-mono font-bold">
                                  {p.proto.toUpperCase()}
                                </span>
                              )}

                              {domain && (
                                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-[var(--bg-app)] border border-[var(--border-main)] text-[9px] font-mono text-[var(--text-muted)]">
                                  <Lock className="w-2 h-2 text-[#2AABEE]" />
                                  <span>{domain}</span>
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-2">
                              <span>{p.country_label || p.country || '🌐 Сервер'}</span>
                              <span className={`inline-flex items-center gap-1 ${pingColor} font-bold`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${pingBg}`} />
                                <span>{Math.round(p.ping_ms)} ms</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Connect + Copy */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={p.tg_link}
                            className="py-1.5 px-3 rounded-xl bg-[#2481CC] hover:bg-[#2AABEE] text-white font-display text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                          >
                            <span>Подключить</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            onClick={() => handleCopySingle(p.tg_link, cardId)}
                            title="Скопировать ссылку"
                            className="p-1.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
