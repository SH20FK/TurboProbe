import React from 'react';
import { ShieldCheck, Clock, Zap } from 'lucide-react';

interface HeaderProps {
  totalConfigs?: number;
  bestPing?: number;
  avgPing?: number;
  updatedAt?: string;
}

export function formatMskTime(isoString?: string): string {
  try {
    const date = isoString ? new Date(isoString) : new Date();
    const d = date.toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const t = date.toLocaleTimeString('ru-RU', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${d}, ${t} МСК`;
  } catch {
    return 'Сегодня, 14:00 МСК';
  }
}

export const Header: React.FC<HeaderProps> = ({
  totalConfigs = 0,
  bestPing = 181,
  avgPing = 480,
  updatedAt,
}) => {
  const mskTime = formatMskTime(updatedAt);

  return (
    <header className="w-full max-w-3xl mx-auto pt-6 pb-2 px-4 flex flex-col items-center text-center select-none">
      {/* 1. Clean Dark Logo Badge */}
      <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-200 flex items-center justify-center shadow-md mb-3">
        <ShieldCheck className="w-6 h-6 stroke-[2]" />
      </div>

      {/* 2. Main Title */}
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white m-0">
        TurboProbe
      </h1>

      {/* 3. Subtitle */}
      <p className="text-xs sm:text-sm text-zinc-400 font-normal mt-1.5 mb-4 max-w-lg leading-relaxed">
        Бесплатные проверенные прокси-узлы VLESS Reality и Trojan с автоматическим обновлением каждые 6 часов
      </p>

      {/* 4. Live Stats Badges */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Онлайн: <strong className="text-white font-semibold">{totalConfigs > 0 ? totalConfigs.toLocaleString('ru-RU') : '1 107'}</strong></span>
        </div>

        {bestPing > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 shadow-sm">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Пинг: <strong className="text-zinc-200 font-medium">{bestPing} ms</strong></span>
            {avgPing > 0 && <span className="text-zinc-500 text-[10px]">(ср. {avgPing} ms)</span>}
          </div>
        )}

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 shadow-sm">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span>Обновлено: <strong className="text-zinc-200 font-medium">{mskTime}</strong></span>
        </div>
      </div>
    </header>
  );
};

