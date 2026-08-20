import React from 'react';
import { motion } from 'framer-motion';
import { BorderBeam } from 'border-beam';
import { Layers, ShieldCheck, Sparkles, Tv, Globe } from 'lucide-react';
import { CountryFlag } from './CountryFlags';
import type { PresetItem } from '../types';

export const PRESETS: PresetItem[] = [
  {
    id: 'all',
    name: 'Все протоколы',
    desc: 'Полный срез всех серверов и стран',
    icon: 'layers',
    badge: 'ALL POOL',
    services: [],
    country: 'all',
    proto: 'all',
    maxPing: 0,
  },
  {
    id: 'anti-tspu',
    name: 'Анти-ТСПУ (РКН)',
    desc: 'VLESS Reality с белыми SNI и прямым обходом',
    icon: 'shield',
    badge: 'TIER-1 RU',
    services: [],
    country: 'all',
    proto: 'reality',
    maxPing: 120,
  },
  {
    id: 'ai',
    name: 'AI & Нейросети',
    desc: 'ChatGPT, Claude, Gemini & Perplexity',
    icon: 'sparkles',
    badge: 'CLEAN IP',
    services: ['chatgpt', 'claude', 'gemini'],
    country: 'all',
    proto: 'all',
    maxPing: 150,
  },
  {
    id: 'youtube',
    name: 'YouTube 4K & Media',
    desc: 'Hysteria 2 + Reality для 4K 60fps & Discord',
    icon: 'tv',
    badge: 'STREAMING',
    services: ['youtube', 'discord'],
    country: 'all',
    proto: 'all',
    maxPing: 100,
  },
  {
    id: 'de',
    name: 'Германия (DE)',
    desc: 'Frankfurt & Berlin датацентры с низким пингом',
    icon: 'globe',
    badge: 'DE',
    services: [],
    country: 'de',
    proto: 'all',
    maxPing: 80,
  },
  {
    id: 'nl',
    name: 'Нидерланды (NL)',
    desc: 'Amsterdam прямое оптоволокно и чистый трафик',
    icon: 'globe',
    badge: 'NL',
    services: [],
    country: 'nl',
    proto: 'all',
    maxPing: 70,
  },
];

interface PresetSelectorProps {
  activePreset: string;
  onSelectPreset: (preset: PresetItem) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({ activePreset, onSelectPreset }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'layers': return <Layers className="w-4 h-4 text-zinc-200" />;
      case 'shield': return <ShieldCheck className="w-4 h-4 text-zinc-200" />;
      case 'sparkles': return <Sparkles className="w-4 h-4 text-zinc-200" />;
      case 'tv': return <Tv className="w-4 h-4 text-zinc-200" />;
      default: return <Globe className="w-4 h-4 text-zinc-200" />;
    }
  };

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-3.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
          Готовые пресеты
        </span>
        <span className="text-xs text-zinc-400 font-mono">
          1 клик для быстрой настройки
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          const isCountryPreset = preset.id === 'de' || preset.id === 'nl';

          const cardContent = (
            <motion.div
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => onSelectPreset(preset)}
              className={`w-full p-4 rounded-xl cursor-pointer border transition-all duration-150 flex flex-col justify-between ${
                isActive
                  ? 'bg-zinc-800/90 border-white/40 shadow-xl'
                  : 'bg-zinc-900/50 border-white/[0.08] hover:border-white/20 hover:bg-zinc-900/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="p-2 rounded-lg bg-zinc-800 border border-white/10 text-zinc-200">
                  {getIcon(preset.icon)}
                </div>

                {preset.badge && (
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-white text-black font-bold'
                      : 'bg-zinc-800 text-zinc-400 border border-white/[0.08]'
                  }`}>
                    {isCountryPreset && <CountryFlag countryCode={preset.id} className="w-3.5 h-2 rounded-[1px]" />}
                    <span>{preset.badge}</span>
                  </span>
                )}
              </div>

              <div className="mt-3.5">
                <h3 className={`text-sm font-semibold tracking-tight m-0 ${
                  isActive ? 'text-white' : 'text-zinc-200'
                }`}>
                  {preset.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 m-0 leading-relaxed">
                  {preset.desc}
                </p>
              </div>
            </motion.div>
          );

          if (isActive) {
            return (
              <div key={preset.id} className="relative rounded-xl">
                <BorderBeam size="sm" colorVariant="mono">
                  {cardContent}
                </BorderBeam>
              </div>
            );
          }

          return <div key={preset.id}>{cardContent}</div>;
        })}
      </div>
    </section>
  );
};
