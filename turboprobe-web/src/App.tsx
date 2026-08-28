import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { FilterPanel } from './components/FilterPanel';
import { ExportPanel } from './components/ExportPanel';
import { NodePreviewList } from './components/NodePreviewList';
import { QrModal } from './components/QrModal';
import { normalizeAndIndexNodes } from './utils/nodeIndexer';
import { generateClashMetaYaml } from './utils/clashExport';
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
    best_ping_ms: 181,
    avg_ping_ms: 480,
    updated_at: '',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isQrOpen, setIsQrOpen] = useState<boolean>(false);

  // Fast Parallel Mirror Fetching with AbortController
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);

      const cacheBust = Date.now();
      const mirrors = [
        `sub/preview.json?t=${cacheBust}`,
        `${JSDELIVR_BASE}/preview.json?t=${cacheBust}`,
        `${CDN_BASE}/preview.json?t=${cacheBust}`,
      ];

      const statsMirrors = [
        `sub/stats.json?t=${cacheBust}`,
        `${JSDELIVR_BASE}/stats.json?t=${cacheBust}`,
        `${CDN_BASE}/stats.json?t=${cacheBust}`,
      ];

      const fetchWithTimeout = async (url: string, ms = 3000) => {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), ms);
        try {
          const res = await fetch(url, { signal: ctrl.signal });
          clearTimeout(tid);
          if (!res.ok) throw new Error('Not ok');
          return await res.json();
        } catch (err) {
          clearTimeout(tid);
          throw err;
        }
      };

      // 1. Fetch real stats
      try {
        const statsData = await Promise.any(statsMirrors.map((m) => fetchWithTimeout(m)));
        if (isMounted && statsData) {
          setStats({
            total_nodes: statsData.total_nodes || 0,
            best_ping_ms: Math.round(statsData.best_ping_ms || 181),
            avg_ping_ms: Math.round(statsData.avg_ping_ms || 480),
            updated_at: statsData.updated_at || '',
          });
        }
      } catch {
        // ignore stats fetch error
      }

      // 2. Fetch verified preview nodes
      try {
        const data = await Promise.any(mirrors.map((m) => fetchWithTimeout(m)));
        if (isMounted && data && Array.isArray(data.nodes)) {
          const sanitized = (data.nodes as NodeItem[]).filter(
            (n) => n && typeof n.uri === 'string' && VALID_URI_REGEX.test(n.uri.trim()) && !isConflictMarker(n.uri.trim())
          );
          setAllNodes(normalizeAndIndexNodes(sanitized));
          if (data.updated_at && !stats.updated_at) {
            setStats((prev) => ({ ...prev, updated_at: data.updated_at }));
          }
          setIsLoading(false);
          return;
        }
      } catch {
        // fallback to top50.txt
      }

      try {
        const res = await fetch(`${JSDELIVR_BASE}/top50.txt`);
        if (res.ok) {
          const text = await res.text();
          const lines = text
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && VALID_URI_REGEX.test(l) && !isConflictMarker(l));

          if (isMounted) {
            const fallbackNodes: NodeItem[] = lines.map((uri, idx) => ({
              uri,
              ping_ms: 180 + idx * 5,
              country: 'NL',
              protocol: (uri.split('://')[0] || 'vless').toLowerCase(),
              health: 95,
              services: { chatgpt: true, youtube: true, discord: true },
            }));
            setAllNodes(normalizeAndIndexNodes(fallbackNodes));
          }
        }
      } catch {
        // fallback failed
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
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
    <div className="min-h-screen bg-[#0c0d10] text-zinc-100 selection:bg-zinc-800 selection:text-white flex flex-col justify-between">
      <div className="flex-1 flex flex-col justify-center min-h-screen py-8 sm:py-12">
        <div className="w-full max-w-3xl mx-auto space-y-4 px-3 sm:px-4">
          {/* Header */}
          <Header
            totalConfigs={stats.total_nodes || allNodes.length}
            bestPing={stats.best_ping_ms}
            avgPing={stats.avg_ping_ms}
            updatedAt={stats.updated_at}
          />

          {/* Main Controls */}
          <main className="w-full space-y-3.5">
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
          <footer className="w-full pt-6 pb-2 border-t border-zinc-800/80 flex items-center justify-center text-center text-xs text-zinc-500 font-mono">
            <p className="m-0 flex items-center gap-1.5">
              <span>TurboProbe · Открытый исходный код</span>
              <span>·</span>
              <a
                href="https://github.com/SH20FK/TurboProbe"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white underline underline-offset-4 decoration-zinc-700 hover:decoration-white transition-colors"
              >
                GitHub
              </a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

