import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, RefreshCw } from 'lucide-react';

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
      {/* Clean Dark Hero Card with Micro-Interactions */}
      <div className="relative rounded-3xl bg-[#1D1B20] border border-[#49454F]/30 p-6 sm:p-8 shadow-xl overflow-hidden flex flex-col items-center text-center">
        {/* Top Status Badge with Live Double-Pulse Radar */}
        <div className="w-full flex items-center justify-between mb-5">
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#2B2930] text-[#CAC4D0] border border-[#49454F]/30 text-xs font-mono shadow-xs cursor-default"
          >
            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7BE08F] opacity-75 duration-1000" />
              <span className="animate-pulse absolute inline-flex h-4 w-4 rounded-full bg-[#7BE08F]/20" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7BE08F] shadow-[0_0_8px_#7BE08F]" />
            </div>
            <span className="font-semibold tracking-tight">RADAR ACTIVE • 6H SYNC</span>
          </motion.div>

          <div className="text-xs font-mono text-[#938F99] px-2.5 py-1 rounded-full bg-[#2B2930]/60 border border-[#49454F]/20">
            v2.4.0
          </div>
        </div>

        {/* Brand Logo with Tactile Micro-Hover */}
        <motion.div
          whileHover={{ scale: 1.08, rotate: 3 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="relative mb-4 cursor-pointer"
        >
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white p-2.5 shadow-xl flex items-center justify-center border border-white/20">
            <img
              src="./logo.svg"
              alt="TurboProbe"
              className="w-full h-full object-contain"
            />
          </div>
        </motion.div>

        {/* Title */}
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#E6E0E9] m-0">
          TurboProbe <span className="text-white/60 font-light">Hub</span>
        </h1>

        {/* Subtitle */}
        <p className="font-body text-xs sm:text-sm md:text-base text-[#CAC4D0] mt-2.5 mb-6 max-w-lg leading-relaxed font-normal">
          Суверенный генератор проверенных подписок <span className="text-white font-medium">VLESS Reality</span> и <span className="text-white font-medium">Trojan</span> с обходом ТСПУ
        </p>

        {/* 3 Perfectly Balanced KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-xl">
          {/* Stat 1: Total Configs */}
          <motion.div
            whileHover={{ y: -2, backgroundColor: '#36343B', borderColor: 'rgba(208,188,255,0.3)' }}
            transition={{ duration: 0.15 }}
            className="bg-[#2B2930] border border-[#49454F]/25 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs cursor-default"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#938F99]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#7BE08F]" />
              <span>Серверы онлайн</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
              {totalConfigs > 0 ? (
                totalConfigs.toLocaleString('ru-RU')
              ) : (
                <span className="inline-block w-12 h-7 bg-white/10 rounded animate-pulse" />
              )}
            </div>
          </motion.div>

          {/* Stat 2: Best Ping */}
          <motion.div
            whileHover={{ y: -2, backgroundColor: '#36343B', borderColor: 'rgba(208,188,255,0.3)' }}
            transition={{ duration: 0.15 }}
            className="bg-[#2B2930] border border-[#49454F]/25 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs cursor-default"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#938F99]">
              <Zap className="w-3.5 h-3.5 text-[#7BE08F]" />
              <span>Лучший пинг</span>
            </div>
            <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
              {bestPing > 0 ? (
                <>
                  {bestPing} <span className="text-xs font-normal text-[#938F99]">ms</span>
                </>
              ) : (
                <span className="inline-block w-12 h-7 bg-white/10 rounded animate-pulse" />
              )}
            </div>
          </motion.div>

          {/* Stat 3: Sync Time */}
          <motion.div
            whileHover={{ y: -2, backgroundColor: '#36343B', borderColor: 'rgba(208,188,255,0.3)' }}
            transition={{ duration: 0.15 }}
            className="bg-[#2B2930] border border-[#49454F]/25 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs cursor-default"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#938F99]">
              <RefreshCw className="w-3.5 h-3.5 text-[#7BE08F]" />
              <span>Синхронизация</span>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-white tabular-nums flex items-baseline gap-1.5">
              {updatedAt ? (
                <>
                  <span>{time}</span>
                  <span className="text-[10px] font-normal text-[#938F99] tracking-normal">{date}</span>
                </>
              ) : (
                <span className="inline-block w-20 h-7 bg-white/10 rounded animate-pulse" />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
