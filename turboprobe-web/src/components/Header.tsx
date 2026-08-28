import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, RefreshCw } from 'lucide-react';
import { M3NumberCounter } from './ui/M3NumberCounter';

interface HeaderProps {
  totalConfigs?: number;
  bestPing?: number;
  avgPing?: number;
  updatedAt?: string;
}

export function formatTimeParts(isoString?: string): { time: string; date: string } {
  try {
    const d = isoString ? new Date(isoString) : new Date();
    const time = d.toLocaleTimeString('ru-RU', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
    });
    const date = d.toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric',
      month: 'short',
    });
    return { time, date: `${date} · МСК` };
  } catch {
    return { time: '14:00', date: 'Сегодня · МСК' };
  }
}

export const Header: React.FC<HeaderProps> = ({
  totalConfigs = 0,
  bestPing = 0,
  avgPing: _avgPing,
  updatedAt,
}) => {
  const { time, date } = formatTimeParts(updatedAt);

  return (
    <div className="w-full select-none">
      <div className="relative rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] p-6 sm:p-8 shadow-xl overflow-hidden flex flex-col items-center text-center transition-colors duration-200">
        <div className="relative mb-4 flex items-center justify-center">
          <img
            src="./logo.svg"
            alt="TurboProbe"
            className="w-16 h-16 sm:w-18 sm:h-18 object-contain drop-shadow-md"
          />
        </div>

        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[var(--text-main)] m-0 flex items-center justify-center gap-2">
          <span>TurboProbe</span>
          <span className="text-[#C25E30] dark:text-[#E08244] font-black">Hub</span>
        </h1>

        <p className="font-body text-xs sm:text-sm md:text-base text-[var(--text-muted)] mt-2.5 mb-6 max-w-lg leading-relaxed font-normal">
          Генератор проверенных конфигураций <span className="text-[var(--text-main)] font-semibold">VLESS Reality</span> и <span className="text-[var(--text-main)] font-semibold">Trojan</span> с обходом ТСПУ
        </p>

        {/* 3 Balanced KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-xl">
          {/* Stat 1: Total Configs */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="w-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] hover:border-[#C25E30]/40 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs cursor-default transition-colors duration-150"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Серверы онлайн</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-main)]">
              {totalConfigs > 0 ? (
                <M3NumberCounter value={totalConfigs} />
              ) : (
                <span className="inline-block w-12 h-7 bg-current opacity-10 rounded animate-pulse" />
              )}
            </div>
          </motion.div>

          {/* Stat 2: Best Ping */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="w-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] hover:border-[#C25E30]/40 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs cursor-default transition-colors duration-150"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <Zap className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Лучший пинг</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-main)] flex items-baseline gap-1">
              {bestPing > 0 ? (
                <>
                  <M3NumberCounter value={bestPing} formatThousands={false} />
                  <span className="text-xs font-normal text-[var(--text-muted)]">ms</span>
                </>
              ) : (
                <span className="inline-block w-12 h-7 bg-current opacity-10 rounded animate-pulse" />
              )}
            </div>
          </motion.div>

          {/* Stat 3: Sync Time */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="w-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] hover:border-[#C25E30]/40 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs cursor-default transition-colors duration-150"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              <RefreshCw className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Синхронизация</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-main)] tabular-nums flex items-baseline gap-1.5">
              {updatedAt ? (
                <>
                  <span>{time}</span>
                  <span className="text-[10px] font-normal text-[var(--text-muted)] tracking-normal">{date}</span>
                </>
              ) : (
                <span className="inline-block w-20 h-7 bg-current opacity-10 rounded animate-pulse" />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
