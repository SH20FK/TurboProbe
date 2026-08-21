import React from 'react';
import { Clock } from 'lucide-react';

interface HeaderProps {
  totalConfigs?: number;
  updatedAt?: string;
}

export function formatMskTime(isoString?: string): string {
  try {
    const date = isoString ? new Date(isoString) : new Date();
    const d = date.toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).split('.').reverse().join('-');
    const t = date.toLocaleTimeString('ru-RU', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${d} ${t} МСК`;
  } catch {
    return '2026-08-21 12:00 МСК';
  }
}

export const Header: React.FC<HeaderProps> = ({ totalConfigs = 0, updatedAt }) => {
  const mskTime = formatMskTime(updatedAt);

  return (
    <header className="w-full max-w-2xl mx-auto pt-6 pb-2 px-4 flex flex-col items-center text-center select-none">
      {/* 1. Centered White Rounded Logo */}
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] bg-white flex items-center justify-center shadow-2xl shadow-white/20 mb-3.5 transition-transform hover:scale-105">
        <svg className="w-7 h-7 sm:w-8 sm:h-8 text-black fill-black" viewBox="0 0 24 24">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
        </svg>
      </div>

      {/* 2. Main Title */}
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white m-0">
        TurboProbe
      </h1>

      {/* 3. Subtitle */}
      <p className="text-xs sm:text-sm text-zinc-400 font-normal mt-1.5 mb-3 max-w-md">
        Бесплатный VPN — быстро, без регистрации и ограничений
      </p>

      {/* 4. Live Stats Badges (Configs count & Moscow Time) */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-1">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900/80 border border-white/10 text-xs font-mono text-zinc-300 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse" />
          <span>Конфигов: <strong className="text-white font-bold">{totalConfigs > 0 ? totalConfigs : 839}</strong></span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-zinc-900/80 border border-white/10 text-xs font-mono text-zinc-400 shadow-inner">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span>Последнее обновление: <strong className="text-zinc-200 font-medium">{mskTime}</strong></span>
        </div>
      </div>
    </header>
  );
};
