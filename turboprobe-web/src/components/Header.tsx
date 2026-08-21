export const Header: React.FC = () => {
  return (
    <header className="w-full max-w-7xl mx-auto pt-3 pb-2 px-4 flex items-center justify-between select-none">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-white/10 transition-transform hover:scale-105">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-black fill-black" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-white m-0 leading-none">
            TurboProbe
          </h1>
          <p className="text-[11px] text-zinc-400 font-mono mt-0.5 m-0 hidden sm:block">
            Суверенный VPN — быстро и без ограничений
          </p>
        </div>
      </div>

      {/* Live Status Badge */}
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-white/10 text-[11px] font-mono text-zinc-300 shadow-inner">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Онлайн база</span>
      </div>
    </header>
  );
};
