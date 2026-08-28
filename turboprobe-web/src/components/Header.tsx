import React from 'react';
import { ShieldCheck, Zap, RefreshCw } from 'lucide-react';
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
      {/* Bento Header Banner with Glassmorphism and Ambient Glow */}
      <div className="relative rounded-3xl bg-[#18161E]/80 backdrop-blur-2xl border border-white/[0.08] p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Soft Radial Ambient Lighting based on Theme */}
        <div
          className="absolute -top-32 -left-20 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: activeTheme.accentColor }}
        />
        <div
          className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-15"
          style={{ backgroundColor: '#10B981' }}
        />

        {/* Top Control Chips Row */}
        <div className="relative z-10 flex items-center justify-between gap-3 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-mono text-[#E6E0E9]">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="font-medium tracking-tight">RADAR ACTIVE • 6H SYNC</span>
          </div>

          <ThemePicker activePreset={activeTheme} onSelectPreset={onSelectTheme} />
        </div>

        {/* Center Hero: Real Brand Logo + Typography */}
        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Authentic Logo Icon with Squircle Frame and Glow */}
          <div className="relative mb-4 group cursor-pointer">
            <div
              className="absolute -inset-2 rounded-3xl blur-md opacity-40 group-hover:opacity-75 transition-opacity"
              style={{ backgroundColor: activeTheme.accentColor }}
            />
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-[#0D0C12] border border-white/15 p-2.5 shadow-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <img
                src="./logo.svg"
                alt="TurboProbe"
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            </div>
          </div>

          {/* Title in Crisp Unbounded Display */}
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white m-0">
            TurboProbe <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#D0BCFF] to-[#A78BFA] font-light">Hub</span>
          </h1>

          {/* Description in Clean Onest */}
          <p className="font-body text-xs sm:text-sm md:text-base text-[#94A3B8] mt-2 mb-6 max-w-xl leading-relaxed">
            Суверенный генератор проверенных подписок <span className="text-[#E2E8F0] font-medium">VLESS Reality, Trojan и Hysteria 2</span> с прямым обходом ТСПУ
          </p>

          {/* Inline Bento Metric Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-2xl">
            {/* 1. Online Nodes */}
            <div className="px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 transition-colors">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Серверы онлайн</span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-white">
                {totalConfigs > 0 ? (
                  totalConfigs.toLocaleString('ru-RU')
                ) : (
                  <span className="inline-block w-12 h-6 bg-white/10 rounded animate-pulse" />
                )}
              </div>
            </div>

            {/* 2. Best Ping */}
            <div className="px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 transition-colors">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                <Zap className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Лучший пинг</span>
              </div>
              <div className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-white">
                {bestPing > 0 ? (
                  <>
                    {bestPing} <span className="text-xs font-normal text-[#94A3B8]">ms</span>
                  </>
                ) : (
                  <span className="inline-block w-12 h-6 bg-white/10 rounded animate-pulse" />
                )}
              </div>
            </div>

            {/* 3. Sync Time */}
            <div className="px-4 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 transition-colors">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                <RefreshCw className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Синхронизация</span>
              </div>
              <div className="font-mono text-xs sm:text-sm font-semibold tracking-tight text-white truncate w-full text-right sm:text-left mt-0.5">
                {updatedAt ? mskTime : <span className="inline-block w-20 h-4 bg-white/10 rounded animate-pulse" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
