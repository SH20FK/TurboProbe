import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { FilterPanel } from './components/FilterPanel';
import { ExportPanel } from './components/ExportPanel';
import { NodePreviewList } from './components/NodePreviewList';
import { QrModal } from './components/QrModal';
import { normalizeAndIndexNodes } from './utils/nodeIndexer';
import { generateClashMetaYaml } from './utils/clashExport';
import { M3Background } from './components/ui/M3Background';
import { ToastProvider } from './components/ui/M3Toast';
import { AnimatedThemeToggle } from './components/ui/ThemeToggle';
import { GitHubIcon } from './components/ServiceIcons';
import type { NodeItem, PresetItem } from './types';

const CDN_BASE = 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub';
const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/sub';

const VALID_URI_REGEX = /^[a-z0-9+-.]+:\/\/[^\s]+/i;

function isConflictMarker(line: string): boolean {
  return line.startsWith('<<<<<<<') || line.startsWith('=======') || line.startsWith('>>>>>>>');
}

export default function App() {
  const [activePreset, setActivePreset] = useState<string>('all');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedProtos, setSelectedProtos] = useState<string[]>([]);
  const [selectedLimit, setSelectedLimit] = useState<number>(50);
  const [minHealth, setMinHealth] = useState<number>(0);

  const [allNodes, setAllNodes] = useState<NodeItem[]>([]);
  const [stats, setStats] = useState<{ total_nodes: number; best_ping_ms: number; avg_ping_ms: number; updated_at: string }>({
    total_nodes: 0,
    best_ping_ms: 0,
    avg_ping_ms: 0,
    updated_at: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isQrOpen, setIsQrOpen] = useState<boolean>(false);

  // Fast Parallel Mirror Fetching with AbortController and Auto-revalidation
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const cacheBust = Date.now();
      const previewMirrors = [
        `sub/preview.json?t=${cacheBust}`,
        `./sub/preview.json?t=${cacheBust}`,
        `${JSDELIVR_BASE}/preview.json?t=${cacheBust}`,
        `${CDN_BASE}/preview.json?t=${cacheBust}`,
      ];

      const statsMirrors = [
        `sub/stats.json?t=${cacheBust}`,
        `./sub/stats.json?t=${cacheBust}`,
        `${JSDELIVR_BASE}/stats.json?t=${cacheBust}`,
        `${CDN_BASE}/stats.json?t=${cacheBust}`,
      ];

      const fetchWithTimeout = async (url: string, ms = 4000) => {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), ms);
        try {
          const res = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' });
          clearTimeout(tid);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } catch (err) {
          clearTimeout(tid);
          throw err;
        }
      };

      // 1. Fetch real dynamic stats
      try {
        const statsData = await Promise.any(statsMirrors.map((m) => fetchWithTimeout(m)));
        if (isMounted && statsData) {
          setStats({
            total_nodes: statsData.total_nodes || statsData.alive_verified_nodes || 0,
            best_ping_ms: statsData.best_ping_ms > 0 ? Math.round(statsData.best_ping_ms) : 0,
            avg_ping_ms: statsData.avg_ping_ms > 0 ? Math.round(statsData.avg_ping_ms) : 0,
            updated_at: statsData.updated_at || '',
          });
        }
      } catch {
        // ignore stats error
      }

      // 2. Fetch verified preview nodes
      try {
        const data = await Promise.any(previewMirrors.map((m) => fetchWithTimeout(m)));
        if (isMounted && data && Array.isArray(data.nodes) && data.nodes.length > 0) {
          const sanitized = (data.nodes as NodeItem[]).filter(
            (n) => n && typeof n.uri === 'string' && VALID_URI_REGEX.test(n.uri.trim()) && !isConflictMarker(n.uri.trim())
          );
          setAllNodes(normalizeAndIndexNodes(sanitized));
          if (data.updated_at) {
            setStats((prev) => ({
              ...prev,
              total_nodes: prev.total_nodes || sanitized.length,
              updated_at: prev.updated_at || data.updated_at,
            }));
          }
          setIsLoading(false);
          return;
        }
      } catch {
        // fallback to raw node list
      }

      // 3. Fallback: Parse raw verified pool without fabricated data
      try {
        const rawMirrors = [
          `sub/all.txt?t=${cacheBust}`,
          `./sub/all.txt?t=${cacheBust}`,
          `${JSDELIVR_BASE}/all.txt?t=${cacheBust}`,
          `${CDN_BASE}/all.txt?t=${cacheBust}`,
        ];
        const res = await Promise.any(rawMirrors.map(async (m) => {
          const r = await fetch(m, { cache: 'no-cache' });
          if (!r.ok) throw new Error('Not ok');
          return await r.text();
        }));

        if (res && isMounted) {
          const lines = res
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && VALID_URI_REGEX.test(l) && !isConflictMarker(l));

          if (lines.length > 0) {
            const parsedNodes: NodeItem[] = lines.map((uri) => {
              const proto = (uri.split('://')[0] || 'vless').toLowerCase();
              return {
                uri,
                protocol: proto,
                health: 100,
                country: 'GLOBAL',
                services: {},
              };
            });
            setAllNodes(normalizeAndIndexNodes(parsedNodes));
            setStats((prev) => ({
              ...prev,
              total_nodes: prev.total_nodes || parsedNodes.length,
            }));
          }
        }
      } catch {
        // raw pool error
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    // Background auto-refresh every 2 minutes
    const interval = setInterval(loadData, 120000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Preset Selection Handler
  const handleSelectPreset = useCallback((preset: PresetItem) => {
    setActivePreset(preset.id);
    if (preset.id === 'all') {
      setSelectedServices([]);
      setSelectedCountries([]);
      setSelectedProtos([]);
    } else {
      setSelectedServices(preset.services || []);
      setSelectedCountries(preset.country && preset.country !== 'all' ? [preset.country.toLowerCase()] : []);
      setSelectedProtos(preset.proto && preset.proto !== 'all' ? [preset.proto.toLowerCase()] : []);
    }
  }, []);

  // Dynamic Counts Calculation
  const countryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < allNodes.length; i++) {
      const n = allNodes[i];
      const c = n._index?.normalizedCountry || (n.country || '').toLowerCase().trim();
      if (c && c !== 'global' && c !== 'all') {
        map[c] = (map[c] || 0) + 1;
      }
    }
    return map;
  }, [allNodes]);

  const protoCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < allNodes.length; i++) {
      const idx = allNodes[i]._index;
      if (!idx) continue;
      if (idx.isReality) map['reality'] = (map['reality'] || 0) + 1;
      else if (idx.isHy2) map['hy2'] = (map['hy2'] || 0) + 1;
      else if (idx.isTrojan) map['trojan'] = (map['trojan'] || 0) + 1;
      else if (idx.isSs) map['ss'] = (map['ss'] || 0) + 1;
      else if (idx.isVless) map['vless'] = (map['vless'] || 0) + 1;
    }
    return map;
  }, [allNodes]);

  // Filter Handlers
  const handleToggleService = useCallback((serviceId: string) => {
    setActivePreset('custom');
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  }, []);

  const handleToggleCountry = useCallback((countryCode: string) => {
    setActivePreset('custom');
    setSelectedCountries((prev) =>
      prev.includes(countryCode) ? prev.filter((c) => c !== countryCode) : [...prev, countryCode]
    );
  }, []);

  const handleClearCountries = useCallback(() => {
    setActivePreset('custom');
    setSelectedCountries([]);
  }, []);

  const handleToggleProto = useCallback((proto: string) => {
    setActivePreset('custom');
    setSelectedProtos((prev) =>
      prev.includes(proto) ? prev.filter((p) => p !== proto) : [...prev, proto]
    );
  }, []);

  const handleClearProtos = useCallback(() => {
    setActivePreset('custom');
    setSelectedProtos([]);
  }, []);

  const handleChangeMinHealth = useCallback((val: number) => {
    setActivePreset('custom');
    setMinHealth(val);
  }, []);

  // Filtering Logic
  const filteredNodes = useMemo(() => {
    const hasServices = selectedServices.length > 0;
    const hasCountries = selectedCountries.length > 0;
    const hasProtos = selectedProtos.length > 0;
    const hasMinHealth = minHealth > 0;

    if (!hasServices && !hasCountries && !hasProtos && !hasMinHealth) {
      return allNodes;
    }

    const normCountries = hasCountries ? selectedCountries.map((c) => c.toLowerCase().trim()) : [];
    const normProtos = hasProtos ? selectedProtos.map((p) => p.toLowerCase().trim()) : [];

    return allNodes.filter((node) => {
      const idx = node._index;

      if (hasMinHealth) {
        const health = idx ? idx.health : (typeof node.health === 'number' ? node.health : 100);
        if (health < minHealth) return false;
      }

      if (hasServices) {
        if (idx) {
          const matchService = selectedServices.some((s) => idx.serviceSet.has(s.toLowerCase()));
          if (!matchService) return false;
        } else if (node.services) {
          const matchService = selectedServices.some((s) => Boolean(node.services![s]));
          if (!matchService) return false;
        } else {
          return false;
        }
      }

      if (hasCountries) {
        if (idx) {
          const matchCountry = normCountries.some(
            (c) => idx.normalizedCountry === c || idx.countryTokens.includes(c)
          );
          if (!matchCountry) return false;
        } else {
          const c = (node.country || '').toLowerCase().trim();
          const matchCountry = normCountries.some((target) => c === target);
          if (!matchCountry) return false;
        }
      }

      if (hasProtos) {
        if (idx) {
          const matchProto = normProtos.some((p) => {
            if (p === 'reality') return idx.isReality;
            if (p === 'hy2') return idx.isHy2;
            if (p === 'trojan') return idx.isTrojan;
            if (p === 'ss') return idx.isSs;
            if (p === 'vless') return idx.isVless;
            return idx.normalizedProto.includes(p);
          });
          if (!matchProto) return false;
        } else {
          const p = (node.protocol || '').toLowerCase();
          const matchProto = normProtos.some((proto) => p.includes(proto));
          if (!matchProto) return false;
        }
      }

      return true;
    });
  }, [allNodes, selectedServices, selectedCountries, selectedProtos, minHealth]);

  // Subscription URL Generation
  const subUrl = useMemo(() => {
    const baseUrl = 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/all.txt';

    if (activePreset === 'anti-tspu') {
      return 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/reality.txt';
    }
    if (activePreset === 'ai') {
      return 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/services/ai-bundle.txt';
    }
    if (activePreset === 'youtube') {
      return 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/services/youtube.txt';
    }

    if (selectedLimit === 20) {
      return 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/top20.txt';
    }
    if (selectedLimit === 50) {
      return 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/top50.txt';
    }

    return baseUrl;
  }, [activePreset, selectedLimit]);

  const allFilteredKeys = useMemo(() => {
    return filteredNodes.map((n) => n.uri);
  }, [filteredNodes]);

  const handleDownloadClash = useCallback(() => {
    const yaml = generateClashMetaYaml(filteredNodes);
    const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'turboprobe-clash-meta.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredNodes]);

  return (
    <ToastProvider>
      <div className="relative min-h-screen bg-[#141218] text-[#E6E0E9] selection:bg-[#D0BCFF] selection:text-[#381E72] flex flex-col justify-between overflow-x-hidden">
        {/* M3 Expressive Background with Floating Shapes & Dot Matrix */}
        <M3Background />

        {/* 1. Top App Bar */}
        <header className="sticky top-0 z-30 w-full h-16 bg-[#141218]/90 backdrop-blur-md border-b border-[#49454F]/20 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white p-1 shadow-md flex items-center justify-center">
              <img src="./logo.svg" alt="TurboProbe" className="w-full h-full object-contain" />
            </div>
            <span className="font-display font-black text-base sm:text-lg text-white tracking-tight">
              TurboProbe
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2B2930] text-xs font-mono text-[#CAC4D0] border border-[#49454F]/20">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>
                {(stats.total_nodes || allNodes.length) > 0 ? (
                  `${(stats.total_nodes || allNodes.length).toLocaleString('ru-RU')} проверенных узлов`
                ) : (
                  'Синхронизация...'
                )}
              </span>
            </div>

            <AnimatedThemeToggle />

            <a
              href="https://github.com/SH20FK/TurboProbe"
              target="_blank"
              rel="noreferrer"
              className="relative px-3.5 py-1.5 rounded-full bg-[#2B2930] hover:bg-[#36343B] text-[#E6E0E9] hover:text-white text-xs font-semibold font-mono flex items-center gap-1.5 transition-all border border-[#49454F]/30 hover:border-[#D0BCFF]/50 shadow-xs active:scale-95 overflow-hidden select-none cursor-pointer"
            >
              <GitHubIcon className="w-4 h-4 text-white flex-shrink-0" />
              <span>GitHub</span>
            </a>
          </div>
        </header>

        {/* 2. Main Page Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-6 sm:py-10">
          <div className="w-full max-w-3xl mx-auto space-y-4 px-3 sm:px-4">
            {/* Hero Header */}
            <Header
              totalConfigs={stats.total_nodes || allNodes.length}
              bestPing={stats.best_ping_ms}
              avgPing={stats.avg_ping_ms}
              updatedAt={stats.updated_at}
            />

            {/* Main Controls */}
            <main className="w-full space-y-4">
              <FilterPanel
                activePreset={activePreset}
                onSelectPreset={handleSelectPreset}
                selectedServices={selectedServices}
                onToggleService={handleToggleService}
                selectedCountries={selectedCountries}
                onToggleCountry={handleToggleCountry}
                onClearCountries={handleClearCountries}
                selectedProtos={selectedProtos}
                onToggleProto={handleToggleProto}
                onClearProtos={handleClearProtos}
                countryCounts={countryCounts}
                protoCounts={protoCounts}
                minHealth={minHealth}
                onChangeMinHealth={handleChangeMinHealth}
              />

              <ExportPanel
                subUrl={subUrl}
                filteredCount={filteredNodes.length}
                selectedLimit={selectedLimit}
                onChangeLimit={setSelectedLimit}
                allFilteredKeys={allFilteredKeys}
                onOpenQr={() => setIsQrOpen(true)}
                onDownloadClash={handleDownloadClash}
              />

              <NodePreviewList
                nodes={filteredNodes}
                isLoading={isLoading}
                totalAvailable={filteredNodes.length}
              />
            </main>

            {/* QR Modal */}
            <QrModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} subUrl={subUrl} />

            {/* Clean Footer */}
            <footer className="w-full pt-8 pb-4 border-t border-[#49454F]/20 flex flex-col items-center justify-center text-center text-xs text-[#938F99] font-body space-y-1">
              <p className="m-0 font-display font-medium text-[#CAC4D0]">
                TurboProbe · Суверенный VPN-агрегатор
              </p>
              <p className="m-0 font-mono text-[11px]">
                Material Design 3 • Обновление каждые 6 часов
              </p>
            </footer>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
