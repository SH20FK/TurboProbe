import React from 'react';

export const M3Background: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none transition-colors duration-300">
      {/* 1. Precise High-Contrast M3 Engineering Dot-Matrix Canvas */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundImage: `radial-gradient(circle, var(--bg-dot-color) 1.2px, transparent 1.2px)`,
          backgroundSize: '24px 24px',
          maskImage:
            'radial-gradient(ellipse 90% 80% at 50% 35%, black 40%, transparent 95%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 80% at 50% 35%, black 40%, transparent 95%)',
        }}
      />

      {/* 2. Soft Architectural Center Highlight (No AI-slop blurred blobs) */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[450px] pointer-events-none opacity-60 dark:opacity-30 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 20%, var(--primary-accent-bg) 0%, transparent 80%)',
        }}
      />

      {/* 3. Subtle Edge Fade to maintain crisp contrast */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 65%, var(--bg-app) 100%)',
        }}
      />
    </div>
  );
};
