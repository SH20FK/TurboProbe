import React from 'react';
import { ShieldCheck, Zap, RefreshCw } from 'lucide-react';

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
  bestPing = 0,
  avgPing: _avgPing,
  updatedAt,
}) => {
  const mskTime = formatMskTime(updatedAt);

  return (
    <div className="w-full select-none">
      {/* Clean Dark Hero Card */}
      <div className="relative rounded-3xl bg-[#1D1B20] border border-[#49454F]/30 p-6 sm:p-8 shadow-xl overflow-hidden flex flex-col items-center text-center">
        {/* Top Status Badge */}
        <div className="w-full flex items-center justify-between mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2B2930] text-[#CAC4D0] border border-[#49454F]/30 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="font-medium tracking-tight">RADAR ACTIVE • 6H SYNC</span>
          </div>

          <div className="text-xs font-mono text-[#938F99]">
            v2.4.0
          </div>
        </div>

        {/* Brand Logo */}
        <div className="relative mb-4">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white p-2.5 shadow-lg flex items-center justify-center">
            <img
              src="./logo.svg"
              alt="TurboProbe"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#E6E0E9] m-0">
          TurboProbe <span className="text-white/60 font-light">Hub</span>
        </h1>

        {/* Subtitle */}
        <p className="font-body text-xs sm:text-sm md:text-base text-[#CAC4D0] mt-2.5 mb-6 max-w-lg leading-relaxed font-normal">
          Суверенный генератор проверенных подписок VLESS Reality и Trojan с обходом ТСПУ
        </p>

        {/* 3 Unified Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-xl">
          {/* Stat 1: Total Configs */}
          <div className="bg-[#2B2930] border border-[#49454F]/25 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#938F99]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Серверы онлайн</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {totalConfigs > 0 ? (
                totalConfigs.toLocaleString('ru-RU')
              ) : (
                <span className="inline-block w-12 h-7 bg-white/10 rounded animate-pulse" />
              )}
            </div>
          </div>

          {/* Stat 2: Best Ping */}
          <div className="bg-[#2B2930] border border-[#49454F]/25 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#938F99]">
              <Zap className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Лучший пинг</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {bestPing > 0 ? (
                <>
                  {bestPing} <span className="text-xs font-normal text-[#938F99]">ms</span>
                </>
              ) : (
                <span className="inline-block w-12 h-7 bg-white/10 rounded animate-pulse" />
              )}
            </div>
          </div>

          {/* Stat 3: Sync Time */}
          <div className="bg-[#2B2930] border border-[#49454F]/25 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#938F99]">
              <RefreshCw className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Синхронизация</span>
            </div>
            <div className="font-mono text-xs sm:text-sm font-semibold tracking-tight text-white truncate w-full text-right sm:text-left mt-1">
              {updatedAt ? mskTime : <span className="inline-block w-20 h-5 bg-white/10 rounded animate-pulse" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
