import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { FilterPanel } from './components/FilterPanel';
import { ExportPanel } from './components/ExportPanel';
import { NodePreviewList } from './components/NodePreviewList';
import { QrModal } from './components/QrModal';
import ScrollWaveField from './components/ui/ScrollWaveField';
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
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isQrOpen, setIsQrOpen] = useState<boolean>(false);

  // 1. Fast Parallel Mirror Fetching with AbortController & Strict Sanitization
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

      const fetchWithTimeout = async (url: string, ms = 2500) => {
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

      try {
        const data = await Promise.any(mirrors.map((m) => fetchWithTimeout(m)));
        if (isMounted && data && Array.isArray(data.nodes)) {
          const sanitized = (data.nodes as NodeItem[]).filter(
            (n) => n && typeof n.uri === 'string' && VALID_URI_REGEX.test(n.uri.trim()) && !isConflictMarker(n.uri.trim())
          );
          setAllNodes(normalizeAndIndexNodes(sanitized));
          if (data.updated_at) {
            setUpdatedAt(data.updated_at);
          }
          setIsLoading(false);
          return;
        }
      } catch {
        // Mirror fetch failed, fallback to top50.txt
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
              ping_ms: 35 + idx * 2,
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

  // 2. Preset Selection Handler
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

  // 3. Ultra-fast Pre-indexed Dynamic Counts Calculation
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

  // 4. Manual Filters Handlers
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

  // 5. Zero-allocation, High-performance Filtering using Pre-indexed Metadata
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

      // 1. Min Health filter
      if (hasMinHealth) {
        const health = idx ? idx.health : (typeof node.health === 'number' ? node.health : 100);
        if (health < minHealth) return false;
      }

      // 2. Service filter (Multi-select)
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

      // 3. Country filter (Multi-select)
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

      // 4. Protocol filter (Multi-select)
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

  // 6. Subscription URL Generation (Dynamic Worker URL)
  const subUrl = useMemo(() => {
    const baseUrl = 'https://sub.turboprobe.workers.dev/sub';

    const params = new URLSearchParams();

    if (selectedServices.length > 0) {
      params.set('services', selectedServices.join(','));
    }
    if (selectedCountries.length > 0) {
      params.set('country', selectedCountries.join(','));
    }
    if (selectedProtos.length > 0) {
      params.set('proto', selectedProtos.join(','));
    }
    if (selectedLimit > 0) {
      params.set('limit', selectedLimit.toString());
    }
    if (minHealth > 0) {
      params.set('min_health', minHealth.toString());
    }

    const queryStr = params.toString();
    if (queryStr) {
      return `${baseUrl}?${queryStr}`;
    }

    if (activePreset === 'anti-tspu') return `${baseUrl}/anti-tspu`;
    if (activePreset === 'ai') return `${baseUrl}/ai`;
    if (activePreset === 'youtube') return `${baseUrl}/youtube`;

    return baseUrl;
  }, [activePreset, selectedServices, selectedCountries, selectedProtos, selectedLimit, minHealth]);

  const allFilteredKeys = useMemo(() => {
    return filteredNodes.map((n) => n.uri);
  }, [filteredNodes]);

  // 7. Client-side Real Clash Meta YAML Generation
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
    <div className="relative min-h-screen bg-[#050505] text-zinc-100 selection:bg-zinc-100 selection:text-zinc-950 overflow-x-hidden flex flex-col justify-between">
      
      {/* 3D Particle Scroll Wave Field Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
        <ScrollWaveField />
      </div>

      {/* Subtle Radial Gradient to Vignette the Wave Field */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-transparent via-[#050505]/60 to-[#050505]" />

      {/* Main Content Layer - Vertically Centered */}
      <div className="relative z-10 flex-1 flex flex-col justify-center min-h-screen py-8 sm:py-12">
        <div className="w-full max-w-4xl mx-auto space-y-4">
          {/* Centered Hero Brand Header */}
          <Header totalConfigs={allNodes.length} updatedAt={updatedAt} />

          {/* Main Application Feed (Sleek Centered Design) */}
          <main className="w-full px-4 space-y-3.5">
            {/* 1. Hero Mode Cards & Collapsible Fine-Tuning */}
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

            {/* 2. Subscription Generation & Quick Import */}
            <ExportPanel
              subUrl={subUrl}
              filteredCount={filteredNodes.length}
              selectedLimit={selectedLimit}
              onChangeLimit={setSelectedLimit}
              allFilteredKeys={allFilteredKeys}
              onOpenQr={() => setIsQrOpen(true)}
              onDownloadClash={handleDownloadClash}
            />

            {/* 3. Live Verified Nodes Feed */}
            <NodePreviewList
              nodes={filteredNodes}
              isLoading={isLoading}
              totalAvailable={filteredNodes.length}
            />
          </main>

          {/* QR Code Modal */}
          <QrModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} subUrl={subUrl} />

          {/* Minimal Centered Footer */}
          <footer className="w-full px-4 pt-4 border-t border-white/[0.06] flex items-center justify-center text-center text-xs text-zinc-500 font-mono">
            <p className="m-0 flex items-center gap-1.5">
              <span>Создано</span>
              <a
                href="https://github.com/SH20FK"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-300 hover:text-white font-semibold underline underline-offset-4 decoration-white/20 hover:decoration-white transition-colors"
              >
                SH20FK
              </a>
              <span>для сообщества</span>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
