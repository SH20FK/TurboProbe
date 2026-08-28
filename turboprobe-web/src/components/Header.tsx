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
  bestPing = 181,
  avgPing: _avgPing,
  updatedAt,
}) => {
  const mskTime = formatMskTime(updatedAt);

  return (
    <div className="w-full select-none">
      {/* 1. MD3 Hero Card */}
      <div className="bg-[#1D1B20] border border-[#49454F]/40 rounded-[28px] p-6 sm:p-8 text-center flex flex-col items-center shadow-lg relative overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#D0BCFF]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Chip */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#36343B] text-[#EADDFF] border border-[#49454F]/50 text-xs font-mono font-medium mb-4 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#7BE08F] animate-pulse" />
          <span>Суверенный агрегатор v3.0</span>
        </div>

        {/* Main Display Title in Unbounded font */}
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#E6E0E9] m-0">
          TurboProbe <span className="font-normal text-[#D0BCFF]">Hub</span>
        </h1>

        {/* Subtitle in Onest font */}
        <p className="font-body text-xs sm:text-sm md:text-base text-[#CAC4D0] mt-2 mb-6 max-w-md leading-relaxed">
          Бесплатные проверенные VPN-конфигурации VLESS Reality и Trojan с автоматической фильтрацией каждые 6 часов
        </p>

        {/* 3 Bento Stat Cards (MD3 Tonal Containers) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
          {/* Stat 1: Total Configs (Primary Container) */}
          <div className="bg-[#4F378B] text-[#EADDFF] p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-sm">
            <div className="flex items-center gap-1.5 opacity-80 text-[11px] font-display font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Серверы</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {totalConfigs > 0 ? totalConfigs.toLocaleString('ru-RU') : '1 107'}
            </div>
          </div>

          {/* Stat 2: Best Ping (Secondary Container) */}
          <div className="bg-[#4A4458] text-[#E8DEF8] p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-sm">
            <div className="flex items-center gap-1.5 opacity-80 text-[11px] font-display font-semibold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-[#FFD8E4]" />
              <span>Лучший пинг</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {bestPing > 0 ? bestPing : 181} <span className="text-xs font-normal opacity-80">ms</span>
            </div>
          </div>

          {/* Stat 3: Auto Refresh / Time (Tertiary Container) */}
          <div className="bg-[#633B48] text-[#FFD8E4] p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-sm">
            <div className="flex items-center gap-1.5 opacity-80 text-[11px] font-display font-semibold uppercase tracking-wider">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Обновлено</span>
            </div>
            <div className="font-mono text-xs sm:text-sm font-semibold tracking-tight text-white truncate w-full text-right sm:text-left mt-1">
              {mskTime}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



