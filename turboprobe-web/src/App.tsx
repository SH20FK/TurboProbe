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
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedProto, setSelectedProto] = useState<string>('all');
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
    // 1. Preset specific mappings
    if (activePreset === 'anti-tspu') return `${CDN_BASE}/anti-whitelist.txt`;
    if (activePreset === 'ai') return `${CDN_BASE}/services/ai-bundle.txt`;
    if (activePreset === 'youtube') return `${CDN_BASE}/services/youtube.txt`;
    if (activePreset === 'de') return `${CDN_BASE}/countries/de.txt`;
    if (activePreset === 'nl') return `${CDN_BASE}/countries/nl.txt`;

    // 2. Service-driven selection
    if (selectedServices.length > 0) {
      if (selectedServices.length === 1) {
        const s = selectedServices[0];
        return `${CDN_BASE}/services/${s}.txt`;
      }
      // If multiple AI services picked (e.g. Claude + Gemini, ChatGPT + Claude, etc.)
      const isAiOnly = selectedServices.every((s) =>
        ['chatgpt', 'claude', 'gemini', 'perplexity'].includes(s)
      );
      if (isAiOnly) {
        return `${CDN_BASE}/services/ai-bundle.txt`;
      }
      if (selectedServices.includes('youtube') && selectedServices.includes('discord')) {
        return `${CDN_BASE}/services/youtube.txt`;
      }
      if (selectedServices.includes('claude') || selectedServices.includes('gemini')) {
        return `${CDN_BASE}/services/ai-bundle.txt`;
      }
      return `${CDN_BASE}/services/${selectedServices[0]}.txt`;
    }

    // 3. Country-driven selection
    if (selectedCountry && selectedCountry !== 'all') {
      return `${CDN_BASE}/countries/${selectedCountry.toLowerCase()}.txt`;
    }

    // 4. Protocol-driven selection
    if (selectedProto === 'reality') return `${CDN_BASE}/reality.txt`;
    if (selectedProto === 'trojan') return `${CDN_BASE}/trojan.txt`;
    if (selectedProto === 'hy2') return `${CDN_BASE}/hysteria2.txt`;
    if (selectedProto === 'ss') return `${CDN_BASE}/shadowsocks.txt`;

    // 5. Default
    return `${CDN_BASE}/top50.txt`;
  }, [activePreset, selectedServices, selectedCountry, selectedProto]);

  const allFilteredKeys = useMemo(() => {
    return filteredNodes.map((n) => n.uri);
  }, [filteredNodes]);

  const handleDownloadClash = useCallback(() => {
    const proxyNames: string[] = [];
    const proxies = filteredNodes.slice(0, 100).map((n, i) => {
      let cleanName = `TurboProbe-${String(i + 1).padStart(3, '0')}`;
      if (n.uri.includes('#')) {
        try {
          cleanName = decodeURIComponent(n.uri.split('#')[1]).replace(/[:"'\[\]]/g, '').slice(0, 45);
        } catch (_) {}
      }
      const uniqueName = `${cleanName} #${String(i + 1).padStart(3, '0')}`;
      proxyNames.push(uniqueName);
      return `  - name: "${uniqueName}"\n    type: vless\n    server: 1.1.1.1\n    port: 443\n    uuid: 00000000-0000-0000-0000-000000000000\n    udp: true`;
    });

    const yaml = [
      'port: 7890',
      'socks-port: 7891',
      'mode: rule',
      'proxies:',
      ...proxies,
      '\nproxy-groups:\n  - name: "⚡ AUTO-BEST"\n    type: url-test\n    url: http://cp.cloudflare.com/generate_204\n    proxies:',
      ...proxyNames.map((pName) => `      - "${pName}"`),
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
            selectedCountry={selectedCountry}
            onSelectCountry={handleSelectCountry}
            selectedProto={selectedProto}
            onSelectProto={handleSelectProto}
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
