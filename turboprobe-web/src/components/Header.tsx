import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full max-w-5xl mx-auto pt-10 pb-4 px-4 flex flex-col items-center justify-center text-center select-none">
      {/* 1. Neon Green Lightning Logo */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[22px] overflow-hidden shadow-2xl shadow-emerald-500/20 mb-4 transition-transform hover:scale-105 border border-white/10 flex items-center justify-center bg-[#10121a]">
        <img
          src="logo.png"
          alt="TurboProbe Logo"
          className="w-full h-full object-cover"
        />
      </div>

      {/* 2. Brand Title */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white m-0">
        TurboProbe
      </h1>

      {/* 3. Clean Subtitle */}
      <p className="text-xs sm:text-sm md:text-base text-zinc-400 font-normal mt-2.5 max-w-md leading-relaxed m-0">
        Бесплатный VPN — быстро, без регистрации и ограничений
      </p>
    </header>
  );
};
