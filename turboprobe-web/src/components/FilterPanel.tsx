import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles, Tv, MessageSquare, Music, Globe2, Sliders, ShieldCheck } from 'lucide-react';

// Custom clean icons for X / Twitter & GitHub
const TwitterIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

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
  { id: 'chatgpt', name: 'ChatGPT', icon: Bot, color: 'text-green-400' },
  { id: 'claude', name: 'Claude AI', icon: Sparkles, color: 'text-amber-400' },
  { id: 'gemini', name: 'Gemini', icon: Sparkles, color: 'text-blue-400' },
  { id: 'youtube', name: 'YouTube 4K', icon: Tv, color: 'text-red-400' },
  { id: 'discord', name: 'Discord', icon: MessageSquare, color: 'text-indigo-400' },
  { id: 'twitter', name: 'Twitter / X', icon: TwitterIcon, color: 'text-sky-400' },
  { id: 'spotify', name: 'Spotify', icon: Music, color: 'text-green-500' },
  { id: 'github', name: 'GitHub Dev', icon: GithubIcon, color: 'text-neutral-300' },
];

const COUNTRIES = [
  { code: 'all', label: '🌐 Все страны' },
  { code: 'de', label: '🇩🇪 Германия' },
  { code: 'nl', label: '🇳🇱 Нидерланды' },
  { code: 'kz', label: '🇰🇿 Казахстан' },
  { code: 'fi', label: '🇫🇮 Финляндия' },
  { code: 'tr', label: '🇹🇷 Турция' },
  { code: 'ru', label: '🇷🇺 Россия (Direct)' },
  { code: 'se', label: '🇸🇪 Швеция' },
  { code: 'us', label: '🇺🇸 США' },
  { code: 'sg', label: '🇸🇬 Сингапур' },
];

const PROTOCOLS = [
  { id: 'all', label: 'Все протоколы' },
  { id: 'reality', label: '⚡ VLESS Reality' },
  { id: 'trojan', label: '🔒 Trojan' },
  { id: 'hy2', label: '🚀 Hysteria 2' },
  { id: 'ss', label: '🗝️ Shadowsocks' },
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
    <section className="w-full max-w-5xl mx-auto px-4 py-4 space-y-6">
      {/* 1. Services Selection */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
        <div className="flex items-center justify-between mb-3.5">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
            <Bot className="w-4 h-4 text-green-400" />
            1. Выберите нужные сервисы (Мультивыбор)
          </span>
          {selectedServices.length > 0 && (
            <span className="text-xs text-green-400 font-mono font-bold">
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
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'bg-green-500/10 border-green-500/40 text-green-400 shadow-sm shadow-green-500/10'
                    : 'bg-white/[0.03] border-white/[0.08] text-neutral-300 hover:border-white/20 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${srv.color}`} />
                {srv.name}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 2. Country & Protocol Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2 mb-3.5">
            <Globe2 className="w-4 h-4 text-blue-400" />
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 font-bold'
                      : 'bg-white/[0.03] border-white/[0.08] text-neutral-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {c.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Protocol */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2 mb-3.5">
            <Sliders className="w-4 h-4 text-amber-400" />
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer select-none ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 font-bold'
                      : 'bg-white/[0.03] border-white/[0.08] text-neutral-300 hover:border-white/20 hover:text-white'
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
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Максимальный пинг
            </span>
            <span className="text-xs font-mono font-bold text-green-400 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20">
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
            className="w-full accent-green-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-neutral-500 font-mono mt-1">
            <span>Любой</span>
            <span>100 ms</span>
            <span>200 ms</span>
            <span>350 ms</span>
          </div>
        </div>

        {/* Health Score Slider */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Надежность (Health Score)
            </span>
            <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
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
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-neutral-500 font-mono mt-1">
            <span>Все ноды</span>
            <span>50%+</span>
            <span>75%+</span>
            <span>90%+ VIP</span>
          </div>
        </div>
      </div>
    </section>
  );
};
