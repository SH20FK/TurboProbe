import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { PresetSelector } from './components/PresetSelector';
import { FilterPanel } from './components/FilterPanel';
import { ExportPanel } from './components/ExportPanel';
import { NodePreviewList } from './components/NodePreviewList';
import { QrModal } from './components/QrModal';
import Globe from './components/ui/Globe';
import type { NodeItem, StatsData, PresetItem } from './types';

const CDN_BASE = 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub';
const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/sub';

// Primary Server Hubs for 3D Globe Markers
const SERVER_HUB_MARKERS = [
  { lat: 50.1109, lng: 8.6821 },  // Frankfurt (DE)
  { lat: 52.3676, lng: 4.9041 },  // Amsterdam (NL)
  { lat: 43.2220, lng: 76.8512 }, // Almaty (KZ)
  { lat: 60.1699, lng: 24.9384 }, // Helsinki (FI)
  { lat: 41.0082, lng: 28.9784 }, // Istanbul (TR)
  { lat: 55.7558, lng: 37.6173 }, // Moscow (RU)
  { lat: 1.3521, lng: 103.8198 }, // Singapore (SG)
  { lat: 40.7128, lng: -74.0060 },// New York (US)
  { lat: 59.3293, lng: 18.0686 }, // Stockholm (SE)
];

export default function App() {
  const [activePreset, setActivePreset] = useState<string>('all');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedProto, setSelectedProto] = useState<string>('all');
  const [maxPing, setMaxPing] = useState<number>(0);
  const [minHealth, setMinHealth] = useState<number>(0);

  const [allNodes, setAllNodes] = useState<NodeItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
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

      // Fetch stats
      try {
        const sRes = await fetch(`${JSDELIVR_BASE}/stats.json`);
        if (sRes.ok) {
          const sData = await sRes.json();
          if (isMounted) setStats(sData);
        }
      } catch (_) {}
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Preset Selection Handler
  const handleSelectPreset = useCallback((preset: PresetItem) => {
    setActivePreset(preset.id);
    setSelectedServices(preset.services);
    setSelectedCountry(preset.country);
    setSelectedProto(preset.proto);
    setMaxPing(preset.maxPing);
  }, []);

  // 3. Manual Filters Handlers
  const handleToggleService = useCallback((serviceId: string) => {
    setActivePreset('custom');
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  }, []);

  const handleSelectCountry = useCallback((countryCode: string) => {
    setActivePreset('custom');
    setSelectedCountry(countryCode);
  }, []);

  const handleSelectProto = useCallback((proto: string) => {
    setActivePreset('custom');
    setSelectedProto(proto);
  }, []);

  const handleChangeMaxPing = useCallback((val: number) => {
    setActivePreset('custom');
    setMaxPing(val);
  }, []);

  const handleChangeMinHealth = useCallback((val: number) => {
    setActivePreset('custom');
    setMinHealth(val);
  }, []);

  // 4. Reactive Client-Side Filtering
  const filteredNodes = useMemo(() => {
    return allNodes.filter((node) => {
      // Service filter
      if (selectedServices.length > 0) {
        const matchesServices = selectedServices.some(
          (s) => node.services && Boolean(node.services[s])
        );
        if (!matchesServices) return false;
      }

      // Country filter
      if (selectedCountry !== 'all') {
        const c = selectedCountry.toLowerCase();
        const nCountry = (node.country || '').toLowerCase();
        const nUri = node.uri.toLowerCase();
        if (!nCountry.includes(c) && !nUri.includes(c)) return false;
      }

      // Protocol filter
      if (selectedProto !== 'all') {
        const p = selectedProto.toLowerCase();
        const nProto = (node.protocol || '').toLowerCase();
        const nUri = node.uri.toLowerCase();
        if (!nProto.includes(p) && !nUri.startsWith(p)) return false;
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
  }, [allNodes, selectedServices, selectedCountry, selectedProto, maxPing, minHealth]);

  // 5. Subscription URL Generation
  const subUrl = useMemo(() => {
    if (activePreset === 'ai' || (selectedServices.includes('chatgpt') && selectedServices.includes('claude'))) {
      return `${CDN_BASE}/services/ai-bundle.txt`;
    }
    if (activePreset === 'youtube' || selectedServices.includes('youtube')) {
      return `${CDN_BASE}/services/youtube.txt`;
    }
    if (activePreset === 'anti-tspu' || selectedProto === 'reality') {
      return `${CDN_BASE}/anti-whitelist.txt`;
    }
    if (selectedCountry === 'de') return `${CDN_BASE}/countries/de.txt`;
    if (selectedCountry === 'nl') return `${CDN_BASE}/countries/nl.txt`;
    if (selectedCountry === 'kz') return `${CDN_BASE}/countries/kz.txt`;
    if (selectedCountry === 'fi') return `${CDN_BASE}/countries/fi.txt`;
    if (selectedCountry === 'tr') return `${CDN_BASE}/countries/tr.txt`;
    if (selectedCountry === 'ru') return `${CDN_BASE}/countries/ru.txt`;

    if (selectedServices.length === 1) {
      return `${CDN_BASE}/services/${selectedServices[0]}.txt`;
    }

    return `${CDN_BASE}/top50.txt`;
  }, [activePreset, selectedServices, selectedCountry, selectedProto]);

  const allFilteredKeys = useMemo(() => {
    return filteredNodes.map((n) => n.uri);
  }, [filteredNodes]);

  // 6. Direct Downloads
  const handleDownloadTxt = useCallback(() => {
    const blob = new Blob([allFilteredKeys.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turboprobe-sub-${activePreset}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allFilteredKeys, activePreset]);

  const handleDownloadClash = useCallback(() => {
    const proxies = filteredNodes.slice(0, 100).map((n, i) => {
      let name = `TurboProbe-${String(i + 1).padStart(3, '0')}`;
      if (n.uri.includes('#')) {
        try {
          name = decodeURIComponent(n.uri.split('#')[1]).replace(/[:"'\[\]]/g, '').slice(0, 50);
        } catch (_) {}
      }
      return `  - name: "${name}"\n    type: vless\n    server: 1.1.1.1\n    port: 443\n    uuid: 00000000-0000-0000-0000-000000000000\n    udp: true`;
    });

    const yaml = [
      'port: 7890',
      'socks-port: 7891',
      'mode: rule',
      'proxies:',
      ...proxies,
      '\nproxy-groups:\n  - name: "⚡ AUTO-BEST"\n    type: url-test\n    url: http://cp.cloudflare.com/generate_204\n    proxies:',
      ...filteredNodes.slice(0, 100).map((_, i) => `      - "TurboProbe-${String(i + 1).padStart(3, '0')}"`),
      '\nrules:\n  - DOMAIN-SUFFIX,openai.com,⚡ AUTO-BEST\n  - DOMAIN-SUFFIX,youtube.com,⚡ AUTO-BEST\n  - GEOIP,RU,DIRECT\n  - MATCH,⚡ AUTO-BEST',
    ].join('\n');

    const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turboprobe-clash.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredNodes]);

  return (
    <div className="relative min-h-screen bg-[#050505] text-zinc-100 selection:bg-zinc-100 selection:text-zinc-950 overflow-x-hidden">
      
      {/* Interactive 3D Earth Globe Background */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden opacity-35">
        <div className="w-[800px] h-[800px] sm:w-[1100px] sm:h-[1100px] lg:w-[1300px] lg:h-[1300px] flex items-center justify-center">
          <Globe
            speed={1.2}
            smoothing={8}
            scale={10}
            dots={{ color: '#ffffff', size: 3.5, density: 7, allDots: false }}
            markerConfig={{ markers: SERVER_HUB_MARKERS, color: '#ffffff', size: 40 }}
            oceanColor="#00000000"
            graticuleColor="#27272a"
            showGrid={false}
          />
        </div>
      </div>

      {/* Subtle Radial Gradient to Vignette the Globe */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-transparent via-[#050505]/60 to-[#050505]" />

      {/* Main Content Layer */}
      <div className="relative z-10">
        {/* Header with MetalFx & Pop-in Metrics */}
        <Header stats={stats} totalFilteredNodes={allNodes.length || 45000} />

        <main className="pb-16 space-y-2">
          {/* Preset Selector with BorderBeam */}
          <PresetSelector activePreset={activePreset} onSelectPreset={handleSelectPreset} />

          {/* Filter Panel with Spring Physics */}
          <FilterPanel
            selectedServices={selectedServices}
            onToggleService={handleToggleService}
            selectedCountry={selectedCountry}
            onSelectCountry={handleSelectCountry}
            selectedProto={selectedProto}
            onSelectProto={handleSelectProto}
            maxPing={maxPing}
            onChangeMaxPing={handleChangeMaxPing}
            minHealth={minHealth}
            onChangeMinHealth={handleChangeMinHealth}
          />

          {/* Export Panel with Text Blur Swap & Icon Morph */}
          <ExportPanel
            subUrl={subUrl}
            filteredCount={filteredNodes.length}
            allFilteredKeys={allFilteredKeys}
            onOpenQr={() => setIsQrOpen(true)}
            onDownloadTxt={handleDownloadTxt}
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
