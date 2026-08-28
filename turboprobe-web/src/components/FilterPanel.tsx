import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe2,
  Sliders,
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
import { PRESETS, KNOWN_COUNTRIES, KNOWN_PROTOCOLS } from '../constants';
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
  onChangeMinHealth: _onChangeMinHealth,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [isExpandedCountries, setIsExpandedCountries] = useState<boolean>(false);

  // Dynamically compute and sort countries based 100% on live pool availability
  const availableCountries = useMemo(() => {
    const list = Object.keys(countryCounts)
      .filter((code) => countryCounts[code] > 0)
      .map((code) => ({
        code,
        label: KNOWN_COUNTRIES[code] || code.toUpperCase(),
        count: countryCounts[code] || 0,
      }));

    return list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, 'ru');
    });
  }, [countryCounts]);

  // Dynamically compute available protocols based 100% on live pool availability
  const availableProtos = useMemo(() => {
    return Object.keys(protoCounts)
      .filter((id) => protoCounts[id] > 0)
      .map((id) => ({
        id,
        label: KNOWN_PROTOCOLS[id] || id.toUpperCase(),
        count: protoCounts[id] || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [protoCounts]);

  const visibleCountries = isExpandedCountries ? availableCountries : availableCountries.slice(0, 10);
  const hiddenCountryCount = Math.max(0, availableCountries.length - 10);

  const customFilterCount =
    selectedServices.length +
    selectedCountries.length +
    selectedProtos.length +
    (minHealth > 0 ? 1 : 0);

  return (
    <div className="w-full space-y-3">
      {/* 1. Four Big Interactive Hero Mode Cards (MD3 Bento Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;

          return (
            <motion.button
              key={preset.id}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => onSelectPreset(preset)}
              type="button"
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between select-none ${
                isActive
                  ? 'bg-[#4F378B] text-[#EADDFF] border-[#D0BCFF] shadow-md ring-2 ring-[#D0BCFF]/20'
                  : 'bg-[#1D1B20] border-[#49454F]/40 text-[#CAC4D0] hover:border-[#49454F]/80 hover:bg-[#2B2930] hover:text-[#E6E0E9]'
              }`}
            >
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-[#381E72] text-[#D0BCFF]' : 'bg-[#141218] text-[#CAC4D0] border border-[#49454F]/30'
                }`}>
                  {preset.id === 'all' && <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  {preset.id === 'anti-tspu' && <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  {preset.id === 'ai' && <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  {preset.id === 'youtube' && <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>

                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-[#7BE08F] shadow-sm shadow-[#7BE08F]/50" />
                )}
              </div>

              <div>
                <span className={`font-display text-xs sm:text-sm font-bold block ${
                  isActive ? 'text-white' : 'text-[#E6E0E9]'
                }`}>
                  {preset.name}
                </span>
                <span className={`text-[11px] font-mono block mt-0.5 sm:mt-1 ${
                  isActive ? 'text-[#EADDFF]/80' : 'text-[#938F99]'
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

      {/* 2. Expandable Advanced Filter Accordion (MD3 Style) */}
      <div className="rounded-[28px] bg-[#1D1B20] border border-[#49454F]/40 overflow-hidden shadow-md">
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          type="button"
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-display font-semibold text-[#E6E0E9] hover:bg-[#2B2930] transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-[#D0BCFF]" />
            <span>Тонкая настройка (сервисы, протоколы, страны)</span>
            {customFilterCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#4A4458] text-[#E8DEF8] text-[10px] font-mono font-bold">
                +{customFilterCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[#CAC4D0]">
            <span className="text-[11px] font-body hidden sm:inline">{isAdvancedOpen ? 'Скрыть' : 'Настроить'}</span>
            <div className="p-0.5">
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {/* Collapsible Content */}
        <AnimatePresence initial={false}>
          {isAdvancedOpen && (
            <motion.div
              key="advanced-filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-3 border-t border-[#49454F]/30 space-y-4">
                
                {/* 1. Services Chips */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#CAC4D0] font-mono flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#D0BCFF]" />
                      Сервисы
                    </span>
                    {selectedServices.length > 0 && (
                      <span className="text-[10px] text-[#D0BCFF] font-mono">
                        Выбрано: {selectedServices.length}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {SERVICES.map((srv) => {
                      const isSelected = selectedServices.includes(srv.id);
                      const Icon = srv.icon;

                      return (
                        <button
                          key={srv.id}
                          onClick={() => onToggleService(srv.id)}
                          type="button"
                          className={`inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-[#4A4458] text-[#E8DEF8] font-semibold border-[#CCC2DC]/50 shadow-sm'
                              : 'bg-[#141218] border-[#49454F]/30 text-[#CAC4D0] hover:border-[#49454F]/60 hover:text-white hover:bg-[#2B2930]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{srv.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Protocols Chips */}
                <div className="pt-3 border-t border-[#49454F]/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#CAC4D0] font-mono flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#D0BCFF]" />
                      Протокол
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={onClearProtos}
                      type="button"
                      className={`inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none ${
                        selectedProtos.length === 0
                          ? 'bg-[#4A4458] text-[#E8DEF8] font-semibold border-[#CCC2DC]/50'
                          : 'bg-[#141218] border-[#49454F]/30 text-[#CAC4D0] hover:border-[#49454F]/60 hover:text-white'
                      }`}
                    >
                      <span>Все</span>
                    </button>

                    {availableProtos.map((p) => {
                      const isSelected = selectedProtos.includes(p.id);

                      return (
                        <button
                          key={p.id}
                          onClick={() => onToggleProto(p.id)}
                          type="button"
                          className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-[#4A4458] text-[#E8DEF8] font-semibold border-[#CCC2DC]/50 shadow-sm'
                              : 'bg-[#141218] border-[#49454F]/30 text-[#CAC4D0] hover:border-[#49454F]/60 hover:text-white'
                          }`}
                        >
                          <span>{p.label}</span>
                          <span className="text-[10px] font-mono opacity-70 ml-0.5">
                            ({p.count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Locations Chips */}
                <div className="pt-3 border-t border-[#49454F]/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#CAC4D0] font-mono flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5 text-[#D0BCFF]" />
                      Страны
                    </span>
                  </div>

                  <div className={`flex flex-wrap items-center gap-2 ${
                    isExpandedCountries ? 'max-h-[160px] overflow-y-auto pr-1' : ''
                  }`}>
                    <button
                      onClick={onClearCountries}
                      type="button"
                      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none ${
                        selectedCountries.length === 0
                          ? 'bg-[#4A4458] text-[#E8DEF8] font-semibold border-[#CCC2DC]/50'
                          : 'bg-[#141218] border-[#49454F]/30 text-[#CAC4D0] hover:border-[#49454F]/60 hover:text-white'
                      }`}
                    >
                      <span>Все страны</span>
                    </button>

                    {visibleCountries.map((c) => {
                      const isSelected = selectedCountries.includes(c.code);

                      return (
                        <button
                          key={c.code}
                          onClick={() => onToggleCountry(c.code)}
                          type="button"
                          className={`inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer select-none ${
                            isSelected
                              ? 'bg-[#4A4458] text-[#E8DEF8] font-semibold border-[#CCC2DC]/50 shadow-sm'
                              : 'bg-[#141218] border-[#49454F]/30 text-[#CAC4D0] hover:border-[#49454F]/60 hover:text-white'
                          }`}
                        >
                          <CountryFlag countryCode={c.code} className="w-3.5 h-2 rounded-[2px] shadow-sm flex-shrink-0" />
                          <span>{c.label}</span>
                          {c.count > 0 && (
                            <span className="text-[10px] font-mono opacity-70">
                              {c.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {hiddenCountryCount > 0 && (
                    <div className="mt-2 text-left">
                      <button
                        onClick={() => setIsExpandedCountries(!isExpandedCountries)}
                        type="button"
                        className="text-[11px] font-mono text-[#D0BCFF] hover:underline transition-colors cursor-pointer"
                      >
                        {isExpandedCountries ? 'Свернуть список стран' : `Показать все страны (+${hiddenCountryCount})`}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
