import React from 'react';
import { MetalFx } from 'metal-fx';
import { Radio } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full max-w-5xl mx-auto pt-8 pb-3 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center">
          <MetalFx preset="silver" strength={0.25}>
            <Radio className="w-5 h-5 text-zinc-100" />
          </MetalFx>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 m-0">
          TurboProbe
        </h1>
      </div>
    </header>
  );
};
