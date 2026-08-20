import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MetalFx } from 'metal-fx';
import { ShieldCheck, Zap, Activity } from 'lucide-react';
import type { StatsData } from '../types';

interface HeaderProps {
  stats: StatsData | null;
  totalFilteredNodes: number;
}

// Number Pop-in Counter Component with Blur Animation
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    let start = 0;
    const duration = 1200; // ms
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // easeOutExpo
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
      initial={{ opacity: 0, filter: 'blur(8px)', y: 4 }}
      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="tabular-nums font-mono font-bold"
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
    <header className="w-full max-w-5xl mx-auto pt-8 pb-6 px-4">
      {/* Top Status Banner */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Logo wrapped in MetalFx */}
          <div className="relative p-2 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
            <MetalFx preset="silver" strength={0.2}>
              <Zap className="w-6 h-6 text-green-400" />
            </MetalFx>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2 m-0">
                TurboProbe
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-green-500/10 text-green-400 border border-green-500/30">
                  v7.0 PRO
                </span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 m-0">
              Глобальный агрегатор & Конструктор VPN-подписок
            </p>
          </div>
        </div>

        {/* Live Engine Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs font-mono text-neutral-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span>1000 THREADS ONLINE</span>
        </div>
      </div>

      {/* Metrics Row (Number pop-in with blur) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6">
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            Серверов в базе
          </span>
          <span className="text-xl sm:text-2xl text-white font-bold mt-1">
            <AnimatedNumber value={onlineCount} />
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            Средний пинг
          </span>
          <span className="text-xl sm:text-2xl text-blue-400 font-bold mt-1">
            <AnimatedNumber value={avgPing} suffix=" ms" />
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Сурсов GitHub
          </span>
          <span className="text-xl sm:text-2xl text-amber-400 font-bold mt-1">
            <AnimatedNumber value={sourcesCount} />
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] flex flex-col">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Авто-обновление
          </span>
          <span className="text-xl sm:text-2xl text-neutral-200 font-bold mt-1 font-mono">
            Каждые 6ч
          </span>
        </div>
      </div>
    </header>
  );
};
