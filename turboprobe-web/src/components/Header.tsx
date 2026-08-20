import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full max-w-5xl mx-auto pt-10 pb-4 px-4 flex flex-col items-center justify-center text-center select-none">
      {/* 1. White Squircle Logo with Shield */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[22px] bg-white flex items-center justify-center shadow-2xl shadow-white/15 mb-4 transition-transform hover:scale-105">
        <svg className="w-8 h-8 sm:w-10 sm:h-10 text-black fill-black" viewBox="0 0 24 24">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
        </svg>
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
