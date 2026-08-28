import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './ui/M3Toast';
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

  const [activePreset, setActivePreset] = useState<'anti-tspu' | 'turbo' | 'socks5' | 'all'>('anti-tspu');
  const [selectedProto, setSelectedProto] = useState<'all' | 'mtproto' | 'socks5'>('mtproto');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [maxPing, setMaxPing] = useState<number>(0);
  const [limit, setLimit] = useState<number>(50);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(() => proxies.length === 0);

  // Load Proxies Data with Cache-Busting
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
      return true;
    });
  }, [proxies, selectedProto, selectedCountry, maxPing]);

  const displayList = useMemo(() => {
    return limit > 0 ? filteredProxies.slice(0, limit) : filteredProxies;
  }, [filteredProxies, limit]);

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
  const handleSelectPreset = (preset: 'anti-tspu' | 'turbo' | 'socks5' | 'all') => {
    setActivePreset(preset);
    if (preset === 'anti-tspu') {
      setSelectedProto('mtproto');
      setSelectedCountry('all');
      setMaxPing(0);
    } else if (preset === 'turbo') {
      setSelectedProto('all');
      setSelectedCountry('all');
      setMaxPing(200);
    } else if (preset === 'socks5') {
      setSelectedProto('socks5');
      setSelectedCountry('all');
      setMaxPing(0);
    } else {
      setSelectedProto('all');
      setSelectedCountry('all');
      setMaxPing(0);
    }
  };

  // 1-Click Connect to Fastest Proxy
  const handleConnectFastest = useCallback(() => {
    if (filteredProxies.length === 0) {
      toast.error('Нет доступных прокси для подключения!');
      return;
    }
    const fastest = filteredProxies[0];
    toast.success('Подключение к прокси...', `${fastest.server}:${fastest.port}`);
    window.location.href = fastest.tg_link;
  }, [filteredProxies, toast]);

  const handleCopyAll = useCallback(() => {
    if (displayList.length === 0) {
      toast.error('Нет прокси для копирования!');
      return;
    }
    const text = displayList.map((p) => p.tg_link).join('\n');
    toast.copy(text, `Скопировано ${displayList.length} прокси-ссылок`);
  }, [displayList, toast]);

  const handleCopySingle = useCallback(
    (link: string) => {
      toast.copy(link, 'Ссылка прокси скопирована');
    },
    [toast]
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3 sm:space-y-4">
      {/* 1. Unified Bento Hero Command Center */}
      <div className="relative rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-6 sm:p-8 overflow-hidden flex flex-col items-center text-center shadow-xl transition-colors duration-200">
        {/* Soft Telegram Radial Spotlight */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-[70px] pointer-events-none opacity-40"
          style={{ background: 'radial-gradient(circle, #2AABEE 0%, transparent 70%)' }}
        />

        {/* Telegram Plane Icon */}
        <motion.div
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] p-3.5 flex items-center justify-center mb-4 shadow-xl shadow-sky-500/25 text-white cursor-pointer"
        >
          <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
          </svg>
        </motion.div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-black tracking-tight text-[var(--text-main)] m-0 flex items-center justify-center gap-2">
          <span>TGProxy</span>
          <span className="bg-gradient-to-r from-[#2AABEE] to-[#2481CC] bg-clip-text text-transparent">Hub</span>
        </h1>

        <p className="text-xs sm:text-sm md:text-base text-[var(--text-muted)] mt-2.5 mb-6 max-w-lg leading-relaxed font-normal">
          Суверенный генератор проверенных прокси{' '}
          <span className="text-[var(--text-main)] font-semibold">MTProto Fake-TLS</span> и{' '}
          <span className="text-[var(--text-main)] font-semibold">SOCKS5</span> с обходом ТСПУ
        </p>

        {/* 3 KPI Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-xl">
          <div className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>Серверы онлайн</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-main)]">
              {isLoading ? '...' : proxies.length}
            </div>
          </div>

          <div className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-full bg-[#E08244]" />
              <span>Лучший пинг</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-main)]">
              {stats.best_ping > 0 ? `${stats.best_ping} ms` : '—'}
            </div>
          </div>

          <div className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-full bg-[#2AABEE]" />
              <span>Синхронизация</span>
            </div>
            <div className="font-mono text-base sm:text-lg font-bold tracking-tight text-[var(--text-main)]">
              {stats.updated_at ? stats.updated_at.split(' ')[1]?.slice(0, 5) + ' UTC' : 'Недавно'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Fluid Preset Selector (Framer Motion layoutId) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full select-none">
        {[
          { id: 'anti-tspu', name: '🛡️ Анти-ТСПУ', desc: 'MTProto Fake-TLS' },
          { id: 'turbo', name: '⚡ Турбо-Пинг', desc: 'Пинг < 200 ms' },
          { id: 'socks5', name: '🧦 SOCKS5', desc: 'Telegram DC Tunnel' },
          { id: 'all', name: '🌐 Все прокси', desc: 'Полный пул' },
        ].map((item) => {
          const isActive = activePreset === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectPreset(item.id as any)}
              className="relative p-3 sm:p-3.5 rounded-2xl text-left border border-[var(--border-main)] transition-colors overflow-hidden cursor-pointer"
            >
              {isActive && (
                <motion.div
                  layoutId="tg-active-preset-bg"
                  className="absolute inset-0 bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] shadow-md"
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                />
              )}
              <div className="relative z-10">
                <div
                  className={`text-xs font-bold font-mono transition-colors ${
                    isActive ? 'text-white' : 'text-[var(--text-main)]'
                  }`}
                >
                  {item.name}
                </div>
                <div
                  className={`text-[10px] font-mono mt-0.5 transition-colors ${
                    isActive ? 'text-white/80' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {item.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. M3 Split Export Panel */}
      <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-4 sm:p-5 space-y-3.5 transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#2AABEE]/15 text-[#2AABEE] flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <span className="font-bold text-sm text-[var(--text-main)]">Экспорт прокси</span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              ({displayList.length} из {proxies.length} узлов)
            </span>
          </div>

          {/* Limit Selector */}
          <div className="flex items-center gap-1 text-[11px] font-mono bg-[var(--bg-app)] p-1 rounded-xl border border-[var(--border-main)]">
            <span className="text-[var(--text-muted)] px-1.5 hidden sm:inline">Лимит:</span>
            {[20, 50, 100, 0].map((lim) => {
              const isActive = limit === lim;
              return (
                <button
                  key={lim}
                  onClick={() => setLimit(lim)}
                  className={`relative px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                    isActive ? 'text-white font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tg-limit-bg"
                      className="absolute inset-0 bg-[#2481CC] rounded-lg"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{lim === 0 ? 'Все' : lim}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Telegram Split Action Button */}
        <div className="w-full flex items-stretch gap-1.5">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConnectFastest}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-bold text-sm font-mono flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 cursor-pointer"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
            </svg>
            <span>⚡ Подключить лучший прокси ({displayList.length} узлов)</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleCopyAll}
            title="Скопировать все ключи"
            className="px-4 rounded-2xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white flex items-center justify-center cursor-pointer shadow-lg shadow-sky-600/25"
          >
            <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          </motion.button>
        </div>

        {/* Shortcuts Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            onClick={handleConnectFastest}
            className="py-2.5 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-mono font-medium text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>📱 Telegram App</span>
          </button>
          <button
            onClick={handleCopyAll}
            className="py-2.5 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-mono font-medium text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>📋 Все ключи</span>
          </button>
          <button
            onClick={() => {
              if (displayList.length > 0) onOpenQr(displayList[0].tg_link);
            }}
            className="py-2.5 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-mono font-medium text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>🔳 QR-код</span>
          </button>
          <a
            href="https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt"
            download
            className="py-2.5 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-mono font-medium text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
          >
            <span>📥 Скачать .txt</span>
          </a>
        </div>
      </div>

      {/* 4. M3 Filter Accordion: Тонкая настройка */}
      <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] overflow-hidden transition-colors duration-200">
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          type="button"
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[var(--bg-card-hover)]/60 transition-colors text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[var(--bg-app)] border border-[var(--border-main)] flex items-center justify-center text-[#2AABEE]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <span className="font-display font-bold text-sm text-[var(--text-main)] block">Тонкая настройка</span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">(протоколы, страны, пинг)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#2AABEE]/15 text-[#2AABEE] text-[11px] font-mono font-bold">
              Активно:{' '}
              {(selectedProto !== 'all' ? 1 : 0) + (selectedCountry !== 'all' ? 1 : 0) + (maxPing > 0 ? 1 : 0)}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">{isAdvancedOpen ? '˄' : '˅'}</span>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isAdvancedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-[var(--border-main)] p-5 pt-3 space-y-4"
            >
              {/* Protocols */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2AABEE]" />
                  <span>Протоколы шифрования</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'mtproto', 'socks5'] as const).map((proto) => {
                    const isActive = selectedProto === proto;
                    const label = proto === 'all' ? 'Все' : proto === 'mtproto' ? '🛡️ Fake-TLS' : '🧦 SOCKS5';
                    const count = proto === 'all' ? proxies.length : stats[`total_${proto}` as keyof typeof stats];
                    return (
                      <button
                        key={proto}
                        onClick={() => setSelectedProto(proto)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-semibold shadow-xs'
                            : 'bg-[var(--bg-chip)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
                        }`}
                      >
                        <span>{label}</span>
                        <span className="opacity-80 text-[10px]">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ping Slider */}
              <div className="space-y-2 pt-2 border-t border-[var(--border-main)]">
                <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    <span>Фильтр задержки (Пинг)</span>
                  </div>
                  <span className="text-[#2AABEE] font-bold">
                    {maxPing > 0 ? `До ${maxPing} ms` : 'Все серверы'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 bg-[var(--bg-app)] p-1 rounded-xl border border-[var(--border-main)] text-xs font-mono">
                  {[150, 300, 0].map((ping) => {
                    const isActive = maxPing === ping;
                    return (
                      <button
                        key={ping}
                        onClick={() => setMaxPing(ping)}
                        className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#2481CC] text-white font-bold'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {ping > 0 ? `До ${ping} ms` : 'Все'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Countries */}
              <div className="space-y-2 pt-2 border-t border-[var(--border-main)]">
                <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E08244]" />
                  <span>Геолокации серверов</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedCountry('all')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all cursor-pointer ${
                      selectedCountry === 'all'
                        ? 'bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-semibold'
                        : 'bg-[var(--bg-chip)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
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
                        className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-semibold'
                            : 'bg-[var(--bg-chip)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
                        }`}
                      >
                        <CountryFlag countryCode={code} className="w-4 h-3 rounded-xs" />
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

      {/* 5. Live Telemetry Node List Accordion */}
      <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] overflow-hidden transition-colors duration-200">
        <button
          onClick={() => setIsTelemetryOpen(!isTelemetryOpen)}
          type="button"
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[var(--bg-card-hover)]/60 transition-colors text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[var(--bg-app)] border border-[var(--border-main)] flex items-center justify-center text-[#2AABEE]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <span className="font-display font-bold text-sm text-[var(--text-main)] block">
                Телеметрия проверенных узлов
              </span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                ({displayList.length} доступно)
              </span>
            </div>
          </div>
          <span className="text-xs text-[#2AABEE] font-mono font-bold">
            {isTelemetryOpen ? 'Скрыть список ˄' : 'Показать список ˅'}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {isTelemetryOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-[var(--border-main)] p-3 sm:p-4 pt-3 space-y-2"
            >
              {displayList.length === 0 ? (
                <div className="py-12 text-center text-[var(--text-muted)] text-xs font-mono">
                  Нет прокси под выбранные фильтры. Попробуйте сбросить ограничения.
                </div>
              ) : (
                displayList.map((p, idx) => {
                  const pingColor =
                    p.ping_ms < 200 ? 'text-[#10B981]' : p.ping_ms < 350 ? 'text-[#E08244]' : 'text-[#EF4444]';
                  const pingBg =
                    p.ping_ms < 200 ? 'bg-[#10B981]' : p.ping_ms < 350 ? 'bg-[#E08244]' : 'bg-[#EF4444]';
                  const protoLabel = p.proto === 'mtproto' ? 'Fake-TLS' : 'SOCKS5';
                  const hostDisplay = `${p.server}:${p.port}`;

                  return (
                    <motion.div
                      key={`${p.server}-${p.port}-${idx}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                      className="bg-[var(--bg-app)] border border-[var(--border-main)] rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-[#2AABEE]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#2481CC]/15 text-[#2AABEE] flex items-center justify-center font-bold text-xs font-mono shrink-0">
                          {idx + 1}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs sm:text-sm font-bold text-[var(--text-main)]">
                              {hostDisplay}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#2AABEE]/15 text-[#2AABEE] text-[10px] font-mono font-bold">
                              {protoLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <CountryFlag countryCode={p.country || 'GLOBAL'} className="w-3.5 h-2.5 rounded-xs" />
                              <span>{p.country_label || p.country || '🌐 Сервер'}</span>
                            </span>
                            <span className={`flex items-center gap-1 ${pingColor} font-bold`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${pingBg}`} />
                              {Math.round(p.ping_ms)} ms
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <a
                          href={p.tg_link}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white text-xs font-mono font-bold flex items-center gap-1 hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                        >
                          <span>Подключить ↗</span>
                        </a>
                        <button
                          onClick={() => handleCopySingle(p.tg_link)}
                          title="Скопировать ссылку"
                          className="p-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-white border border-[var(--border-main)] transition-colors cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
