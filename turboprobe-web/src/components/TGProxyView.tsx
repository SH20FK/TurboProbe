import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Zap, Gauge, Flame, Check, Search, QrCode, Copy, Download, Send, ArrowUpRight } from 'lucide-react';
import { useToast } from './ui/M3Toast';
import { CountryFlag } from './CountryFlags';
import { M3Ripple } from './ui/M3Ripple';
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

const PING_STEPS = [
  { val: 150, label: '< 150 ms', desc: 'Турбо', color: '#10B981', icon: <Zap className="w-3.5 h-3.5" /> },
  { val: 300, label: '< 300 ms', desc: 'Комфорт', color: '#2AABEE', icon: <Gauge className="w-3.5 h-3.5" /> },
  { val: 500, label: '< 500 ms', desc: 'Стандарт', color: '#E08244', icon: <Flame className="w-3.5 h-3.5" /> },
  { val: 0, label: 'Все узлы', desc: 'Без лимита', color: '#2481CC', icon: <Check className="w-3.5 h-3.5" /> },
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
  const [searchQuery, setSearchQuery] = useState<string>('');
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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const host = `${p.server}:${p.port}`.toLowerCase();
        const country = (p.country_label || p.country || '').toLowerCase();
        if (!host.includes(q) && !country.includes(q)) return false;
      }
      return true;
    });
  }, [proxies, selectedProto, selectedCountry, maxPing, searchQuery]);

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
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* 1. Sleek Integrated Header Banner */}
      <div className="relative rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-5 sm:p-7 overflow-hidden shadow-lg transition-colors duration-200">
        <div
          className="absolute -top-20 left-1/4 w-80 h-40 rounded-full blur-[75px] pointer-events-none opacity-35"
          style={{ background: 'radial-gradient(circle, #2AABEE 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5">
          {/* Brand Info */}
          <div className="flex items-center gap-4 text-center md:text-left">
            <motion.div
              whileHover={{ scale: 1.06, rotate: 6 }}
              whileTap={{ scale: 0.94 }}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] p-3.5 flex items-center justify-center shadow-lg shadow-sky-500/25 text-white shrink-0"
            >
              <Send className="w-full h-full fill-current" />
            </motion.div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-[var(--text-main)] m-0 flex items-center justify-center md:justify-start gap-2">
                <span>TGProxy</span>
                <span className="bg-gradient-to-r from-[#2AABEE] to-[#2481CC] bg-clip-text text-transparent">Hub</span>
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 font-normal max-w-md">
                Суверенные прокси <span className="text-[var(--text-main)] font-semibold">MTProto Fake-TLS</span> и{' '}
                <span className="text-[var(--text-main)] font-semibold">SOCKS5</span> с обходом ТСПУ
              </p>
            </div>
          </div>

          {/* 3 Live KPI Stat Badges */}
          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-center">
            <div className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3.5 py-2 rounded-2xl flex flex-col items-center md:items-start shadow-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                Онлайн
              </span>
              <span className="font-mono text-lg sm:text-xl font-bold text-[var(--text-main)]">
                {isLoading ? '...' : proxies.length}
              </span>
            </div>

            <div className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3.5 py-2 rounded-2xl flex flex-col items-center md:items-start shadow-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#2AABEE]" />
                Пинг
              </span>
              <span className="font-mono text-lg sm:text-xl font-bold text-[var(--text-main)]">
                {stats.best_ping > 0 ? `${stats.best_ping} ms` : '—'}
              </span>
            </div>

            <div className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3.5 py-2 rounded-2xl flex flex-col items-center md:items-start shadow-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#E08244]" />
                Сверка
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-[var(--text-main)] mt-1">
                {stats.updated_at ? stats.updated_at.split(' ')[1]?.slice(0, 5) + ' UTC' : 'Недавно'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main 2-Column Bento Command Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Controls, Presets, Export & Filters (5 cols) */}
        <div className="md:col-span-5 space-y-4">
          {/* Card 1: Presets & 1-Click Action */}
          <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-4 sm:p-5 space-y-4 shadow-sm transition-colors duration-200">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2AABEE]" />
              <span>Быстрые пресеты</span>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'anti-tspu', name: '🛡️ Анти-ТСПУ', desc: 'MTProto Fake-TLS' },
                { id: 'turbo', name: '⚡ Турбо-Пинг', desc: '< 200 ms' },
                { id: 'socks5', name: '🧦 SOCKS5', desc: 'DC Tunnel' },
                { id: 'all', name: '🌐 Все узлы', desc: 'Полный срез' },
              ].map((item) => {
                const isActive = activePreset === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectPreset(item.id as any)}
                    className="relative p-2.5 sm:p-3 rounded-2xl text-left border border-[var(--border-main)] transition-colors overflow-hidden cursor-pointer"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="tg-preset-active-indicator"
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

            {/* Big Action Button */}
            <div className="w-full flex items-stretch gap-1.5 pt-1">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConnectFastest}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-bold text-sm font-mono flex items-center justify-center gap-2 shadow-lg shadow-sky-600/25 cursor-pointer"
              >
                <Send className="w-4 h-4 fill-current" />
                <span>Подключить лучший ({displayList.length})</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleCopyAll}
                title="Скопировать все ссылки"
                className="px-3.5 rounded-2xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-main)] flex items-center justify-center cursor-pointer"
              >
                <Copy className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Quick Action Pills */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={handleConnectFastest}
                className="py-2 px-2.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[11px] font-mono font-medium text-[var(--text-main)] flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <span>📱 App</span>
              </button>
              <button
                onClick={() => {
                  if (displayList.length > 0) onOpenQr(displayList[0].tg_link);
                }}
                className="py-2 px-2.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[11px] font-mono font-medium text-[var(--text-main)] flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR</span>
              </button>
              <a
                href="https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt"
                download
                className="py-2 px-2.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[11px] font-mono font-medium text-[var(--text-main)] flex items-center justify-center gap-1 transition-colors cursor-pointer text-center"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.txt</span>
              </a>
            </div>
          </div>

          {/* Card 2: Interactive M3 Ping Slider & Fine Tuning */}
          <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-4 sm:p-5 space-y-4 shadow-sm transition-colors duration-200">
            {/* Ping Slider Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  <span>Регулятор пинга</span>
                </span>
                <span className="text-[#2AABEE] font-bold">
                  {maxPing > 0 ? `< ${maxPing} ms` : 'Все серверы'}
                </span>
              </div>

              {/* M3 Interactive Ping Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PING_STEPS.map((step) => {
                  const isSelected = maxPing === step.val;
                  return (
                    <motion.button
                      key={step.val}
                      onClick={() => setMaxPing(step.val)}
                      whileHover={{ y: -1, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      className={`relative p-2.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-center border transition-colors cursor-pointer overflow-hidden select-none shadow-xs ${
                        isSelected
                          ? 'bg-[var(--bg-app)] border-[#2AABEE] shadow-[0_0_12px_rgba(42,171,238,0.22)]'
                          : 'bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border-[var(--border-main)]'
                      }`}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="tg-ping-indicator"
                          className="absolute inset-0 bg-[#2AABEE]/15 rounded-2xl border border-[#2AABEE]"
                          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-1 font-display text-[11px] font-bold text-[var(--text-main)]">
                        <span style={{ color: step.color }}>{step.icon}</span>
                        <span>{step.label}</span>
                      </div>
                      <span className="relative z-10 text-[9px] font-mono text-[var(--text-muted)]">
                        {step.desc}
                      </span>
                      <M3Ripple color={step.color} />
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Protocol Chips */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-main)]">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2AABEE]" />
                <span>Протокол</span>
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
                      className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-semibold shadow-xs'
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

            {/* Country Filter Chips */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-main)]">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E08244]" />
                <span>Геолокация</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                <button
                  onClick={() => setSelectedCountry('all')}
                  className={`px-3 py-1 rounded-full text-xs font-mono transition-all cursor-pointer ${
                    selectedCountry === 'all'
                      ? 'bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-semibold'
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
                          ? 'bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-semibold'
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

            {/* Limit Selector */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-main)] text-xs font-mono">
              <span className="text-[var(--text-muted)]">Лимит выдачи:</span>
              <div className="flex items-center gap-1 bg-[var(--bg-app)] p-1 rounded-xl border border-[var(--border-main)]">
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
                          layoutId="tg-limit-active-pill"
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
          </div>
        </div>

        {/* RIGHT COLUMN: Live Telemetry Stream (7 cols) */}
        <div className="md:col-span-7 rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-4 sm:p-5 space-y-3.5 shadow-sm transition-colors duration-200">
          {/* Stream Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[var(--border-main)]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="font-display font-bold text-sm text-[var(--text-main)]">Телеметрия узлов</span>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                ({displayList.length} из {proxies.length})
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Поиск по IP / стране..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 rounded-xl bg-[var(--bg-app)] border border-[var(--border-main)] text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#2AABEE]/50 transition-colors"
              />
            </div>
          </div>

          {/* Node Cards Stream */}
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {displayList.length === 0 ? (
              <div className="py-16 text-center text-[var(--text-muted)] text-xs font-mono">
                {isLoading ? 'Загрузка проверенных прокси...' : 'Нет узлов под выбранные фильтры.'}
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
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(idx * 0.015, 0.25) }}
                    className="bg-[var(--bg-app)] border border-[var(--border-main)] rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-[#2AABEE]/40 transition-colors group"
                  >
                    {/* Left: Index + Info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-[#2481CC]/15 text-[#2AABEE] flex items-center justify-center font-bold text-[11px] font-mono shrink-0">
                        {idx + 1}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs sm:text-sm font-bold text-[var(--text-main)] truncate">
                            {hostDisplay}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-[#2AABEE]/15 text-[#2AABEE] text-[9px] font-mono font-bold shrink-0">
                            {protoLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
                          <span className="flex items-center gap-1 shrink-0">
                            <CountryFlag countryCode={p.country || 'GLOBAL'} className="w-3 h-2 rounded-xs" />
                            <span>{p.country_label || p.country || '🌐 Сервер'}</span>
                          </span>

                          <span className={`flex items-center gap-1 ${pingColor} font-bold shrink-0`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pingBg}`} />
                            {Math.round(p.ping_ms)} ms
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={p.tg_link}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white text-xs font-mono font-bold flex items-center gap-1 hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                      >
                        <span>Подключить</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleCopySingle(p.tg_link)}
                        title="Скопировать ссылку"
                        className="p-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-white border border-[var(--border-main)] transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
