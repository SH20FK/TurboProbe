import React from 'react';
import { motion } from 'framer-motion';
import { BorderBeam } from 'border-beam';
import { Sparkles, ShieldAlert, Bot, Tv, Globe } from 'lucide-react';
import type { PresetItem } from '../types';

export const PRESETS: PresetItem[] = [
  {
    id: 'all',
    name: 'Всё сразу',
    desc: 'Все протоколы & страны без ограничений',
    icon: 'sparkles',
    badge: 'ALL',
    services: [],
    country: 'all',
    proto: 'all',
    maxPing: 0,
  },
  {
    id: 'anti-tspu',
    name: 'Анти-ТСПУ',
    desc: 'Белые SNI (VK, Гос) + Reality обход РКН',
    icon: 'shield',
    badge: 'RU TIER-1',
    services: [],
    country: 'all',
    proto: 'reality',
    maxPing: 120,
  },
  {
    id: 'ai',
    name: 'Нейросети AI',
    desc: 'ChatGPT, Claude, Gemini & Perplexity',
    icon: 'bot',
    badge: 'CLEAN IP',
    services: ['chatgpt', 'claude', 'gemini'],
    country: 'all',
    proto: 'all',
    maxPing: 150,
  },
  {
    id: 'youtube',
    name: 'YouTube 4K',
    desc: 'Hysteria 2 + Reality для 4K 60fps & Discord',
    icon: 'tv',
    badge: 'HIGH SPEED',
    services: ['youtube', 'discord'],
    country: 'all',
    proto: 'all',
    maxPing: 100,
  },
  {
    id: 'de',
    name: 'Германия',
    desc: 'Frankfurt & Berlin датацентры Tier-1',
    icon: 'globe',
    badge: '🇩🇪 DE',
    services: [],
    country: 'de',
    proto: 'all',
    maxPing: 80,
  },
  {
    id: 'nl',
    name: 'Нидерланды',
    desc: 'Amsterdam прямое оптоволокно минимальный пинг',
    icon: 'globe',
    badge: '🇳🇱 NL',
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
      case 'sparkles': return <Sparkles className="w-5 h-5" />;
      case 'shield': return <ShieldAlert className="w-5 h-5 text-green-400" />;
      case 'bot': return <Bot className="w-5 h-5 text-blue-400" />;
      case 'tv': return <Tv className="w-5 h-5 text-red-400" />;
      default: return <Globe className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
          Готовые сценарии (1 клик)
        </span>
        <span className="text-xs text-neutral-500">
          Выбери пресет или настрой фильтры вручную
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;

          const cardContent = (
            <motion.div
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => onSelectPreset(preset)}
              className={`w-full p-4 rounded-xl cursor-pointer border transition-all duration-200 flex flex-col justify-between ${
                isActive
                  ? 'bg-white/[0.07] border-white/30 shadow-lg shadow-black/40'
                  : 'bg-white/[0.02] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="p-2 rounded-lg bg-white/[0.05] border border-white/10 text-white">
                  {getIcon(preset.icon)}
                </div>

                {preset.badge && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-white/[0.05] text-neutral-400 border border-white/[0.08]'
                  }`}>
                    {preset.badge}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <h3 className={`text-sm font-bold tracking-tight m-0 ${
                  isActive ? 'text-white' : 'text-neutral-200'
                }`}>
                  {preset.name}
                </h3>
                <p className="text-xs text-neutral-400 mt-1 m-0 leading-snug">
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
