import React, { useState } from 'react';

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

export const M3Ripple: React.FC<{ color?: string }> = ({ color = 'currentColor' }) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const addRipple = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const newRipple: Ripple = { x, y, size, id: Date.now() + Math.random() };
    setRipples((prev) => [...prev, newRipple]);
  };

  const removeRipple = (id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-auto rounded-[inherit] select-none"
      onMouseDown={addRipple}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          onAnimationEnd={() => removeRipple(ripple.id)}
          style={{
            top: ripple.y,
            left: ripple.x,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color,
          }}
          className="absolute rounded-full pointer-events-none opacity-15 animate-m3-ripple"
        />
      ))}
    </div>
  );
};
