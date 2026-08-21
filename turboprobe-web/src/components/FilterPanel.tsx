import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Globe2,
  Sliders,
  ShieldCheck,
  Sparkles,
  Zap,
  Shield,
  Tv,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ChatGptIcon,
  ClaudeIcon,
  GeminiIcon,
  YouTubeIcon,
  DiscordIcon,
  XTwitterIcon,
  SpotifyIcon,
  GitHubIcon,
} from './ServiceIcons';
import { CountryFlag } from './CountryFlags';
import { PRESETS, KNOWN_COUNTRIES, DEFAULT_POPULAR_COUNTRIES, PROTOCOLS } from '../constants';
import type { PresetItem } from '../types';

interface FilterPanelProps {
  activePreset: string;
  onSelectPreset: (preset: PresetItem) => void;
  selectedServices: string[];
  onToggleService: (serviceId: string) => void;
  selectedCountries: string[];
  onToggleCountry: (countryCode: string) => void;
  onClearCountries: () => void;
  selectedProtos: string[];
  onToggleProto: (proto: string) => void;
  onClearProtos: () => void;
  countryCounts: Record<string, number>;
  protoCounts: Record<string, number>;
  maxPing: number;
  onChangeMaxPing: (val: number) => void;
  minHealth: number;
  onChangeMinHealth: (val: number) => void;
}

const SERVICES = [
  { id: 'chatgpt', name: 'ChatGPT', icon: ChatGptIcon },
  { id: 'claude', name: 'Claude AI', icon: ClaudeIcon },
  { id: 'gemini', name: 'Gemini', icon: GeminiIcon },
  { id: 'youtube', name: 'YouTube 4K', icon: YouTubeIcon },
  { id: 'discord', name: 'Discord', icon: DiscordIcon },
  { id: 'twitter', name: 'Twitter / X', icon: XTwitterIcon },
  { id: 'spotify', name: 'Spotify', icon: SpotifyIcon },
  { id: 'github', name: 'GitHub Dev', icon: GitHubIcon },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  activePreset,
  onSelectPreset,
  selectedServices,
  onToggleService,
  selectedCountries,
  onToggleCountry,
  onClearCountries,
  selectedProtos,
  onToggleProto,
  onClearProtos,
  countryCounts,
  protoCounts,
  maxPing,
  onChangeMaxPing,
  minHealth,
  onChangeMinHealth,
}) => {
  const [isExpandedCountries, setIsExpandedCountries] = useState<boolean>(false);

  // Dynamically compute and sort countries based on live pool availability
  const availableCountries = useMemo(() => {
    const codes = new Set<string>([...DEFAULT_POPULAR_COUNTRIES, ...Object.keys(countryCounts)]);
    const list = Array.from(codes).map((code) => ({
      code,
      label: KNOWN_COUNTRIES[code] || code.toUpperCase(),
      count: countryCounts[code] || 0,
    }));

    // Sort: countries with active nodes first (descending count), then alphabetically
    return list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, 'ru');
    });
  }, [countryCounts]);

  const visibleCountries = isExpandedCountries ? availableCountries : availableCountries.slice(0, 8);
  const hiddenCountryCount = Math.max(0, availableCountries.length - 8);

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-2 space-y-4">
      
      {/* 1. Unified Quick Presets & Services Control Hub */}
      <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08] space-y-5">
        {/* Top: Quick 1-Click Presets */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-zinc-300" />
              Быстрые пресеты (1 клик)
            </span>
            <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
              Автоматическая конфигурация
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;

              return (
                <motion.button
                  key={preset.id}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  onClick={() => onSelectPreset(preset)}
                  type="button"
                  className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-white text-zinc-950 border-white shadow-lg shadow-white/10'
                      : 'bg-zinc-800/60 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {preset.id === 'all' && <Layers className="w-3.5 h-3.5" />}
                  {preset.id === 'anti-tspu' && <Shield className="w-3.5 h-3.5" />}
                  {preset.id === 'ai' && <Sparkles className="w-3.5 h-3.5" />}
                  {preset.id === 'youtube' && <Tv className="w-3.5 h-3.5" />}
                  <span>{preset.name}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.06]" />

        {/* Bottom: Target Services Selection */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-300" />
              Выбор сервисов (Мультивыбор)
            </span>
            {selectedServices.length > 0 && (
              <span className="text-xs text-zinc-200 font-mono bg-zinc-800 px-2 py-0.5 rounded border border-white/10">
                Выбрано: {selectedServices.length}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {SERVICES.map((srv) => {
              const isSelected = selectedServices.includes(srv.id);
              const Icon = srv.icon;

              return (
                <motion.button
                  key={srv.id}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  onClick={() => onToggleService(srv.id)}
                  type="button"
                  className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-md'
                      : 'bg-zinc-900/80 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{srv.name}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Country & Protocol Selection (Multi-select) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country Multi-Select with Expandable List */}
        <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-zinc-300" />
                Локация серверов (Мультивыбор)
              </span>
              {selectedCountries.length > 0 && (
                <span className="text-xs text-zinc-200 font-mono bg-zinc-800 px-2 py-0.5 rounded border border-white/10">
                  Выбрано: {selectedCountries.length}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {/* All Countries Button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                onClick={onClearCountries}
                type="button"
                className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                  selectedCountries.length === 0
                    ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-md'
                    : 'bg-zinc-900/80 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <CountryFlag countryCode="all" className="w-4 h-2.5 rounded-[1px] shadow-sm flex-shrink-0" />
                <span>Все страны</span>
              </motion.button>

              {/* Dynamic Country Buttons */}
              {visibleCountries.map((c) => {
                const isSelected = selectedCountries.includes(c.code);

                return (
                  <motion.button
                    key={c.code}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    onClick={() => onToggleCountry(c.code)}
                    type="button"
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-md'
                        : 'bg-zinc-900/80 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <CountryFlag countryCode={c.code} className="w-4 h-2.5 rounded-[1px] shadow-sm flex-shrink-0" />
                    <span>{c.label}</span>
                    {c.count > 0 && (
                      <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                        isSelected ? 'bg-zinc-300 text-zinc-950' : 'bg-zinc-800/80 text-zinc-400'
                      }`}>
                        {c.count}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Show More / Show Less Toggle Button */}
          {hiddenCountryCount > 0 && (
            <div className="mt-3.5 pt-2 border-t border-white/[0.06] flex justify-center">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsExpandedCountries(!isExpandedCountries)}
                type="button"
                className="px-3 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-mono flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
              >
                {isExpandedCountries ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Свернуть страны</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Еще +{hiddenCountryCount} стран</span>
                  </>
                )}
              </motion.button>
            </div>
          )}
        </div>

        {/* Protocol Multi-Select */}
        <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2">
                <Sliders className="w-4 h-4 text-zinc-300" />
                Протокол шифрования (Мультивыбор)
              </span>
              {selectedProtos.length > 0 && (
                <span className="text-xs text-zinc-200 font-mono bg-zinc-800 px-2 py-0.5 rounded border border-white/10">
                  Выбрано: {selectedProtos.length}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {/* All Protocols Button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                onClick={onClearProtos}
                type="button"
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                  selectedProtos.length === 0
                    ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-md'
                    : 'bg-zinc-900/80 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span>Все протоколы</span>
              </motion.button>

              {/* Protocol Buttons */}
              {PROTOCOLS.map((p) => {
                const isSelected = selectedProtos.includes(p.id);
                const count = protoCounts[p.id] || 0;

                return (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    onClick={() => onToggleProto(p.id)}
                    type="button"
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-md'
                        : 'bg-zinc-900/80 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>{p.label}</span>
                    {count > 0 && (
                      <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                        isSelected ? 'bg-zinc-300 text-zinc-950' : 'bg-zinc-800/80 text-zinc-400'
                      }`}>
                        {count}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sliders: Max Ping & Min Health Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ping Slider */}
        <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
              Максимальный пинг
            </span>
            <span className="text-xs font-mono font-semibold text-zinc-200 px-2 py-0.5 rounded bg-zinc-800 border border-white/10">
              {maxPing === 0 ? 'Любой пинг' : `до ${maxPing} ms`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={350}
            step={10}
            value={maxPing}
            onChange={(e) => onChangeMaxPing(Number(e.target.value))}
            className="w-full my-2"
          />
          <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
            <span>Все</span>
            <span>100 ms</span>
            <span>200 ms</span>
            <span>350 ms</span>
          </div>
        </div>

        {/* Health Score Slider */}
        <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
              Health Score (Аптайм)
            </span>
            <span className="text-xs font-mono font-semibold text-zinc-200 px-2 py-0.5 rounded bg-zinc-800 border border-white/10">
              {minHealth === 0 ? 'Любой аптайм' : `от ${minHealth}%`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={minHealth}
            onChange={(e) => onChangeMinHealth(Number(e.target.value))}
            className="w-full my-2"
          />
          <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
            <span>Все</span>
            <span>50%+</span>
            <span>75%+</span>
            <span>90%+ VIP</span>
          </div>
        </div>
      </div>
    </section>
  );
};
