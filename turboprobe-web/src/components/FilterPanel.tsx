import React from 'react';
import { motion } from 'framer-motion';
import { Globe2, Sliders, ShieldCheck, Sparkles } from 'lucide-react';
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

interface FilterPanelProps {
  selectedServices: string[];
  onToggleService: (serviceId: string) => void;
  selectedCountry: string;
  onSelectCountry: (countryCode: string) => void;
  selectedProto: string;
  onSelectProto: (proto: string) => void;
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

const COUNTRIES = [
  { code: 'all', label: 'Все страны' },
  { code: 'de', label: 'Германия' },
  { code: 'nl', label: 'Нидерланды' },
  { code: 'kz', label: 'Казахстан' },
  { code: 'fi', label: 'Финляндия' },
  { code: 'tr', label: 'Турция' },
  { code: 'ru', label: 'Россия (Direct)' },
  { code: 'se', label: 'Швеция' },
  { code: 'us', label: 'США' },
  { code: 'sg', label: 'Сингапур' },
];

const PROTOCOLS = [
  { id: 'all', label: 'Все протоколы' },
  { id: 'reality', label: 'VLESS Reality' },
  { id: 'trojan', label: 'Trojan TLS' },
  { id: 'hy2', label: 'Hysteria 2' },
  { id: 'ss', label: 'Shadowsocks' },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  selectedServices,
  onToggleService,
  selectedCountry,
  onSelectCountry,
  selectedProto,
  onSelectProto,
  maxPing,
  onChangeMaxPing,
  minHealth,
  onChangeMinHealth,
}) => {
  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-4 space-y-4">
      {/* 1. Services Selection with Official SVG Logos */}
      <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zinc-300" />
            1. Выбор сервисов (Официальные шлюзы)
          </span>
          {selectedServices.length > 0 && (
            <span className="text-xs text-zinc-200 font-mono bg-zinc-800 px-2 py-0.5 rounded border border-white/10">
              Выбрано: {selectedServices.length}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
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
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer select-none ${
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

      {/* 2. Country & Protocol Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country */}
        <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08]">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2 mb-3.5">
            <Globe2 className="w-4 h-4 text-zinc-300" />
            2. Локация серверов
          </span>

          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map((c) => {
              const isSelected = selectedCountry === c.code;

              return (
                <motion.button
                  key={c.code}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  onClick={() => onSelectCountry(c.code)}
                  type="button"
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-zinc-100 text-zinc-950 font-bold border-white'
                      : 'bg-zinc-900/80 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <CountryFlag countryCode={c.code} className="w-4 h-2.5 rounded-[1px] shadow-sm flex-shrink-0" />
                  <span>{c.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Protocol */}
        <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur-sm border border-white/[0.08]">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-2 mb-3.5">
            <Sliders className="w-4 h-4 text-zinc-300" />
            3. Протокол шифрования
          </span>

          <div className="flex flex-wrap gap-2">
            {PROTOCOLS.map((p) => {
              const isSelected = selectedProto === p.id;

              return (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  onClick={() => onSelectProto(p.id)}
                  type="button"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-zinc-100 text-zinc-950 font-bold border-white'
                      : 'bg-zinc-900/80 border-white/[0.08] text-zinc-300 hover:border-white/20 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {p.label}
                </motion.button>
              );
            })}
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
