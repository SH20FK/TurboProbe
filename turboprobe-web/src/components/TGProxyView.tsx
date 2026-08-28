import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Send,
  Shield,
  Search,
  Copy,
  QrCode,
  Lock,
  Check,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useToast } from './ui/M3Toast';
import { M3Ripple } from './ui/M3Ripple';
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

/**
 * SVG Speedometer / Ping Radar for M3 Expressive Hero Card
 */
const PingGauge: React.FC<{ ping: number }> = ({ ping }) => {
  const percentage = Math.min(Math.max((300 - ping) / 250, 0.1), 1);
  const strokeDashoffset = 125.6 * (1 - percentage * 0.75);
  const color = ping <= 80 ? '#34D399' : ping <= 160 ? '#2AABEE' : '#F59E0B';

  return (
    <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shrink-0 select-none">
      <svg className="w-full h-full -rotate-135 transform" viewBox="0 0 48 48">
        {/* Background Track */}
        <circle
          cx="24"
          cy="24"
          r="19"
          className="stroke-black/10 dark:stroke-white/10"
          strokeWidth="3.5"
          strokeDasharray="125.6"
          strokeDashoffset="31.4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Active Animated Gauge */}
        <motion.circle
          cx="24"
          cy="24"
          r="19"
          stroke={color}
          strokeWidth="4"
          strokeDasharray="125.6"
          initial={{ strokeDashoffset: 125.6 }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm sm:text-base font-display font-black leading-none tracking-tight text-[var(--text-main)]">
          {ping > 0 ? ping : '—'}
        </span>
        <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
          ms
        </span>
      </div>
    </div>
  );
};

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

  const [activeTab, setActiveTab] = useState<'all' | 'faketls' | 'mtproto' | 'socks5' | 'lowping'>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
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
      if (activeTab === 'faketls') {
        if (p.proto !== 'mtproto' || !p.secret?.toLowerCase().startsWith('ee')) return false;
      } else if (activeTab === 'mtproto') {
        if (p.proto !== 'mtproto') return false;
      } else if (activeTab === 'socks5') {
        if (p.proto !== 'socks5') return false;
      } else if (activeTab === 'lowping') {
        if (p.ping_ms > 120) return false;
      }

      if (selectedCountry !== 'all' && (p.country || 'GLOBAL') !== selectedCountry) {
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
  }, [proxies, activeTab, selectedCountry, searchQuery]);

  // Featured Flagship Proxy (Top 1 lowest ping with Fake-TLS)
  const featuredProxy = useMemo(() => {
    if (proxies.length === 0) return null;
    const fakeTlsList = proxies.filter((p) => p.proto === 'mtproto' && p.secret?.toLowerCase().startsWith('ee'));
    const pool = fakeTlsList.length > 0 ? fakeTlsList : proxies;
    return [...pool].sort((a, b) => (a.ping_ms || 999) - (b.ping_ms || 999))[0];
  }, [proxies]);

  // Country counts
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    proxies.forEach((p) => {
      const c = p.country || 'GLOBAL';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [proxies]);

  // Connect Fastest in 1 click
  const handleConnectFastest = useCallback(() => {
    const target = featuredProxy || filteredProxies[0];
    if (!target) {
      toast.error('Нет доступных прокси!');
      return;
    }
    toast.success('Подключение в Telegram...', `${target.server}:${target.port}`);
    window.location.href = target.tg_link;
  }, [featuredProxy, filteredProxies, toast]);

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
    if (filteredProxies.length === 0) {
      toast.error('Нет прокси для копирования!');
      return;
    }
    const text = filteredProxies.map((p) => p.tg_link).join('\n');
    toast.copy(text, `Скопировано ${filteredProxies.length} MTProto ссылок`);
  }, [filteredProxies, toast]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-5 select-none font-body">
      {/* 1. M3 EXPRESSIVE HERO BENTO: ФЛАГМАНСКИЙ ПРОКСИ-УЗЕЛ */}
      {featuredProxy && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-[28px] sm:rounded-[32px] bg-gradient-to-br from-[#172635] via-[#121D28] to-[#0D151D] p-4 sm:p-6 overflow-hidden shadow-xl border border-white/10 dark:border-white/5"
        >
          {/* Subtle Ambient Material Glow */}
          <div
            className="absolute -top-20 -right-16 w-72 h-72 rounded-full blur-[80px] pointer-events-none opacity-25"
            style={{ background: 'radial-gradient(circle, #2AABEE 0%, transparent 70%)' }}
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            {/* Left Info Column */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2AABEE]/15 text-[#2AABEE] text-xs font-mono font-bold tracking-tight">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Флагманский Fake-TLS узел</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Online · RU-Pass</span>
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <CountryFlag countryCode={featuredProxy.country || 'GLOBAL'} className="w-6 h-4 sm:w-7 sm:h-5 rounded-md shadow-sm shrink-0" />
                  <h2 className="text-lg sm:text-2xl font-display font-black text-white tracking-tight">
                    {featuredProxy.country_label || featuredProxy.country || 'Европейский узел'}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1.5 font-mono text-xs text-white/70">
                  <span className="bg-black/30 px-2.5 py-1 rounded-lg text-white font-bold">
                    {featuredProxy.server}:{featuredProxy.port}
                  </span>
                  {(() => {
                    const { domain } = extractTlsDomain(featuredProxy.secret);
                    return domain ? (
                      <span className="inline-flex items-center gap-1 bg-white/10 text-white/90 px-2.5 py-1 rounded-lg">
                        <Lock className="w-3 h-3 text-[#2AABEE]" />
                        <span>Маскировка: <strong>{domain}</strong></span>
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            {/* Right Speedometer & Action */}
            <div className="flex items-center gap-3 sm:gap-4 self-start md:self-center shrink-0">
              <div className="flex items-center gap-2.5 bg-black/25 px-3 py-2 rounded-2xl">
                <PingGauge ping={Math.round(featuredProxy.ping_ms || 0)} />
                <div className="text-left font-mono">
                  <div className="text-[10px] text-white/50 uppercase">Задержка</div>
                  <div className="text-xs font-bold text-emerald-400">Сверхбыстро</div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleConnectFastest}
                className="relative overflow-hidden h-12 sm:h-14 px-5 sm:px-6 rounded-[20px] bg-gradient-to-r from-[#2481CC] to-[#2AABEE] text-white font-display text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 cursor-pointer"
              >
                <Send className="w-4 h-4 fill-current" />
                <span>Подключить</span>
                <ArrowUpRight className="w-4 h-4" />
                <M3Ripple color="#FFFFFF" />
              </motion.button>
            </div>
          </div>

          {/* Quick Utility Actions Footer */}
          <div className="relative z-10 pt-3.5 mt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono text-white/60">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Автопроверка ТСПУ каждые 2 часа · Zero Logs</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopySingle(featuredProxy.tg_link, 'featured')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 transition-colors cursor-pointer"
              >
                {copiedId === 'featured' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'featured' ? 'Скопировано' : 'Копировать MTProto'}</span>
              </button>

              <button
                onClick={() => onOpenQr(featuredProxy.tg_link)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 transition-colors cursor-pointer"
                title="Показать QR-код"
              >
                <QrCode className="w-3.5 h-3.5 text-[#2AABEE]" />
                <span>QR-код</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. M3 EXPRESSIVE CONTROLS & FILTER DECK */}
      <div className="rounded-[28px] bg-[var(--bg-card)] p-4 sm:p-5 space-y-3.5 shadow-sm border border-[var(--border-main)] transition-colors duration-200">
        {/* Top Controls Row: Segmented Button + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* M3 Segmented Button */}
          <div className="flex items-center gap-1 bg-[var(--bg-app)] p-1 rounded-2xl overflow-x-auto scrollbar-none border border-[var(--border-main)]">
            {[
              { id: 'all', label: 'Все', count: proxies.length },
              { id: 'faketls', label: '🛡️ Fake-TLS', count: proxies.filter((p) => p.secret?.toLowerCase().startsWith('ee')).length },
              { id: 'mtproto', label: '🔒 MTProto', count: stats.total_mtproto || proxies.filter((p) => p.proto === 'mtproto').length },
              { id: 'socks5', label: '🧦 SOCKS5', count: stats.total_socks5 || proxies.filter((p) => p.proto === 'socks5').length },
              { id: 'lowping', label: '⚡ <120ms', count: proxies.filter((p) => p.ping_ms <= 120).length },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-display font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
                    isActive ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="m3-active-tg-tab"
                      className="absolute inset-0 bg-[#2481CC] rounded-xl shadow-xs"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                  <span
                    className={`relative z-10 text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-black/25 text-white' : 'bg-[var(--bg-card)] opacity-70'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* M3 Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Поиск по IP, порту, SNI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--bg-app)] text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/50 border border-[var(--border-main)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Row: M3 Filter Chips for Countries */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none text-xs font-mono">
          <span className="text-[var(--text-muted)] text-[11px] shrink-0 mr-1 font-sans">Локация:</span>

          <button
            onClick={() => setSelectedCountry('all')}
            className={`h-8 px-3 rounded-full transition-all cursor-pointer shrink-0 flex items-center gap-1.5 font-bold ${
              selectedCountry === 'all'
                ? 'bg-[#2AABEE] text-white shadow-xs'
                : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
            }`}
          >
            {selectedCountry === 'all' && <Check className="w-3 h-3 stroke-[3]" />}
            <span>Все страны</span>
          </button>

          {countryCounts.map(([code, count]) => {
            const isSelected = selectedCountry === code;
            return (
              <button
                key={code}
                onClick={() => setSelectedCountry(code)}
                className={`h-8 px-3 rounded-full transition-all cursor-pointer shrink-0 flex items-center gap-1.5 font-medium ${
                  isSelected
                    ? 'bg-[#2AABEE] text-white font-bold shadow-xs'
                    : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
                }`}
              >
                {isSelected ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <CountryFlag countryCode={code} className="w-3.5 h-2.5 rounded-xs" />
                )}
                <span>{code === 'GLOBAL' ? 'Серверы' : code}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded-full ${
                    isSelected ? 'bg-black/20 text-white' : 'opacity-60'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. M3 PROXY NODES BENTO GRID (2 Columns on Desktop) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-2 text-xs font-mono text-[var(--text-muted)]">
          <span>
            Отобрано серверов: <strong className="text-[var(--text-main)] font-bold">{filteredProxies.length}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="hover:text-[var(--text-main)] underline cursor-pointer flex items-center gap-1"
            >
              <Copy className="w-3 h-3 text-[#2AABEE]" />
              <span>Скопировать все ({filteredProxies.length})</span>
            </button>
          </div>
        </div>

        {filteredProxies.length === 0 ? (
          <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-12 text-center text-xs font-mono text-[var(--text-muted)] space-y-2">
            <div>{isLoading ? 'Проверка доступности MTProto серверов...' : 'Нет серверов под выбранные параметры.'}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProxies.map((p, idx) => {
              const { domain, type: secretType } = extractTlsDomain(p.secret);
              const isFakeTls = p.proto === 'mtproto' && secretType === 'faketls';
              const isSocks = p.proto === 'socks5';
              const pingMs = Math.round(p.ping_ms || 0);
              const pingColor = pingMs <= 80 ? 'text-emerald-400' : pingMs <= 160 ? 'text-sky-400' : 'text-amber-400';
              const pingBg = pingMs <= 80 ? 'bg-emerald-400' : pingMs <= 160 ? 'bg-sky-400' : 'bg-amber-400';
              const cardId = `${p.server}-${p.port}-${idx}`;
              const isCopied = copiedId === cardId;

              return (
                <motion.div
                  key={cardId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.25) }}
                  className="rounded-[24px] bg-[var(--bg-card)] border border-[var(--border-main)] p-4 flex flex-col justify-between gap-3.5 hover:border-[#2AABEE]/40 transition-colors shadow-xs group"
                >
                  {/* Top: Flag + Host + Protocol Badges */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CountryFlag countryCode={p.country || 'GLOBAL'} className="w-5 h-3.5 rounded-xs shrink-0" />
                        <span className="font-mono text-xs font-bold text-[var(--text-main)] truncate">
                          {p.server}:{p.port}
                        </span>
                      </div>

                      {/* Ping Pill */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-app)] font-mono text-[11px] font-bold ${pingColor} shrink-0 border border-[var(--border-main)]`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${pingBg}`} />
                        <span>{pingMs} ms</span>
                      </span>
                    </div>

                    {/* Protocol & SNI Masking Bar */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                      {isFakeTls ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-bold flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" />
                          <span>Fake-TLS</span>
                        </span>
                      ) : isSocks ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-bold">
                          SOCKS5
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 font-bold">
                          MTProto
                        </span>
                      )}

                      {domain && (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-app)] border border-[var(--border-main)] text-[var(--text-muted)] flex items-center gap-1 truncate max-w-[170px]">
                          <Lock className="w-2.5 h-2.5 text-[#2AABEE]" />
                          <span className="truncate">{domain}</span>
                        </span>
                      )}

                      <span className="text-[var(--text-muted)] ml-auto">
                        {p.country_label || p.country || 'Глобальный'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Fast Actions (1-Click Connect + Copy + QR) */}
                  <div className="pt-2.5 border-t border-[var(--border-main)] flex items-center gap-2">
                    <a
                      href={p.tg_link}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#2481CC] to-[#2AABEE] text-white font-display text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-97 transition-all cursor-pointer"
                    >
                      <Send className="w-3 h-3 fill-current" />
                      <span>Подключить</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>

                    <button
                      onClick={() => handleCopySingle(p.tg_link, cardId)}
                      title="Скопировать MTProto ссылку"
                      className="p-2.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer shrink-0"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => onOpenQr(p.tg_link)}
                      title="QR-код для смартфона"
                      className="p-2.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer shrink-0"
                    >
                      <QrCode className="w-3.5 h-3.5 text-[#2AABEE]" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
