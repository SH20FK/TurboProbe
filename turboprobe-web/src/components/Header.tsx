import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MetalFx } from 'metal-fx';
import { ShieldCheck, Activity, Radio } from 'lucide-react';
import type { StatsData } from '../types';

interface HeaderProps {
  stats: StatsData | null;
  totalFilteredNodes: number;
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    let start = 0;
    const duration = 1000;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + (value - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [value, shouldReduceMotion]);

  return (
    <motion.span
      initial={{ opacity: 0, filter: 'blur(6px)', y: 2 }}
      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="tabular-nums font-mono font-semibold"
    >
      {displayValue.toLocaleString('ru-RU')}{suffix}
    </motion.span>
  );
}

export const Header: React.FC<HeaderProps> = ({ stats, totalFilteredNodes }) => {
  const onlineCount = stats?.online_nodes || totalFilteredNodes || 45000;
  const avgPing = stats?.avg_ping_ms || 42;
  const sourcesCount = stats?.sources_crawled || 1696;

  return (
    <header className="w-full max-w-5xl mx-auto pt-10 pb-6 px-4">
      {/* Top Branding Row */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-8 border-b border-white/[0.08]">
        <div className="flex items-center gap-3.5">
          {/* Logo in MetalFx */}
          <div className="relative p-2.5 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-inner">
            <MetalFx preset="silver" strength={0.25}>
              <Radio className="w-5 h-5 text-zinc-100" />
            </MetalFx>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 m-0">
                TurboProbe
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-white/[0.07] text-zinc-300 border border-white/15">
                v7.0 MONOCHROME
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 m-0 mt-0.5">
              Агрегатор и маршрутизатор VPN-подписок
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-white/10 text-xs font-mono text-zinc-300 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span className="tracking-wide">1000 THREADS ENGINE</span>
        </div>
      </div>

      {/* Monochrome Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6">
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/[0.07] flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
            Серверов
          </span>
          <span className="text-xl sm:text-2xl text-zinc-100 font-bold mt-2">
            <AnimatedNumber value={onlineCount} />
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/[0.07] flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-zinc-300" />
            Средний пинг
          </span>
          <span className="text-xl sm:text-2xl text-zinc-100 font-bold mt-2">
            <AnimatedNumber value={avgPing} suffix=" ms" />
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/[0.07] flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-zinc-300" />
            Источников
          </span>
          <span className="text-xl sm:text-2xl text-zinc-100 font-bold mt-2">
            <AnimatedNumber value={sourcesCount} />
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/[0.07] flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Синхронизация
          </span>
          <span className="text-xl sm:text-2xl text-zinc-100 font-bold mt-2 font-mono">
            Каждые 6ч
          </span>
        </div>
      </div>
    </header>
  );
};
