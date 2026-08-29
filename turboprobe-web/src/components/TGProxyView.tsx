import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  Search,
  Copy,
  QrCode,
  Download,
  Check,
  ExternalLink,
  Lock,
  X,
} from 'lucide-react';
import { useToast } from './ui/M3Toast';
import { CountryFlag } from './CountryFlags';
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
        const res = await Promise.any(urls.map((u) => fetchWithTimeout(u)));

        if (isMounted && res && Array.isArray(res.proxies) && res.proxies.length > 0) {
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

  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    proxies.forEach((p) => {
      const c = p.country || 'GLOBAL';
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [proxies]);

  const handleConnectFastest = useCallback(() => {
    if (filteredProxies.length === 0) {
      toast.error('Нет доступных прокси');
      return;
    }
    const fastest = filteredProxies[0];
    toast.success('Подключение в Telegram...', `${fastest.server}:${fastest.port}`);
    window.location.href = fastest.tg_link;
  }, [filteredProxies, toast]);

  const handleCopySingle = useCallback(
    (link: string, id: string) => {
      toast.copy(link, 'Ссылка скопирована');
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
    <div className="w-full max-w-4xl mx-auto space-y-4 font-body">
      {/* 1. Header Card */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] p-5 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-11 h-11 rounded-xl bg-[#2481CC] p-2.5 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Send className="w-full h-full fill-current" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[var(--text-main)] m-0">
                TGProxy
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 font-normal">
                Проверенные прокси MTProto (Fake-TLS) и SOCKS5 для Telegram
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
            <div className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <span className="text-[var(--text-muted)]">Узлов:</span>
              <span className="font-bold text-[var(--text-main)]">{proxies.length}</span>
            </div>
            <div className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <span className="text-[var(--text-muted)]">Пинг:</span>
              <span className="font-bold text-[#10B981]">{stats.best_ping > 0 ? `${stats.best_ping} ms` : '—'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="pt-4 mt-4 border-t border-[var(--border-main)] flex flex-col sm:flex-row items-center gap-2">
          <button
            onClick={handleConnectFastest}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-[#2481CC] hover:bg-[#1C72B8] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4 fill-current" />
            <span>Подключить лучший прокси (1 клик)</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyAll}
              className="flex-1 sm:flex-none py-2 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-xs text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Копировать все</span>
            </button>

            <button
              onClick={() => {
                if (filteredProxies.length > 0) onOpenQr(filteredProxies[0].tg_link);
              }}
              title="QR-код для смартфона"
              className="p-2 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-main)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <a
              href="https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt"
              download
              title="Скачать .txt"
              className="p-2 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-main)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[var(--text-muted)]" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] p-4 space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Protocol Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-app)] p-1 rounded-xl border border-[var(--border-main)] text-xs font-medium select-none">
            {[
              { id: 'all', label: 'Все прокси', count: proxies.length },
              { id: 'faketls', label: 'Fake-TLS', count: proxies.filter((p) => p.secret?.toLowerCase().startsWith('ee')).length },
              { id: 'socks5', label: 'SOCKS5', count: stats.total_socks5 || proxies.filter((p) => p.proto === 'socks5').length },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#2481CC] text-white font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
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
              placeholder="Поиск по IP или SNI..."
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

        {/* Countries Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 scrollbar-none text-xs font-mono">
          <span className="text-[var(--text-muted)] text-[11px] shrink-0 mr-1">Страна:</span>
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

      {/* 3. Compact Proxy List / Data Rows */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] overflow-hidden shadow-xs transition-colors">
        <div className="p-3 px-4 bg-[var(--bg-app)] border-b border-[var(--border-main)] flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
          <span>Список прокси ({filteredProxies.length})</span>
          <span>Автопроверка каждые 2 часа</span>
        </div>

        <div className="divide-y divide-[var(--border-main)]">
          {filteredProxies.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-[var(--text-muted)]">
              {isLoading ? 'Загрузка списка прокси...' : 'Нет доступных прокси под выбранные фильтры'}
            </div>
          ) : (
            filteredProxies.map((p, idx) => {
              const { domain, type: secretType } = extractTlsDomain(p.secret);
              const isFakeTls = p.proto === 'mtproto' && secretType === 'faketls';
              const pingColor =
                p.ping_ms < 100 ? 'text-[#10B981]' : p.ping_ms < 250 ? 'text-[#2AABEE]' : 'text-[#E08244]';
              const cardId = `${p.server}-${p.port}-${idx}`;
              const isCopied = copiedId === cardId;

              return (
                <div
                  key={cardId}
                  className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-[var(--bg-card-hover)]/50 transition-colors"
                >
                  {/* Left: Index + Flag + IP + Badges */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-[11px] text-[var(--text-muted)] w-5 text-right shrink-0">
                      {idx + 1}
                    </span>

                    <CountryFlag countryCode={p.country || 'GLOBAL'} className="w-4 h-3 rounded-xs shrink-0" />

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-semibold text-[var(--text-main)] truncate">
                          {p.server}:{p.port}
                        </span>

                        {isFakeTls ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-mono font-medium">
                            Fake-TLS
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-500 text-[10px] font-mono font-medium">
                            {p.proto.toUpperCase()}
                          </span>
                        )}

                        {domain && (
                          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[var(--bg-app)] border border-[var(--border-main)] text-[10px] font-mono text-[var(--text-muted)]">
                            <Lock className="w-2.5 h-2.5 text-[#2481CC]" />
                            <span>{domain}</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-2">
                        <span>{p.country_label || p.country || 'Сервер'}</span>
                        <span className={`${pingColor} font-semibold`}>{Math.round(p.ping_ms)} ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={p.tg_link}
                      className="py-1.5 px-3 rounded-lg bg-[#2481CC] hover:bg-[#1C72B8] text-white font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Подключить</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      onClick={() => handleCopySingle(p.tg_link, cardId)}
                      title="Скопировать ссылку"
                      className="p-1.5 rounded-lg bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
