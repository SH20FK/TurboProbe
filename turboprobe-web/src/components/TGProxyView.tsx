import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Copy,
  QrCode,
  Download,
  Check,
  Lock,
  X,
  ChevronDown,
  ShieldCheck,
  Activity,
  Server,
  Sparkles,
  Globe,
} from 'lucide-react';
import { useToast } from './ui/M3Toast';
import { CountryFlag } from './CountryFlags';
import { getCountryName } from '../constants';
import { TelegramIcon } from './ServiceIcons';
import type { TgProxyItem } from '../types';

interface TGProxyViewProps {
  onOpenQr: (url: string) => void;
}

const TG_PROXIES_MIRRORS = [
  'tg/proxies.json',
  './tg/proxies.json',
  'sub/tg/proxies.json',
  './sub/tg/proxies.json',
  'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/proxies.json',
  'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/tg/proxies.json',
  'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/sub/tg/proxies.json',
  'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/docs/tg/proxies.json',
];

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
    return { domain: 'TLS', type: 'faketls' };
  }

  if (hex.startsWith('dd')) {
    return { domain: null, type: 'dd' };
  }

  return { domain: null, type: 'classic' };
}

const RU_WHITE_DOMAINS = new Set([
  'vk.com', 'vk.ru', 'ya.ru', 'yandex.ru', 'yandex.com', 'yandex.net', '2gis.ru', '2gis.com',
  'gosuslugi.ru', 'avito.ru', 'ozon.ru', 'wildberries.ru', 'wb.ru', 'rzd.ru', 'sber.ru',
  'sberbank.ru', 'tinkoff.ru', 'tbank.ru', 'vtb.ru', 'alfabank.ru', 'dzen.ru', 'rutube.ru',
  'mail.ru', 'ok.ru', 'kinopoisk.ru', 'mts.ru', 'beeline.ru', 'megafon.ru', 'tele2.ru',
  'lemanapro.ru', 'hcaptcha.com', 'cloudflare.com', 'google.com'
]);

function isRussianWhiteSni(domain: string | null): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase().trim();
  if (RU_WHITE_DOMAINS.has(d)) return true;
  for (const w of RU_WHITE_DOMAINS) {
    if (d.endsWith('.' + w)) return true;
  }
  return false;
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

  const [activeTab, setActiveTab] = useState<'all' | 'faketls' | 'socks5'>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => proxies.length === 0);
  const [visibleLimit, setVisibleLimit] = useState<number>(15);
  const [isExpandedCountries, setIsExpandedCountries] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    const fetchWithTimeout = async (url: string, ms = 4000) => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        clearTimeout(tid);
        throw err;
      }
    };

    async function loadData() {
      const cacheBust = Date.now();
      const urls = TG_PROXIES_MIRRORS.map((m) => `${m}?t=${cacheBust}`);

      try {
        let data: any = null;
        for (const u of urls) {
          try {
            data = await fetchWithTimeout(u, 2500);
            if (data && Array.isArray(data.proxies) && data.proxies.length > 0) break;
          } catch {
            // try next mirror
          }
        }

        if (data && isMounted) {
          const list: TgProxyItem[] = data.proxies || [];
          setProxies(list);
          const newStats = {
            total: data.total || list.length,
            total_mtproto: data.total_mtproto || list.filter((p: TgProxyItem) => p.proto === 'mtproto').length,
            total_socks5: data.total_socks5 || list.filter((p: TgProxyItem) => p.proto === 'socks5').length,
            best_ping: data.best_ping || (list[0]?.ping_ms ? Math.round(list[0].ping_ms) : 0),
            updated_at: data.updated_at || '',
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

  const filteredProxies = useMemo(() => {
    return proxies.filter((p) => {
      if (activeTab === 'faketls') {
        if (p.proto !== 'mtproto' || !p.secret?.toLowerCase().startsWith('ee')) return false;
      } else if (activeTab === 'socks5') {
        if (p.proto !== 'socks5') return false;
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

  useEffect(() => {
    setVisibleLimit(15);
  }, [activeTab, selectedCountry, searchQuery]);

  const displayedProxies = useMemo(() => {
    return filteredProxies.slice(0, visibleLimit);
  }, [filteredProxies, visibleLimit]);

  const hasMore = filteredProxies.length > visibleLimit;

  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    proxies.forEach((p) => {
      const c = p.country || 'GLOBAL';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [proxies]);

  const handleConnectFastest = useCallback(() => {
    if (filteredProxies.length > 0) {
      window.location.href = filteredProxies[0].tg_link;
      toast.success('Подключение к прокси', `${filteredProxies[0].server}:${filteredProxies[0].port}`);
    } else {
      toast.error('Нет доступных прокси');
    }
  }, [filteredProxies, toast]);

  const handleCopySingle = useCallback(
    (link: string, id: string) => {
      toast.copy(link, 'Ссылка на прокси скопирована');
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    },
    [toast]
  );

  const handleCopyAll = useCallback(() => {
    if (filteredProxies.length === 0) {
      toast.error('Нет прокси для копирования');
      return;
    }
    const text = filteredProxies.map((p) => p.tg_link).join('\n');
    toast.copy(text, `Скопировано ${filteredProxies.length} ссылок`);
  }, [filteredProxies, toast]);

  return (
    <div className="w-full space-y-4 font-body">
      {/* 1. Hero Header Card with Telegram Blue Gradient */}
      <div className="relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] p-5 sm:p-6 overflow-hidden shadow-sm transition-colors">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#2481CC]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] p-3 flex items-center justify-center text-white shrink-0 shadow-[0_4px_16px_rgba(36,129,204,0.35)]">
              <TelegramIcon className="w-full h-full fill-current" />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[var(--text-main)] m-0">
                  TGProxy Hub
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-mono font-medium">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Live
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 font-normal">
                Проверенные прокси MTProto Fake-TLS и SOCKS5 для Telegram
              </p>
            </div>
          </div>

          {/* Real-time Telemetry Badges */}
          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
            <div className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs">
              <Server className="w-3.5 h-3.5 text-[#2481CC]" />
              <span className="text-[var(--text-muted)]">Узлов:</span>
              <span className="font-bold text-[var(--text-main)]">{proxies.length}</span>
            </div>
            <div className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs">
              <Activity className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[var(--text-muted)]">Пинг:</span>
              <span className="font-bold text-[#10B981]">{stats.best_ping > 0 ? `${stats.best_ping} ms` : '—'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Deck */}
        <div className="relative z-10 pt-4 mt-4 border-t border-[var(--border-main)] flex flex-col sm:flex-row items-center gap-2">
          <button
            onClick={handleConnectFastest}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#2481CC] to-[#2AABEE] hover:brightness-105 active:scale-[0.99] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(36,129,204,0.3)] transition-all cursor-pointer select-none"
          >
            <TelegramIcon className="w-4 h-4 fill-current" />
            <span>Подключить лучший прокси (1 клик)</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyAll}
              className="flex-1 sm:flex-none py-2 px-3.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs font-medium text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Копировать все</span>
            </button>

            <button
              onClick={() => {
                if (filteredProxies.length > 0) onOpenQr(filteredProxies[0].tg_link);
              }}
              title="QR-код для смартфона"
              className="p-2 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-main)] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            >
              <QrCode className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <a
              href="https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt"
              download
              title="Скачать список .txt"
              className="p-2 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-main)] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4 text-[var(--text-muted)]" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Bar */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] p-4 space-y-3 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Protocol Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-app)] p-1 rounded-xl border border-[var(--border-main)] text-xs font-medium select-none">
            {[
              { id: 'all', label: 'Все', icon: <Server className="w-3.5 h-3.5" />, count: proxies.length },
              { id: 'faketls', label: 'Fake-TLS', icon: <Lock className="w-3.5 h-3.5" />, count: proxies.filter((p) => p.secret?.toLowerCase().startsWith('ee')).length },
              { id: 'socks5', label: 'SOCKS5', icon: <ShieldCheck className="w-3.5 h-3.5" />, count: stats.total_socks5 || proxies.filter((p) => p.proto === 'socks5').length },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#2481CC] text-white font-semibold shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-mono ${isActive ? 'opacity-90' : 'opacity-60'}`}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Поиск по IP, городу, SNI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-main)] text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#2481CC] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Countries Flex-Wrap with Flags & Expand */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs font-mono">
          <span className="text-[var(--text-muted)] text-[11px] shrink-0 mr-1">Страна:</span>
          <button
            onClick={() => setSelectedCountry('all')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
              selectedCountry === 'all'
                ? 'bg-[#2481CC] text-white font-bold shadow-xs'
                : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
            }`}
          >
            Все страны
          </button>
          {(isExpandedCountries ? countryCounts : countryCounts.slice(0, 6)).map(([code, count]) => {
            const isSelected = selectedCountry === code;
            return (
              <button
                key={code}
                onClick={() => setSelectedCountry(code)}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#2481CC] text-white font-bold shadow-xs'
                    : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)]'
                }`}
              >
                <CountryFlag countryCode={code} className="w-4 h-3 rounded-xs" />
                <span>{getCountryName(code)}</span>
                <span className="opacity-70 text-[10px]">{count}</span>
              </button>
            );
          })}

          {/* If selected country is outside top 6 and list is collapsed, ensure it stays visible */}
          {!isExpandedCountries &&
            selectedCountry !== 'all' &&
            !countryCounts.slice(0, 6).some(([c]) => c === selectedCountry) && (
              <button
                key={selectedCountry}
                onClick={() => setSelectedCountry(selectedCountry)}
                className="px-2.5 py-1 rounded-lg bg-[#2481CC] text-white font-bold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <CountryFlag countryCode={selectedCountry} className="w-4 h-3 rounded-xs" />
                <span>{getCountryName(selectedCountry)}</span>
                <span className="opacity-70 text-[10px]">
                  {countryCounts.find(([c]) => c === selectedCountry)?.[1] || 0}
                </span>
              </button>
            )}

          {countryCounts.length > 6 && (
            <button
              onClick={() => setIsExpandedCountries(!isExpandedCountries)}
              type="button"
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[#2481CC] hover:text-[#1C72B8] border border-[var(--border-main)] hover:border-[#2481CC]/40 inline-flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              <span>{isExpandedCountries ? 'Свернуть' : `+ Еще ${countryCounts.length - 6}`}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isExpandedCountries ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Compact Proxy List / Data Rows */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] overflow-hidden shadow-xs transition-colors">
        <div className="p-3 px-4 bg-[var(--bg-app)] border-b border-[var(--border-main)] flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#2481CC]" />
            <span>Список прокси ({filteredProxies.length})</span>
          </span>
          <span>Проверка каждые 4 ч</span>
        </div>

        <div className="divide-y divide-[var(--border-main)]">
          {filteredProxies.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-[var(--text-muted)]">
              {isLoading ? 'Загрузка списка прокси...' : 'Нет доступных прокси под выбранные фильтры'}
            </div>
          ) : (
            displayedProxies.map((p, idx) => {
              const { domain, type: secretType } = extractTlsDomain(p.secret);
              const isFakeTls = p.proto === 'mtproto' && secretType === 'faketls';
              const pingColor =
                p.ping_ms < 100 ? 'text-[#10B981]' : p.ping_ms < 250 ? 'text-[#2AABEE]' : 'text-[#E08244]';
              const pingBg =
                p.ping_ms < 100 ? 'bg-[#10B981]/10' : p.ping_ms < 250 ? 'bg-[#2AABEE]/10' : 'bg-[#E08244]/10';
              const cardId = `${p.server}-${p.port}-${idx}`;
              const isCopied = copiedId === cardId;

              return (
                <div
                  key={cardId}
                  className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-[var(--bg-card-hover)]/50 transition-colors"
                >
                  {/* Left: Index + Flag + IP + Badges */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[11px] text-[var(--text-muted)] w-5 text-right shrink-0">
                      {idx + 1}
                    </span>

                    <CountryFlag countryCode={p.country || 'GLOBAL'} className="w-4.5 h-3.5 rounded-xs shrink-0 shadow-xs" />

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-bold text-[var(--text-main)] truncate">
                          {p.server}:{p.port}
                        </span>

                        {isFakeTls ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-mono font-medium border border-emerald-500/20">
                            <Lock className="w-2.5 h-2.5" />
                            Fake-TLS
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-500 text-[10px] font-mono font-medium border border-sky-500/20">
                            {p.proto.toUpperCase()}
                          </span>
                        )}

                        {isRussianWhiteSni(domain) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-mono font-medium border border-amber-500/25">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Anti-DPI
                          </span>
                        )}

                        {domain && (
                          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[var(--bg-app)] border border-[var(--border-main)] text-[10px] font-mono text-[var(--text-muted)]">
                            <span>{domain}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-2">
                        <span>{getCountryName(p.country)}</span>
                        <span className={`px-1.5 py-0.2 rounded ${pingBg} ${pingColor} font-semibold text-[10px]`}>
                          {Math.round(p.ping_ms)} ms
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={p.tg_link}
                      className="py-1.5 px-3 rounded-xl bg-[#2481CC] hover:bg-[#1C72B8] text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs select-none"
                    >
                      <TelegramIcon className="w-3.5 h-3.5" />
                      <span>Подключить</span>
                    </a>

                    <a
                      href={p.web_link || (p.proto === 'mtproto' ? `https://web.telegram.org/a/#?proxy=server=${p.server}&port=${p.port}&secret=${encodeURIComponent(p.secret || '')}` : `https://web.telegram.org/a/#?socks=server=${p.server}&port=${p.port}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Открыть в Telegram Web (web.telegram.org)"
                      className="hidden sm:inline-flex py-1.5 px-2.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] font-medium text-xs items-center gap-1.5 transition-colors cursor-pointer shadow-xs select-none"
                    >
                      <Globe className="w-3.5 h-3.5 text-[#2481CC]" />
                      <span>Web TG</span>
                    </a>

                    <button
                      onClick={() => handleCopySingle(p.tg_link, cardId)}
                      title="Скопировать ссылку"
                      className="p-1.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer shadow-xs"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => onOpenQr(p.tg_link)}
                      title="Показать QR-код"
                      className="hidden sm:inline-flex p-1.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer shadow-xs"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {!isLoading && hasMore && (
            <div className="p-3.5 text-center bg-[var(--bg-app)]/50 border-t border-[var(--border-main)]">
              <button
                onClick={() => setVisibleLimit((prev) => prev + 50)}
                type="button"
                className="px-5 py-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-xs font-mono font-semibold text-[#2481CC] border border-[var(--border-main)] hover:border-[#2481CC]/40 inline-flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <span>Показать еще (+{Math.min(50, filteredProxies.length - visibleLimit)})</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Clean Footer */}
      <footer className="w-full pt-8 pb-4 border-t border-[var(--border-main)] flex flex-col items-center justify-center text-center text-xs text-[var(--text-muted)] font-body space-y-1">
        <p className="m-0 font-display font-medium text-[var(--text-main)]">
          TGProxy · Прокси-хаб Telegram
        </p>
        <p className="m-0 font-mono text-[11px]">
          Fake-TLS & SOCKS5 • Автопроверка каждые 4 часа
        </p>
      </footer>
    </div>
  );
};

export default TGProxyView;
