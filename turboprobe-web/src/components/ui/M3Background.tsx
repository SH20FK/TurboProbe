import React from 'react';

export const M3Background: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, var(--bg-dot-color) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 90% 80% at 50% 35%, black 40%, transparent 95%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 35%, black 40%, transparent 95%)',
        }}
      />
    </div>
  );
};
