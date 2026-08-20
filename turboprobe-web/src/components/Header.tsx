import React from 'react';
import { Activity, ShieldCheck, Zap } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full max-w-5xl mx-auto pt-8 pb-3 px-4 flex flex-col items-center justify-center text-center select-none">
      {/* 1. Futuristic Cyber-Probe Glowing Badge */}
      <div className="relative flex items-center justify-center mb-3 group cursor-pointer">
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 blur-xl opacity-75 group-hover:opacity-100 transition-all duration-500" />
        
        <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-zinc-900/90 border border-white/15 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-black/80">
          <svg className="w-8 h-8 sm:w-9 sm:h-9 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity="0.85" />
          </svg>
          {/* Live pulsing emerald dot */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-zinc-950"></span>
          </span>
        </div>
      </div>

      {/* 2. Shimmering Gradient Brand Title */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent m-0">
        TurboProbe
      </h1>

      {/* 3. Unique Tagline */}
      <p className="text-xs sm:text-sm text-zinc-400 font-medium mt-2 max-w-lg leading-relaxed m-0">
        Интеллектуальный конструктор VPN-подписок с глубокой верификацией узлов
      </p>

      {/* 4. Live Telemetry Status Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
          <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
          Xray Tunnel Verified
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 border border-white/10 text-[11px] font-mono text-zinc-300">
          <ShieldCheck className="w-3 h-3 text-zinc-400" />
          Анти-ТСПУ Reality & Hy2
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 border border-white/10 text-[11px] font-mono text-zinc-300">
          <Zap className="w-3 h-3 text-zinc-400" />
          Динамическая ссылка на лету
        </span>
      </div>
    </header>
  );
};
