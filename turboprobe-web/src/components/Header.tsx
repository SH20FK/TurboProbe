import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, RefreshCw } from 'lucide-react';
import { M3NumberCounter } from './ui/M3NumberCounter';
import { SparklesText } from './ui/SparklesText';
import { TextAnimate } from './ui/TextAnimate';
import { Tooltip } from './ui/Tooltip';

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
      {/* Clean Dark Hero Bento Card */}
      <div className="relative rounded-[28px] bg-[#1D1B20] border border-[#49454F]/30 p-6 sm:p-8 shadow-xl overflow-hidden flex flex-col items-center text-center">
        {/* Brand Logo with Direct Vector Rendering & Perfect Centering */}
        <motion.div
          whileHover={{ scale: 1.08, rotate: 3 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="relative mb-4 cursor-pointer flex items-center justify-center"
        >
          <img
            src="./logo.svg"
            alt="TurboProbe"
            className="w-16 h-16 sm:w-18 sm:h-18 object-contain drop-shadow-lg"
          />
        </motion.div>

        {/* Title with MagicUI Sparkles */}
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#E6E0E9] m-0 flex items-center justify-center gap-2">
          <span>TurboProbe</span>
          <SparklesText text="Hub" colors={{ first: '#D0BCFF', second: '#7BE08F' }} className="text-[#D0BCFF] font-black" />
        </h1>

        {/* Subtitle with MagicUI TextAnimate */}
        <p className="font-body text-xs sm:text-sm md:text-base text-[#CAC4D0] mt-2.5 mb-6 max-w-lg leading-relaxed font-normal">
          <TextAnimate
            text="Суверенный генератор проверенных подписок VLESS Reality и Trojan с обходом ТСПУ"
            type="blur-in"
            delay={0.1}
            duration={0.015}
          />
        </p>

        {/* 3 Perfectly Balanced KPI Stat Cards with Tooltips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-xl">
          {/* Stat 1: Total Configs */}
          <Tooltip content="Количество онлайн-узлов в базе" className="w-full">
            <motion.div
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="w-full bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/25 hover:border-[#D0BCFF]/40 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs cursor-default"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#938F99]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#7BE08F]" />
                <span>Серверы онлайн</span>
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {totalConfigs > 0 ? (
                  <M3NumberCounter value={totalConfigs} />
                ) : (
                  <span className="inline-block w-12 h-7 bg-white/10 rounded animate-pulse" />
                )}
              </div>
            </motion.div>
          </Tooltip>

          {/* Stat 2: Best Ping */}
          <Tooltip content="Лучший отклик среди серверов" className="w-full">
            <motion.div
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="w-full bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/25 hover:border-[#D0BCFF]/40 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs cursor-default"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#938F99]">
                <Zap className="w-3.5 h-3.5 text-[#7BE08F]" />
                <span>Лучший пинг</span>
              </div>
              <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-baseline gap-1">
                {bestPing > 0 ? (
                  <>
                    <M3NumberCounter value={bestPing} formatThousands={false} />
                    <span className="text-xs font-normal text-[#938F99]">ms</span>
                  </>
                ) : (
                  <span className="inline-block w-12 h-7 bg-white/10 rounded animate-pulse" />
                )}
              </div>
            </motion.div>
          </Tooltip>

          {/* Stat 3: Sync Time */}
          <Tooltip content="Время последней проверки базы" className="w-full">
            <motion.div
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="w-full bg-[#2B2930] hover:bg-[#36343B] border border-[#49454F]/25 hover:border-[#D0BCFF]/40 p-3.5 rounded-2xl flex items-center justify-between sm:flex-col sm:justify-center sm:items-start gap-1 shadow-xs cursor-default"
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
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
