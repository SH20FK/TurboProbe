import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  ChevronDown,
  Shield,
  Sparkles,
  Tv,
  Layers,
  Flame,
  RotateCcw,
} from 'lucide-react';
import { M3SegmentedButton, type SegmentOption } from './ui/M3SegmentedButton';
import { M3FilterChip } from './ui/M3FilterChip';
import { CountryFlag } from './CountryFlags';
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
import type { PresetItem } from '../types';

interface FilterPanelProps {
  activePreset: string;
  onSelectPreset: (preset: PresetItem) => void;
  selectedServices: string[];
  onToggleService: (id: string) => void;
  selectedCountries: string[];
  onToggleCountry: (countryCode: string) => void;
  onClearCountries: () => void;
  selectedProtos: string[];
  onToggleProto: (proto: string) => void;
  onClearProtos: () => void;
  countryCounts: Record<string, number>;
  protoCounts: Record<string, number>;
  minHealth?: number;
  onChangeMinHealth?: (val: number) => void;
}

const PRESETS: PresetItem[] = [
  {
    id: 'anti-tspu',
    name: 'Анти-ТСПУ',
    desc: 'VLESS Reality',
    icon: 'shield',
    country: 'all',
    proto: 'reality',
    services: [],
    maxPing: 350,
  },
  {
    id: 'ai',
    name: 'AI Core',
    desc: 'ChatGPT / Claude',
    icon: 'sparkles',
    country: 'us',
    proto: 'all',
    services: ['chatgpt', 'claude', 'gemini'],
    maxPing: 450,
  },
  {
    id: 'youtube',
    name: 'YouTube 4K',
    desc: 'Без буфера',
    icon: 'tv',
    country: 'all',
    proto: 'all',
    services: ['youtube'],
    maxPing: 400,
  },
  {
    id: 'all',
    name: 'Все узлы',
    desc: 'Мин. пинг',
    icon: 'layers',
    country: 'all',
    proto: 'all',
    services: [],
    maxPing: 999,
  },
];

const KNOWN_COUNTRIES: Record<string, string> = {
  us: 'США',
  de: 'Германия',
  nl: 'Нидерланды',
  fi: 'Финляндия',
  gb: 'Великобритания',
  fr: 'Франция',
  at: 'Австрия',
  se: 'Швеция',
  ch: 'Швейцария',
  jp: 'Япония',
  sg: 'Сингапур',
  kr: 'Корея',
  kz: 'Казахстан',
  tr: 'Турция',
  in: 'Индия',
  ca: 'Канада',
  ru: 'Россия',
  ee: 'Эстония',
  pl: 'Польша',
  cz: 'Чехия',
};

const KNOWN_PROTOCOLS: Record<string, string> = {
  reality: 'VLESS Reality',
  vless: 'VLESS WS/gRPC',
  trojan: 'Trojan',
  hy2: 'Hysteria 2',
  ss: 'Shadowsocks',
};

const SERVICES = [
  { id: 'chatgpt', label: 'ChatGPT', icon: <ChatGptIcon /> },
  { id: 'claude', label: 'Claude AI', icon: <ClaudeIcon /> },
  { id: 'gemini', label: 'Gemini', icon: <GeminiIcon /> },
  { id: 'youtube', label: 'YouTube 4K', icon: <YouTubeIcon /> },
  { id: 'discord', label: 'Discord', icon: <DiscordIcon /> },
  { id: 'twitter', label: 'Twitter / X', icon: <XTwitterIcon /> },
  { id: 'spotify', label: 'Spotify', icon: <SpotifyIcon /> },
  { id: 'github', label: 'GitHub Dev', icon: <GitHubIcon /> },
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
  minHealth: _minHealth,
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
        icon: <Shield className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />,
      },
      {
        id: 'ai',
        label: 'AI Core',
        desc: 'ChatGPT / Claude',
        icon: <Sparkles className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />,
      },
      {
        id: 'youtube',
        label: 'YouTube 4K',
        desc: 'Без буфера',
        icon: <Tv className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />,
      },
      {
        id: 'all',
        label: 'Все узлы',
        desc: 'Мин. пинг',
        icon: <Layers className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />,
      },
    ];
  }, []);

  const handleSelectSegment = (id: string) => {
    const found = PRESETS.find((p) => p.id === id);
    if (found) {
      onSelectPreset(found);
    }
  };

  // Dynamically compute and sort countries based on pool availability
  const availableCountries = useMemo(() => {
    const list = Object.keys(countryCounts)
      .filter((code) => (countryCounts[code] || 0) > 0 || selectedCountries.includes(code))
      .map((code) => ({
        code,
        label: KNOWN_COUNTRIES[code] || code.toUpperCase(),
        count: countryCounts[code] || 0,
      }));

    return list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, 'ru');
    });
  }, [countryCounts, selectedCountries]);

  // Dynamically compute available protocols based on pool availability
  const availableProtos = useMemo(() => {
    return Object.keys(protoCounts)
      .filter((id) => (protoCounts[id] || 0) > 0 || selectedProtos.includes(id))
      .map((id) => ({
        id,
        label: KNOWN_PROTOCOLS[id] || id.toUpperCase(),
        count: protoCounts[id] || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [protoCounts, selectedProtos]);

  const displayedCountries = useMemo(() => {
    if (isExpandedCountries) return availableCountries;
    return availableCountries.slice(0, 8);
  }, [availableCountries, isExpandedCountries]);

  const activeFiltersCount =
    selectedServices.length + selectedCountries.length + selectedProtos.length;

  return (
    <div className="space-y-3 w-full">
      {/* 1. M3 Segmented Control (Hero Preset Selector) */}
      <M3SegmentedButton
        options={segmentOptions}
        selectedId={activePreset}
        onSelect={handleSelectSegment}
      />

      {/* 2. Unified Advanced Filter Accordion with Spring Physics */}
      <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xl overflow-hidden transition-colors duration-200">
        {/* Accordion Toggle Header */}
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          type="button"
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[var(--bg-card-hover)]/60 transition-colors text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[var(--bg-app)] border border-[var(--border-main)] flex items-center justify-center text-[#EA580C] dark:text-[#FB923C]">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <span className="font-display text-xs sm:text-sm font-semibold text-[var(--text-main)]">
                Тонкая настройка
              </span>
              <span className="text-xs text-[var(--text-muted)] ml-2 hidden sm:inline">
                (сервисы, протоколы, страны)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#EA580C]/15 text-[#EA580C] dark:text-[#FB923C] border border-[#EA580C]/35 font-bold">
                Активно: {activeFiltersCount}
              </span>
            )}
            <span className="text-xs text-[var(--text-muted)] font-body hidden sm:inline">
              {isAdvancedOpen ? 'Свернуть' : 'Настроить'}
            </span>
            <motion.div
              animate={{ rotate: isAdvancedOpen ? 180 : 0 }}
              transition={{ duration: 0.25, ease: [0.05, 0.7, 0.1, 1.0] }}
              className="p-1 rounded-full bg-[var(--bg-app)] text-[var(--text-muted)]"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </div>
        </button>

        {/* Accordion Body */}
        <AnimatePresence initial={false}>
          {isAdvancedOpen && (
            <motion.div
              key="advanced-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: 'auto',
                opacity: 1,
                transition: {
                  height: { type: 'spring', stiffness: 350, damping: 32 },
                  opacity: { duration: 0.22, ease: [0.05, 0.7, 0.1, 1.0] },
                },
              }}
              exit={{
                height: 0,
                opacity: 0,
                transition: {
                  height: { duration: 0.2, ease: [0.3, 0, 0.8, 0.15] },
                  opacity: { duration: 0.15 },
                },
              }}
              className="overflow-hidden border-t border-[var(--border-main)]"
            >
              <div className="p-4 sm:p-6 space-y-6">
                {/* 1. Services Chips */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />
                      <span>Оптимизация под сервисы</span>
                    </div>
                    {selectedServices.length > 0 && (
                      <button
                        onClick={() => {
                          selectedServices.forEach((s) => onToggleService(s));
                        }}
                        type="button"
                        className="text-[11px] font-mono text-[#EA580C] dark:text-[#FB923C] hover:underline flex items-center gap-1 cursor-pointer lowercase"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>сброс</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {SERVICES.map((s) => {
                      const isSelected = selectedServices.includes(s.id);
                      return (
                        <M3FilterChip
                          key={s.id}
                          label={s.label}
                          selected={isSelected}
                          onToggle={() => onToggleService(s.id)}
                          icon={s.icon}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* 2. Protocols Chips */}
                <div className="space-y-2.5 pt-4 border-t border-[var(--border-main)]">
                  <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />
                      <span>Протоколы шифрования</span>
                    </div>
                    {selectedProtos.length > 0 && (
                      <button
                        onClick={onClearProtos}
                        type="button"
                        className="text-[11px] font-mono text-[#EA580C] dark:text-[#FB923C] hover:underline flex items-center gap-1 cursor-pointer lowercase"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>все протоколы</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
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
                          selected={isSelected}
                          onToggle={() => onToggleProto(p.id)}
                          count={p.count}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* 3. Countries Chips with Flags */}
                <div className="space-y-2.5 pt-4 border-t border-[var(--border-main)]">
                  <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />
                      <span>Геолокации и страны</span>
                    </div>
                    {selectedCountries.length > 0 && (
                      <button
                        onClick={onClearCountries}
                        type="button"
                        className="text-[11px] font-mono text-[#EA580C] dark:text-[#FB923C] hover:underline flex items-center gap-1 cursor-pointer lowercase"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>все страны</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <M3FilterChip
                      label="Все страны"
                      selected={selectedCountries.length === 0}
                      onToggle={onClearCountries}
                    />

                    {displayedCountries.map((c) => {
                      const isSelected = selectedCountries.includes(c.code);
                      return (
                        <M3FilterChip
                          key={c.code}
                          label={c.label}
                          selected={isSelected}
                          onToggle={() => onToggleCountry(c.code)}
                          icon={<CountryFlag countryCode={c.code} className="w-4 h-3 rounded-xs flex-shrink-0" />}
                          count={c.count}
                        />
                      );
                    })}

                    {availableCountries.length > 8 && (
                      <button
                        onClick={() => setIsExpandedCountries(!isExpandedCountries)}
                        type="button"
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-mono text-[#EA580C] dark:text-[#FB923C] hover:underline cursor-pointer"
                      >
                        <span>{isExpandedCountries ? 'Свернуть страны' : `Еще ${availableCountries.length - 8}...`}</span>
                      </button>
                    )}
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
