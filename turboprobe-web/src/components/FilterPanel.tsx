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
import { M3SegmentedButton, type SegmentOption } from './ui/M3SegmentedButton';
import { M3FilterChip } from './ui/M3FilterChip';
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

  // Segment Options mapped to M3 Segmented Control
  const segmentOptions: SegmentOption[] = useMemo(() => {
    return [
      {
        id: 'anti-tspu',
        label: 'Анти-ТСПУ',
        desc: 'VLESS Reality',
        icon: <Shield className="w-3.5 h-3.5 text-[#D0BCFF]" />,
      },
      {
        id: 'ai',
        label: 'AI Core',
        desc: 'ChatGPT / Claude',
        icon: <Sparkles className="w-3.5 h-3.5 text-[#D0BCFF]" />,
      },
      {
        id: 'youtube',
        label: 'YouTube 4K',
        desc: 'Без буфера',
        icon: <Tv className="w-3.5 h-3.5 text-[#D0BCFF]" />,
      },
      {
        id: 'all',
        label: 'Все узлы',
        desc: 'Мин. пинг',
        icon: <Layers className="w-3.5 h-3.5 text-[#D0BCFF]" />,
      },
    ];
  }, []);

  const handleSelectSegment = (id: string) => {
    const found = PRESETS.find((p) => p.id === id);
    if (found) onSelectPreset(found);
  };

  // Dynamically compute and sort countries based on pool availability
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

  // Dynamically compute available protocols based on pool availability
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
      {/* 1. M3 Expressive Segmented Buttons (Hero Routing Mode Switcher) */}
      <M3SegmentedButton
        options={segmentOptions}
        selectedId={activePreset}
        onSelect={handleSelectSegment}
      />

      {/* 2. Expandable Advanced Filter Accordion (M3 Surface Container Low) */}
      <div className="rounded-[28px] bg-[#1D1B20] border border-[#49454F]/30 overflow-hidden shadow-lg">
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          type="button"
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-display font-semibold text-[#E6E0E9] hover:bg-[#2B2930] transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-[#D0BCFF]" />
            <span>Тонкая настройка (сервисы, протоколы, страны)</span>
            {customFilterCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#4A4458] text-[#EADDFF] text-[10px] font-mono font-bold">
                +{customFilterCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[#CAC4D0]">
            <span className="text-[11px] font-body hidden sm:inline">{isAdvancedOpen ? 'Свернуть' : 'Настроить'}</span>
            <div className="p-0.5">
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </button>

        {/* Collapsible Content with M3 Filter Chips */}
        <AnimatePresence initial={false}>
          {isAdvancedOpen && (
            <motion.div
              key="advanced-filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.05, 0.7, 0.1, 1.0] }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-3 border-t border-[#49454F]/25 space-y-4">
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

                  <div className="flex flex-wrap items-center gap-1.5">
                    {SERVICES.map((srv) => {
                      const isSelected = selectedServices.includes(srv.id);
                      const Icon = srv.icon;

                      return (
                        <M3FilterChip
                          key={srv.id}
                          label={srv.name}
                          selected={isSelected}
                          onToggle={() => onToggleService(srv.id)}
                          icon={<Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* 2. Protocols Chips */}
                <div className="pt-3 border-t border-[#49454F]/25">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#CAC4D0] font-mono flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#D0BCFF]" />
                      Протокол
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <M3FilterChip
                      label="Все протоколы"
                      selected={selectedProtos.length === 0}
                      onToggle={onClearProtos}
                    />

                    {availableProtos.map((p) => {
                      const isSelected = selectedProtos.includes(p.id);

                      return (
                        <M3FilterChip
                          key={p.id}
                          label={p.label}
                          count={p.count}
                          selected={isSelected}
                          onToggle={() => onToggleProto(p.id)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* 3. Locations Chips */}
                <div className="pt-3 border-t border-[#49454F]/25">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#CAC4D0] font-mono flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5 text-[#D0BCFF]" />
                      Страны
                    </span>
                  </div>

                  <div className={`flex flex-wrap items-center gap-1.5 ${
                    isExpandedCountries ? 'max-h-[160px] overflow-y-auto pr-1' : ''
                  }`}>
                    <M3FilterChip
                      label="Все страны"
                      selected={selectedCountries.length === 0}
                      onToggle={onClearCountries}
                    />

                    {visibleCountries.map((c) => {
                      const isSelected = selectedCountries.includes(c.code);

                      return (
                        <M3FilterChip
                          key={c.code}
                          label={c.label}
                          count={c.count}
                          selected={isSelected}
                          onToggle={() => onToggleCountry(c.code)}
                          icon={
                            <CountryFlag
                              countryCode={c.code}
                              className="w-3.5 h-2 rounded-[2px] shadow-xs flex-shrink-0"
                            />
                          }
                        />
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
