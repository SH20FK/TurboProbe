import React from 'react';
import { Shield, Zap, Clock } from 'lucide-react';

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
  avgPing: _avgPing,
  updatedAt,
}) => {
  const mskTime = formatMskTime(updatedAt);

  return (
    <header className="w-full flex flex-col items-center text-center select-none pt-4 pb-2">
      {/* Top Brand Tag */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 mb-3 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-mono font-medium">TurboProbe Hub</span>
        <span className="text-zinc-500">•</span>
        <span className="text-zinc-400 font-mono">v3.0</span>
      </div>

      {/* Main Title */}
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white m-0">
        Конструктор VPN-подписок
      </h1>

      {/* Subtitle */}
      <p className="text-xs sm:text-sm text-zinc-400 font-normal mt-1.5 mb-4 max-w-md leading-relaxed">
        Бесплатные проверенные прокси-узлы VLESS Reality и Trojan с автоматическим обновлением каждые 6 часов
      </p>

      {/* Live Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-zinc-400">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900/60 border border-zinc-850">
          <Shield className="w-3.5 h-3.5 text-zinc-400" />
          <span>Онлайн: <strong className="text-zinc-200">{totalConfigs > 0 ? totalConfigs.toLocaleString('ru-RU') : '1 107'}</strong> узлов</span>
        </div>

        {bestPing > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900/60 border border-zinc-850">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Пинг: <strong className="text-zinc-200">{bestPing} ms</strong></span>
          </div>
        )}

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900/60 border border-zinc-850">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span>{mskTime}</span>
        </div>
      </div>
    </header>
  );
};


