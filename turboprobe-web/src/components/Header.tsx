import React from 'react';
import { ShieldCheck, Zap, RefreshCw, Radio } from 'lucide-react';
import { M3ExpressiveShape } from './ui/M3ExpressiveShape';
import { ThemePicker } from './ThemePicker';
import type { ThemePreset } from '../utils/m3Theme';

interface HeaderProps {
  totalConfigs?: number;
  bestPing?: number;
  avgPing?: number;
  updatedAt?: string;
  activeTheme: ThemePreset;
  onSelectTheme: (id: string) => void;
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
  activeTheme,
  onSelectTheme,
}) => {
  const mskTime = formatMskTime(updatedAt);

  return (
    <div className="w-full select-none">
      {/* 1. M3 Expressive Hero Card */}
      <div className="bg-[#1D1B20] border border-[#49454F]/30 rounded-[32px] p-6 sm:p-8 text-center flex flex-col items-center shadow-xl relative overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: activeTheme.accentColor }}
        />

        {/* Top Floating Controls Bar */}
        <div className="w-full flex items-center justify-between gap-2 mb-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#2B2930] text-[#E6E0E9] border border-[#49454F]/30 text-xs font-mono font-medium shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#7BE08F] animate-pulse" />
            <span className="tracking-tight">RADAR ACTIVE • 6H SYNC</span>
          </div>

          <ThemePicker activePreset={activeTheme} onSelectPreset={onSelectTheme} />
        </div>

        {/* M3 Expressive Morphing Logo Badge */}
        <div className="relative mb-3 flex items-center justify-center">
          <div style={{ color: activeTheme.accentColor }}>
            <M3ExpressiveShape shape="cookie" className="w-20 h-20 text-[#4F378B]/60" rotateSlow={true}>
              <div className="w-12 h-12 rounded-full bg-[#4F378B] flex items-center justify-center shadow-inner border border-white/10">
                <Radio className="w-6 h-6 text-[#D0BCFF]" />
              </div>
            </M3ExpressiveShape>
          </div>
        </div>

        {/* Main Display Title in Unbounded font */}
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter text-[#E6E0E9] m-0">
          TurboProbe <span className="font-light text-[#D0BCFF]">Hub</span>
        </h1>

        {/* Subtitle in Onest font */}
        <p className="font-body text-xs sm:text-sm md:text-base text-[#CAC4D0] mt-2 mb-6 max-w-lg leading-relaxed font-normal">
          Суверенный генератор проверенных подписок VLESS Reality и Trojan с обходом ТСПУ
        </p>

        {/* 3 M3 Tonal Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
          {/* Stat 1: Total Configs */}
          <div className="bg-[#2B2930] border border-[#49454F]/25 text-[#EADDFF] p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs">
            <div className="flex items-center gap-1.5 opacity-80 text-[11px] font-display font-semibold uppercase tracking-wider text-[#CAC4D0]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D0BCFF]" />
              <span>Серверы онлайн</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {totalConfigs > 0 ? (
                totalConfigs.toLocaleString('ru-RU')
              ) : (
                <span className="inline-block w-12 h-7 bg-white/20 rounded animate-pulse" />
              )}
            </div>
          </div>

          {/* Stat 2: Best Ping */}
          <div className="bg-[#2B2930] border border-[#49454F]/25 text-[#E8DEF8] p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs">
            <div className="flex items-center gap-1.5 opacity-80 text-[11px] font-display font-semibold uppercase tracking-wider text-[#CAC4D0]">
              <Zap className="w-3.5 h-3.5 text-[#7BE08F]" />
              <span>Лучший пинг</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {bestPing > 0 ? (
                <>
                  {bestPing} <span className="text-xs font-normal opacity-80">ms</span>
                </>
              ) : (
                <span className="inline-block w-12 h-7 bg-white/20 rounded animate-pulse" />
              )}
            </div>
          </div>

          {/* Stat 3: Auto Refresh / Time */}
          <div className="bg-[#2B2930] border border-[#49454F]/25 text-[#FFD8E4] p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs">
            <div className="flex items-center gap-1.5 opacity-80 text-[11px] font-display font-semibold uppercase tracking-wider text-[#CAC4D0]">
              <RefreshCw className="w-3.5 h-3.5 text-[#D0BCFF]" />
              <span>Синхронизация</span>
            </div>
            <div className="font-mono text-xs sm:text-sm font-semibold tracking-tight text-white truncate w-full text-right sm:text-left mt-1">
              {updatedAt ? mskTime : <span className="inline-block w-24 h-4 bg-white/20 rounded animate-pulse" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
