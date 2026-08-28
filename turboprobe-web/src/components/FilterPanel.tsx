import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  ChevronDown,
  Shield,
  Sparkles,
  Tv,
  Layers,
  Globe,
  Gauge,
  RotateCcw,
} from 'lucide-react';
import { M3SegmentedButton, type SegmentOption } from './ui/M3SegmentedButton';
import { M3FilterChip } from './ui/M3FilterChip';
import { M3PingSlider } from './ui/M3PingSlider';
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
  maxPing?: number;
  onChangeMaxPing?: (val: number) => void;
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
    maxPing: 0,
  },
  {
    id: 'ai',
    name: 'AI Core',
    desc: 'ChatGPT / Claude',
    icon: 'sparkles',
    country: 'us',
    proto: 'all',
    services: ['chatgpt', 'claude', 'gemini'],
    maxPing: 0,
  },
  {
    id: 'youtube',
    name: 'YouTube 4K',
    desc: 'Без буфера',
    icon: 'tv',
    country: 'all',
    proto: 'all',
    services: ['youtube'],
    maxPing: 0,
  },
  {
    id: 'all',
    name: 'Все узлы',
    desc: 'Мин. пинг',
    icon: 'layers',
    country: 'all',
    proto: 'all',
    services: [],
    maxPing: 0,
  },
];

const KNOWN_COUNTRIES: Record<string, string> = {
  de: 'Германия',
  nl: 'Нидерланды',
  fi: 'Финляндия',
  us: 'США',
  pl: 'Польша',
  se: 'Швеция',
  gb: 'Великобритания',
  fr: 'Франция',
  at: 'Австрия',
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
  cz: 'Чехия',
};

const ORDERED_COUNTRY_KEYS = [
  'de', 'nl', 'fi', 'us', 'pl', 'se', 'gb', 'fr', 'at', 'ch',
  'jp', 'sg', 'kr', 'kz', 'tr', 'in', 'ca', 'ru', 'ee', 'cz'
];

const KNOWN_PROTOCOLS: Record<string, string> = {
  reality: 'VLESS Reality',
  vless: 'VLESS WS/gRPC',
  trojan: 'Trojan',
  hy2: 'Hysteria 2',
  ss: 'Shadowsocks',
};

const ORDERED_PROTO_KEYS = ['reality', 'vless', 'trojan', 'hy2', 'ss'];

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
  maxPing = 0,
  onChangeMaxPing,
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
        icon: <Shield className="w-3.5 h-3.5 text-[#C25E30] dark:text-[#E08244]" />,
      },
      {
        id: 'ai',
        label: 'AI Core',
        desc: 'ChatGPT / Claude',
        icon: <Sparkles className="w-3.5 h-3.5 text-[#C25E30] dark:text-[#E08244]" />,
      },
      {
        id: 'youtube',
        label: 'YouTube 4K',
        desc: 'Без буфера',
        icon: <Tv className="w-3.5 h-3.5 text-[#C25E30] dark:text-[#E08244]" />,
      },
      {
        id: 'all',
        label: 'Все узлы',
        desc: 'Мин. пинг',
        icon: <Layers className="w-3.5 h-3.5 text-[#C25E30] dark:text-[#E08244]" />,
      },
    ];
  }, []);

  const handleSelectSegment = (id: string) => {
    const found = PRESETS.find((p) => p.id === id);
    if (found) {
      onSelectPreset(found);
    }
  };

  // STABLE Canonical Ordering for countries (prevents chips from jumping on count change)
  const availableCountries = useMemo(() => {
    const presentCodes = new Set<string>();
    for (const code of Object.keys(countryCounts)) {
      if ((countryCounts[code] || 0) > 0) presentCodes.add(code);
    }
    for (const code of selectedCountries) {
      presentCodes.add(code);
    }

    const list = Array.from(presentCodes).map((code) => ({
      code,
      label: KNOWN_COUNTRIES[code] || code.toUpperCase(),
      count: countryCounts[code] || 0,
    }));

    return list.sort((a, b) => {
      const idxA = ORDERED_COUNTRY_KEYS.indexOf(a.code);
      const idxB = ORDERED_COUNTRY_KEYS.indexOf(b.code);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.label.localeCompare(b.label, 'ru');
    });
  }, [countryCounts, selectedCountries]);

  // STABLE Ordering for protocols (prevents chips from jumping on count change)
  const availableProtos = useMemo(() => {
    return ORDERED_PROTO_KEYS
      .filter((id) => (protoCounts[id] || 0) > 0 || selectedProtos.includes(id))
      .map((id) => ({
        id,
        label: KNOWN_PROTOCOLS[id] || id.toUpperCase(),
        count: protoCounts[id] || 0,
      }));
  }, [protoCounts, selectedProtos]);

  const displayedCountries = useMemo(() => {
    if (isExpandedCountries) return availableCountries;
    return availableCountries.slice(0, 8);
  }, [availableCountries, isExpandedCountries]);

  const activeFiltersCount =
    selectedServices.length +
    selectedCountries.length +
    selectedProtos.length +
    (maxPing > 0 ? 1 : 0);

  return (
    <div className="space-y-3 w-full">
      {/* 1. M3 Segmented Control (Hero Preset Selector) */}
      <M3SegmentedButton
        options={segmentOptions}
        selectedId={activePreset}
        onSelect={handleSelectSegment}
      />

      {/* 2. Unified Advanced Filter Accordion with Smooth Physics */}
      <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xl overflow-hidden transition-colors duration-200">
        {/* Accordion Toggle Header */}
        <button
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          type="button"
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[var(--bg-card-hover)]/60 transition-colors text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[var(--bg-app)] border border-[var(--border-main)] flex items-center justify-center text-[#C25E30] dark:text-[#E08244]">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <span className="font-display text-xs sm:text-sm font-semibold text-[var(--text-main)]">
                Тонкая настройка
              </span>
              <span className="text-xs text-[var(--text-muted)] ml-2 hidden sm:inline">
                (сервисы, протоколы, страны, пинг)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#C25E30]/15 text-[#C25E30] dark:text-[#E08244] border border-[#C25E30]/30 font-bold">
                Активно: {activeFiltersCount}
              </span>
            )}
            <span className="text-xs text-[var(--text-muted)] font-body hidden sm:inline">
              {isAdvancedOpen ? 'Свернуть' : 'Настроить'}
            </span>
            <motion.div
              animate={{ rotate: isAdvancedOpen ? 180 : 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                  height: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.2 },
                },
              }}
              exit={{
                height: 0,
                opacity: 0,
                transition: {
                  height: { duration: 0.25, ease: [0.3, 0, 0.8, 0.15] },
                  opacity: { duration: 0.15 },
                },
              }}
              className="overflow-hidden border-t border-[var(--border-main)]"
            >
              <div className="p-4 sm:p-6 space-y-6">
                {/* 1. Services Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#C25E30]/10 border border-[#C25E30]/20 flex items-center justify-center text-[#C25E30] dark:text-[#E08244]">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-display text-xs sm:text-sm font-bold text-[var(--text-main)]">
                        Оптимизация под сервисы
                      </span>
                    </div>

                    {selectedServices.length > 0 && (
                      <button
                        onClick={() => {
                          selectedServices.forEach((s) => onToggleService(s));
                        }}
                        type="button"
                        className="px-2.5 py-1 rounded-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[11px] font-medium text-[#C25E30] dark:text-[#E08244] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Сбросить ({selectedServices.length})</span>
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

                {/* 2. Protocols Section */}
                <div className="space-y-2.5 pt-4 border-t border-[var(--border-main)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-center text-[#10B981]">
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-display text-xs sm:text-sm font-bold text-[var(--text-main)]">
                        Протоколы шифрования
                      </span>
                    </div>

                    {selectedProtos.length > 0 && (
                      <button
                        onClick={onClearProtos}
                        type="button"
                        className="px-2.5 py-1 rounded-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[11px] font-medium text-[#C25E30] dark:text-[#E08244] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Все протоколы</span>
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

                {/* 3. Countries Section */}
                <div className="space-y-2.5 pt-4 border-t border-[var(--border-main)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#D97706]/10 border border-[#D97706]/20 flex items-center justify-center text-[#D97706] dark:text-[#FBBF24]">
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-display text-xs sm:text-sm font-bold text-[var(--text-main)]">
                        Геолокации и страны
                      </span>
                    </div>

                    {selectedCountries.length > 0 && (
                      <button
                        onClick={onClearCountries}
                        type="button"
                        className="px-2.5 py-1 rounded-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[11px] font-medium text-[#C25E30] dark:text-[#E08244] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Все страны</span>
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
                      <motion.button
                        onClick={() => setIsExpandedCountries(!isExpandedCountries)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-xs font-semibold font-display text-[#C25E30] dark:text-[#E08244] border border-[var(--border-main)] hover:border-[#C25E30]/40 shadow-xs cursor-pointer select-none transition-colors"
                      >
                        <span>{isExpandedCountries ? 'Свернуть список' : `+ Еще ${availableCountries.length - 8} стран`}</span>
                        <motion.div
                          animate={{ rotate: isExpandedCountries ? 180 : 0 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </motion.div>
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* 4. Ping Threshold Slider Section */}
                <div className="space-y-2.5 pt-4 border-t border-[var(--border-main)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#059669]/10 border border-[#059669]/20 flex items-center justify-center text-[#059669] dark:text-[#34D399]">
                        <Gauge className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-display text-xs sm:text-sm font-bold text-[var(--text-main)]">
                        Порог задержки отклика (Пинг)
                      </span>
                    </div>

                    {maxPing > 0 && (
                      <button
                        onClick={() => onChangeMaxPing?.(0)}
                        type="button"
                        className="px-2.5 py-1 rounded-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[11px] font-medium text-[#C25E30] dark:text-[#E08244] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Без лимита</span>
                      </button>
                    )}
                  </div>

                  <M3PingSlider maxPing={maxPing} onChangeMaxPing={onChangeMaxPing || (() => {})} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
