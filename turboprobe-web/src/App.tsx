import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { FilterPanel } from './components/FilterPanel';
import { ExportPanel } from './components/ExportPanel';
import { NodePreviewList } from './components/NodePreviewList';
import { QrModal } from './components/QrModal';
import ScrollWaveField from './components/ui/ScrollWaveField';
import type { NodeItem, PresetItem } from './types';

const CDN_BASE = 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub';
const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/sub';

export default function App() {
  const [activePreset, setActivePreset] = useState<string>('all');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedProtos, setSelectedProtos] = useState<string[]>([]);
  const [maxPing, setMaxPing] = useState<number>(0);
  const [minHealth, setMinHealth] = useState<number>(0);

  const [allNodes, setAllNodes] = useState<NodeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isQrOpen, setIsQrOpen] = useState<boolean>(false);

  // 1. Fast Parallel Mirror Fetching with AbortController
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);

      const mirrors = [
        'sub/preview.json',
        `${JSDELIVR_BASE}/preview.json`,
        `${CDN_BASE}/preview.json`,
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
          setAllNodes(data.nodes);
          setIsLoading(false);
        }
      } catch (_) {
        try {
          const res = await fetch(`${JSDELIVR_BASE}/top50.txt`);
          if (res.ok) {
            const text = await res.text();
            const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
            if (isMounted) {
              setAllNodes(
                lines.map((uri, idx) => ({
                  uri,
                  ping_ms: 35 + idx * 2,
                  country: 'NL',
                  protocol: uri.split('://')[0] || 'vless',
                  health: 95,
                  services: { chatgpt: true, youtube: true, discord: true },
                }))
              );
            }
          }
        } catch (_) {}
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
      setMaxPing(0);
    } else {
      if (preset.services.length > 0) setSelectedServices(preset.services);
      if (preset.country && preset.country !== 'all') setSelectedCountries([preset.country.toLowerCase()]);
      if (preset.proto && preset.proto !== 'all') setSelectedProtos([preset.proto.toLowerCase()]);
      if (preset.maxPing > 0) setMaxPing(preset.maxPing);
    }
  }, []);

  // 3. Dynamic Counts Calculation
  const countryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    allNodes.forEach((n) => {
      const c = (n.country || '').toLowerCase();
      if (c && c !== 'global') {
        map[c] = (map[c] || 0) + 1;
      }
    });
    return map;
  }, [allNodes]);

  const protoCounts = useMemo(() => {
    const map: Record<string, number> = {};
    allNodes.forEach((n) => {
      const p = (n.protocol || '').toLowerCase();
      const uri = n.uri.toLowerCase();
      if (uri.includes('pbk=') || p.includes('reality')) map['reality'] = (map['reality'] || 0) + 1;
      else if (p.includes('hy2') || p.includes('hysteria2') || uri.startsWith('hy2://')) map['hy2'] = (map['hy2'] || 0) + 1;
      else if (p.includes('trojan') || uri.startsWith('trojan://')) map['trojan'] = (map['trojan'] || 0) + 1;
      else if (p.includes('ss') || uri.startsWith('ss://')) map['ss'] = (map['ss'] || 0) + 1;
      else if (p.includes('vless') || uri.startsWith('vless://')) map['vless'] = (map['vless'] || 0) + 1;
    });
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

  const handleChangeMaxPing = useCallback((val: number) => {
    setActivePreset('custom');
    setMaxPing(val);
  }, []);

  const handleChangeMinHealth = useCallback((val: number) => {
    setActivePreset('custom');
    setMinHealth(val);
  }, []);

  // 5. Reactive Client-Side Filtering
  const filteredNodes = useMemo(() => {
    return allNodes.filter((node) => {
      // Service filter (Multi-select)
      if (selectedServices.length > 0) {
        const matchesServices = selectedServices.some(
          (s) => node.services && Boolean(node.services[s])
        );
        if (!matchesServices) return false;
      }

      // Country filter (Multi-select)
      if (selectedCountries.length > 0) {
        const nCountry = (node.country || '').toLowerCase().trim();
        const matchCountry = selectedCountries.some((c) => {
          const target = c.toLowerCase().trim();
          if (nCountry === target) return true;
          if (node.uri.includes('#')) {
            const tag = node.uri.split('#')[1].toLowerCase();
            return tag.includes(`[${target}]`) || tag.includes(`(${target})`) || tag.includes(`-${target}-`) || tag.includes(` ${target} `);
          }
          return false;
        });
        if (!matchCountry) return false;
      }

      // Protocol filter (Multi-select)
      if (selectedProtos.length > 0) {
        const nProto = (node.protocol || '').toLowerCase();
        const nUri = node.uri.toLowerCase();
        const matchProto = selectedProtos.some((p) => {
          if (p === 'reality') return nUri.includes('pbk=') || nProto.includes('reality');
          if (p === 'hy2') return nProto.includes('hy2') || nProto.includes('hysteria2') || nUri.startsWith('hy2://');
          if (p === 'trojan') return nProto.includes('trojan') || nUri.startsWith('trojan://');
          if (p === 'ss') return nProto.includes('ss') || nUri.startsWith('ss://');
          if (p === 'vless') return nProto.includes('vless') || nUri.startsWith('vless://');
          return nProto.includes(p) || nUri.startsWith(p);
        });
        if (!matchProto) return false;
      }

      // Max Ping filter
      if (maxPing > 0 && (node.ping_ms || 999) > maxPing) {
        return false;
      }

      // Min Health filter
      if (minHealth > 0 && (node.health ?? 100) < minHealth) {
        return false;
      }

      return true;
    });
  }, [allNodes, selectedServices, selectedCountries, selectedProtos, maxPing, minHealth]);

  // 6. Subscription URL Generation (Dynamic Worker URL)
  const subUrl = useMemo(() => {
    const baseUrl = 'https://sub.turboprobe.workers.dev/sub';

    // 1. If custom dynamic filtering is active
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
    if (maxPing > 0) {
      params.set('max_ping', maxPing.toString());
    }
    if (minHealth > 0) {
      params.set('min_health', minHealth.toString());
    }

    const queryStr = params.toString();
    if (queryStr) {
      return `${baseUrl}?${queryStr}`;
    }

    // 2. Preset REST endpoints
    if (activePreset === 'anti-tspu') return `${baseUrl}/anti-tspu`;
    if (activePreset === 'ai') return `${baseUrl}/ai`;
    if (activePreset === 'youtube') return `${baseUrl}/youtube`;

    // 3. Default top live subscription
    return baseUrl;
  }, [activePreset, selectedServices, selectedCountries, selectedProtos, maxPing, minHealth]);

  const allFilteredKeys = useMemo(() => {
    return filteredNodes.map((n) => n.uri);
  }, [filteredNodes]);

  const handleDownloadClash = useCallback(() => {
    const proxyNames: string[] = [];
    const proxies = filteredNodes.slice(0, 100).map((n, i) => {
      let cleanName = `TurboProbe-${String(i + 1).padStart(3, '0')}`;
      if (n.uri.includes('#')) {
        try {
          cleanName = decodeURIComponent(n.uri.split('#')[1]).trim();
        } catch (_) {}
      }
      proxyNames.push(cleanName);
      return `  - {name: "${cleanName}", type: ${n.protocol || 'vless'}, server: ...}`;
    });

    const yaml = `# TurboProbe Clash Configuration\nproxies:\n${proxies.join('\n')}\n`;
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'turboprobe-clash.yaml';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredNodes]);

  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100 selection:bg-zinc-100 selection:text-zinc-950 overflow-x-hidden">
      
      {/* 3D Particle Scroll Wave Field Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-50">
        <ScrollWaveField />
      </div>

      {/* Subtle Radial Gradient to Vignette the Wave Field */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-transparent via-[#050505]/50 to-[#050505]" />

      {/* Main Content Layer */}
      <div className="relative z-10">
        {/* Minimal Header */}
        <Header />

        <main className="pb-16 space-y-2">
          {/* Unified Filter Panel with Integrated Presets */}
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
            maxPing={maxPing}
            onChangeMaxPing={handleChangeMaxPing}
            minHealth={minHealth}
            onChangeMinHealth={handleChangeMinHealth}
          />

          {/* Export Panel with Full Width Copy & App Integrations */}
          <ExportPanel
            subUrl={subUrl}
            filteredCount={filteredNodes.length}
            allFilteredKeys={allFilteredKeys}
            onOpenQr={() => setIsQrOpen(true)}
            onDownloadClash={handleDownloadClash}
          />

          {/* Live Node Preview List with ThinkingOrbs & Reveal Animation */}
          <NodePreviewList
            nodes={filteredNodes.slice(0, 50)}
            isLoading={isLoading}
            totalAvailable={filteredNodes.length}
          />
        </main>

        {/* QR Code Modal with Scale Animation */}
        <QrModal isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} subUrl={subUrl} />

        {/* Minimal Footer */}
        <footer className="w-full max-w-5xl mx-auto py-8 px-4 border-t border-white/[0.06] text-center text-xs text-zinc-500 font-mono">
          <p className="m-0">
            TurboProbe · Суверенный и автономный VPN-агрегатор
          </p>
          <p className="mt-1 m-0 text-zinc-600">
            Обновляется автоматически каждые 6 часов через GitHub Actions
          </p>
        </footer>
      </div>
    </div>
  );
}
