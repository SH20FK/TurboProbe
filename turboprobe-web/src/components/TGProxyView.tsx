import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Shield, Zap, Search, Copy, QrCode, Download, ExternalLink, Lock, Check } from 'lucide-react';
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

/**
 * Extracts and decodes Fake-TLS SNI domain (e.g. apple.com, cloudflare.com, google.com)
 * from an MTProto secret hex string.
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
      // Tab filter
      if (activeTab === 'faketls') {
        if (p.proto !== 'mtproto' || !p.secret?.toLowerCase().startsWith('ee')) return false;
      } else if (activeTab === 'mtproto') {
        if (p.proto !== 'mtproto') return false;
      } else if (activeTab === 'socks5') {
        if (p.proto !== 'socks5') return false;
      } else if (activeTab === 'lowping') {
        if (p.ping_ms > 120) return false;
      }

      // Country filter
      if (selectedCountry !== 'all' && (p.country || 'GLOBAL') !== selectedCountry) {
        return false;
      }

      // Search query (IP, Port, Domain)
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
    if (filteredProxies.length === 0) {
      toast.error('Нет доступных прокси!');
      return;
    }
    const fastest = filteredProxies[0];
    toast.success('Подключение в Telegram...', `${fastest.server}:${fastest.port}`);
    window.location.href = fastest.tg_link;
  }, [filteredProxies, toast]);

  // Copy all visible links
  const handleCopyAll = useCallback(() => {
    if (filteredProxies.length === 0) {
      toast.error('Нет прокси для копирования!');
      return;
    }
    const text = filteredProxies.map((p) => p.tg_link).join('\n');
    toast.copy(text, `Скопировано ${filteredProxies.length} MTProto/SOCKS5 ссылок`);
  }, [filteredProxies, toast]);

  // Copy single link with micro-feedback
  const handleCopySingle = useCallback(
    (link: string, id: string) => {
      toast.copy(link, 'Ссылка прокси скопирована');
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    },
    [toast]
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* 1. Sleek Telegram Header Card */}
      <div className="relative rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-5 sm:p-7 overflow-hidden shadow-sm transition-colors duration-200">
        <div
          className="absolute -top-16 left-1/3 w-80 h-36 rounded-full blur-[70px] pointer-events-none opacity-30"
          style={{ background: 'radial-gradient(circle, #2AABEE 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] p-3 flex items-center justify-center text-white shadow-md shadow-sky-500/25 shrink-0">
              <Send className="w-full h-full fill-current" />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-[var(--text-main)] m-0">
                  TGProxy Hub
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-[#2481CC]/15 text-[#2AABEE] text-[10px] font-mono font-bold">
                  v2.0
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                Автоматический сбор и проверка <span className="text-[var(--text-main)] font-semibold">MTProto Fake-TLS</span> для стабильной работы в РФ
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="font-mono text-xs font-bold text-[var(--text-main)]">
                {isLoading ? '...' : proxies.length} узлов
              </span>
            </div>

            <div className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#2AABEE]" />
              <span className="font-mono text-xs font-bold text-[var(--text-main)]">
                {stats.best_ping > 0 ? `${stats.best_ping} ms` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* 1-Click Fast Actions Bar */}
        <div className="pt-4 mt-4 border-t border-[var(--border-main)] flex flex-col sm:flex-row items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConnectFastest}
            className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-display text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-600/25 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 fill-current" />
            <span>⚡ Включить лучший MTProto в Telegram (1 клик)</span>
          </motion.button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyAll}
              className="flex-1 sm:flex-none py-2.5 px-3.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-display font-semibold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#2AABEE]" />
              <span>Скопировать все</span>
            </button>

            <button
              onClick={() => {
                if (filteredProxies.length > 0) onOpenQr(filteredProxies[0].tg_link);
              }}
              title="QR-код для телефона"
              className="p-2.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-main)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-[#2AABEE]" />
            </button>

            <a
              href="https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt"
              download
              title="Скачать .txt список"
              className="p-2.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-main)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#2AABEE]" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. Filter & Navigation Deck */}
      <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-4 sm:p-5 space-y-3.5 shadow-sm transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs: MTProto Fake-TLS vs SOCKS5 vs Low Ping */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[var(--bg-app)] p-1 rounded-2xl border border-[var(--border-main)] select-none">
            {[
              { id: 'all', label: 'Все прокси', count: proxies.length },
              { id: 'faketls', label: '🛡️ Fake-TLS', count: proxies.filter((p) => p.secret?.toLowerCase().startsWith('ee')).length },
              { id: 'mtproto', label: '🔒 MTProto', count: stats.total_mtproto || proxies.filter((p) => p.proto === 'mtproto').length },
              { id: 'socks5', label: '🧦 SOCKS5', count: stats.total_socks5 || proxies.filter((p) => p.proto === 'socks5').length },
              { id: 'lowping', label: '⚡ < 120 ms', count: proxies.filter((p) => p.ping_ms <= 120).length },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-display font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isActive ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tg-tab-active-pill"
                      className="absolute inset-0 bg-gradient-to-r from-[#2481CC] to-[#2AABEE] rounded-xl shadow-xs"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                  <span className={`relative z-10 text-[10px] font-mono ${isActive ? 'text-white/80' : 'opacity-60'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Поиск по IP / SNI домену..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-main)] text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#2AABEE]/60 transition-colors"
            />
          </div>
        </div>

        {/* Country Flags Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none text-xs font-mono">
          <span className="text-[var(--text-muted)] text-[11px] shrink-0 mr-1">Страны:</span>
          <button
            onClick={() => setSelectedCountry('all')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
              selectedCountry === 'all'
                ? 'bg-[#2481CC] text-white font-bold'
                : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
            }`}
          >
            Все
          </button>
          {countryCounts.map(([code, count]) => {
            const isSelected = selectedCountry === code;
            return (
              <button
                key={code}
                onClick={() => setSelectedCountry(code)}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#2481CC] text-white font-bold'
                    : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
                }`}
              >
                <CountryFlag countryCode={code} className="w-3.5 h-2.5 rounded-xs" />
                <span>{code === 'GLOBAL' ? 'Серверы' : code}</span>
                <span className="opacity-70 text-[10px]">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Pure Telegram Proxy List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-2 text-xs font-mono text-[var(--text-muted)]">
          <span>Найдено серверов: <strong className="text-[var(--text-main)]">{filteredProxies.length}</strong></span>
          <span>Автопроверка пинга каждые 2 часа</span>
        </div>

        {filteredProxies.length === 0 ? (
          <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-12 text-center text-xs font-mono text-[var(--text-muted)]">
            {isLoading ? 'Загрузка проверенных прокси...' : 'Нет прокси под выбранные фильтры.'}
          </div>
        ) : (
          filteredProxies.map((p, idx) => {
            const { domain, type: secretType } = extractTlsDomain(p.secret);
            const isFakeTls = p.proto === 'mtproto' && secretType === 'faketls';
            const isSocks = p.proto === 'socks5';
            const pingColor = p.ping_ms < 100 ? 'text-[#10B981]' : p.ping_ms < 250 ? 'text-[#2AABEE]' : 'text-[#E08244]';
            const pingBg = p.ping_ms < 100 ? 'bg-[#10B981]' : p.ping_ms < 250 ? 'bg-[#2AABEE]' : 'bg-[#E08244]';
            const cardId = `${p.server}-${p.port}-${idx}`;
            const isCopied = copiedId === cardId;

            return (
              <motion.div
                key={cardId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: Math.min(idx * 0.015, 0.2) }}
                className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#2AABEE]/40 transition-colors shadow-xs group"
              >
                {/* Left Info: Host, SNI domain, Flag, Ping */}
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[var(--bg-app)] border border-[var(--border-main)] flex items-center justify-center text-[#2AABEE] shrink-0 mt-0.5 sm:mt-0 font-mono text-xs font-bold">
                    {idx + 1}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[var(--text-main)] truncate">
                        {p.server}:{p.port}
                      </span>

                      {/* Protocol Badge */}
                      {isFakeTls ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] text-[10px] font-mono font-bold flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" />
                          <span>Fake-TLS</span>
                        </span>
                      ) : isSocks ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#E08244]/15 text-[#E08244] text-[10px] font-mono font-bold">
                          SOCKS5
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[#2AABEE]/15 text-[#2AABEE] text-[10px] font-mono font-bold">
                          MTProto
                        </span>
                      )}

                      {/* SNI Masking Domain Badge (e.g. apple.com, cloudflare.com) */}
                      {domain && (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--bg-app)] border border-[var(--border-main)] text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-[#2AABEE]" />
                          <span>tls: {domain}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)]">
                      <span className="flex items-center gap-1.5">
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

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <a
                    href={p.tg_link}
                    className="py-2 px-3.5 rounded-xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white font-display text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Подключить</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => handleCopySingle(p.tg_link, cardId)}
                    title="Скопировать ссылку"
                    className="p-2 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
