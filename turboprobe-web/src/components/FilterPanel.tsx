import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe2,
  Sliders,
  ShieldCheck,
  Sparkles,
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
  minHealth,
  onChangeMinHealth,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isExpandedCountries, setIsExpandedCountries] = useState<boolean>(false);

  // Dynamically compute and sort countries based on live pool availability
  const availableCountries = useMemo(() => {
    const codes = new Set<string>([...DEFAULT_POPULAR_COUNTRIES, ...Object.keys(countryCounts)]);
    const list = Array.from(codes).map((code) => ({
      code,
      label: KNOWN_COUNTRIES[code] || code.toUpperCase(),
      count: countryCounts[code] || 0,
    }));

    return list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, 'ru');
    });
  }, [countryCounts]);

  const visibleCountries = isExpandedCountries ? availableCountries : availableCountries.slice(0, 10);
  const hiddenCountryCount = Math.max(0, availableCountries.length - 10);

  const customFilterCount =
    selectedServices.length +
    selectedCountries.length +
    selectedProtos.length +
    (minHealth > 0 ? 1 : 0);

  return (
    <div className="w-full space-y-3">
      {/* 1. Four Big Interactive Hero Mode Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;

          return (
            <motion.button
              key={preset.id}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => onSelectPreset(preset)}
              type="button"
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between select-none ${
                isActive
                  ? 'bg-zinc-800/90 text-white border-zinc-500 shadow-md ring-1 ring-zinc-500/20'
                  : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-850/60 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-zinc-700 text-white border border-zinc-600' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'
                }`}>
                  {preset.id === 'all' && <Layers className="w-3.5 h-3.5" />}
                  {preset.id === 'anti-tspu' && <Shield className="w-3.5 h-3.5" />}
                  {preset.id === 'ai' && <Sparkles className="w-3.5 h-3.5" />}
                  {preset.id === 'youtube' && <Tv className="w-3.5 h-3.5" />}
                </div>

                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/40" />
                )}
              </div>

              <div>
                <span className={`text-xs sm:text-sm font-semibold block ${
                  isActive ? 'text-white' : 'text-zinc-300'
                }`}>
                  {preset.name}
                </span>
                <span className={`text-[11px] font-mono block mt-0.5 ${
                  isActive ? 'text-zinc-300' : 'text-zinc-500'
                }`}>
                  {preset.id === 'all' && 'Минимальный пинг'}
                  {preset.id === 'anti-tspu' && 'Обход ТСПУ / РКН'}
                  {preset.id === 'ai' && 'ChatGPT / Claude'}
                  {preset.id === 'youtube' && '4K без буфера'}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* 2. Expandable Advanced Filter Accordion */}
      <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800/80 overflow-hidden shadow-md">
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          type="button"
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold text-zinc-200">Тонкая настройка (сервисы, протоколы, страны)</span>
            {customFilterCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-200 border border-white/10 font-bold">
                Активно: {customFilterCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-zinc-400">
            <span className="text-[11px] hidden sm:inline">{isAdvancedOpen ? 'Скрыть' : 'Настроить'}</span>
            <motion.div
              animate={{ rotate: isAdvancedOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </div>
        </button>

        {/* Collapsible Content with Full AnimatePresence Exit Support */}
        <AnimatePresence initial={false}>
          {isAdvancedOpen && (
            <motion.div
              key="advanced-filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] space-y-3.5">
                
                {/* 1. Services */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-zinc-300" />
                      Целевые сервисы
                    </span>
                    {selectedServices.length > 0 && (
                      <span className="text-[10px] text-zinc-300 font-mono">
                        Выбрано: {selectedServices.length}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {SERVICES.map((srv) => {
                      const isSelected = selectedServices.includes(srv.id);
                      const Icon = srv.icon;

                      return (
                        <motion.button
                          key={srv.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onToggleService(srv.id)}
                          type="button"
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-sm'
                              : 'bg-zinc-800/50 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{srv.name}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Protocols */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                      <Sliders className="w-3 h-3 text-zinc-300" />
                      Протокол
                    </span>
                    {selectedProtos.length > 0 && (
                      <span className="text-[10px] text-zinc-300 font-mono">
                        {selectedProtos.length}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={onClearProtos}
                      type="button"
                      className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                        selectedProtos.length === 0
                          ? 'bg-zinc-100 text-zinc-950 font-bold border-white'
                          : 'bg-zinc-800/50 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span>Все</span>
                    </button>

                    {PROTOCOLS.map((p) => {
                      const isSelected = selectedProtos.includes(p.id);
                      const count = protoCounts[p.id] || 0;

                      return (
                        <button
                          key={p.id}
                          onClick={() => onToggleProto(p.id)}
                          type="button"
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-sm'
                              : 'bg-zinc-800/50 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <span>{p.label}</span>
                          {count > 0 && (
                            <span className={`text-[10px] px-1 rounded font-mono ${
                              isSelected ? 'bg-zinc-300 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Locations (Full Width Balanced Grid) */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
                      <Globe2 className="w-3 h-3 text-zinc-300" />
                      Локация (Страны)
                    </span>
                    {selectedCountries.length > 0 && (
                      <span className="text-[10px] text-zinc-300 font-mono">
                        Выбрано: {selectedCountries.length}
                      </span>
                    )}
                  </div>

                  <div className={`flex flex-wrap items-center gap-1.5 ${
                    isExpandedCountries ? 'max-h-[140px] overflow-y-auto pr-1' : ''
                  }`}>
                    <button
                      onClick={onClearCountries}
                      type="button"
                      className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                        selectedCountries.length === 0
                          ? 'bg-zinc-100 text-zinc-950 font-bold border-white'
                          : 'bg-zinc-800/50 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <CountryFlag countryCode="all" className="w-3.5 h-2 rounded-[1px] shadow-sm flex-shrink-0" />
                      <span>Все</span>
                    </button>

                    {visibleCountries.map((c) => {
                      const isSelected = selectedCountries.includes(c.code);

                      return (
                        <button
                          key={c.code}
                          onClick={() => onToggleCountry(c.code)}
                          type="button"
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-zinc-100 text-zinc-950 font-bold border-white shadow-sm'
                              : 'bg-zinc-800/50 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <CountryFlag countryCode={c.code} className="w-3.5 h-2 rounded-[1px] shadow-sm flex-shrink-0" />
                          <span>{c.label}</span>
                          {c.count > 0 && (
                            <span className={`text-[10px] px-1 rounded font-mono ${
                              isSelected ? 'bg-zinc-300 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {c.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {hiddenCountryCount > 0 && (
                    <button
                      onClick={() => setIsExpandedCountries(!isExpandedCountries)}
                      type="button"
                      className="mt-2 text-zinc-400 hover:text-white text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                    >
                      {isExpandedCountries ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          <span>Свернуть список стран</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          <span>Показать все страны (+{hiddenCountryCount})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* 4. Health / Uptime Slider */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-zinc-300" />
                        Минимальный аптайм (Health Score)
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-zinc-200 px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10">
                        {minHealth === 0 ? 'Любой' : `≥ ${minHealth}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={5}
                      value={minHealth}
                      onChange={(e) => onChangeMinHealth(Number(e.target.value))}
                      className="w-full my-1 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
