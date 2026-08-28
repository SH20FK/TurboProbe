import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useToast } from './M3Toast';

export type TransitionVariant = 'circle' | 'square' | 'diamond' | 'star';

interface AnimatedThemeToggleProps {
  className?: string;
  variant?: TransitionVariant;
  duration?: number;
}

export const AnimatedThemeToggle: React.FC<AnimatedThemeToggleProps> = ({
  className = '',
  variant = 'circle',
  duration = 450,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('turboprobe_theme');
      if (saved) return saved === 'dark';
      return true;
    } catch {
      return true;
    }
  });

  const toast = useToast();

  const getClipPath = (
    shape: TransitionVariant,
    x: number,
    y: number,
    maxRadius: number,
    progress: 'start' | 'end'
  ): string => {
    const r = progress === 'start' ? 0 : maxRadius;

    switch (shape) {
      case 'circle':
        return `circle(${r}px at ${x}px ${y}px)`;
      case 'square': {
        const top = Math.max(0, y - r);
        const bottom = Math.max(0, window.innerHeight - (y + r));
        const left = Math.max(0, x - r);
        const right = Math.max(0, window.innerWidth - (x + r));
        return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
      }
      case 'diamond':
        if (progress === 'start') {
          return `polygon(${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px)`;
        }
        return `polygon(${x}px ${y - r}px, ${x + r}px ${y}px, ${x}px ${y + r}px, ${x - r}px ${y}px)`;
      case 'star':
        if (progress === 'start') {
          return `polygon(${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px)`;
        }
        return `polygon(
          ${x}px ${y - r}px,
          ${x + r * 0.3}px ${y - r * 0.3}px,
          ${x + r}px ${y - r * 0.3}px,
          ${x + r * 0.45}px ${y + r * 0.2}px,
          ${x + r * 0.7}px ${y + r}px,
          ${x}px ${y + r * 0.5}px,
          ${x - r * 0.7}px ${y + r}px,
          ${x - r * 0.45}px ${y + r * 0.2}px,
          ${x - r}px ${y - r * 0.3}px,
          ${x - r * 0.3}px ${y - r * 0.3}px
        )`;
      default:
        return `circle(${r}px at ${x}px ${y}px)`;
    }
  };

  const updateThemeDOM = useCallback((nextDark: boolean) => {
    setIsDark(nextDark);
    try {
      localStorage.setItem('turboprobe_theme', nextDark ? 'dark' : 'light');
    } catch {
      // ignore
    }

    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      toast.info('Темная тема', 'Включен ночной режим');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      toast.info('Светлая тема', 'Включен дневной режим');
    }
  }, [toast]);

  const toggleTheme = useCallback(async () => {
    const nextDark = !isDark;

    // Fallback for browsers that do not support View Transitions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof document === 'undefined' || !('startViewTransition' in document) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateThemeDOM(nextDark);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const startClip = getClipPath(variant, x, y, maxRadius, 'start');
    const endClip = getClipPath(variant, x, y, maxRadius, 'end');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transition = (document as any).startViewTransition(() => {
      updateThemeDOM(nextDark);
    });

    try {
      await transition.ready;

      document.documentElement.animate(
        {
          clipPath: [startClip, endClip],
        },
        {
          duration,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    } catch {
      // ignore
    }
  }, [isDark, updateThemeDOM, variant, duration]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('turboprobe_theme');
      const isDarkMode = saved !== 'light';
      setIsDark(isDarkMode);
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      type="button"
      title={isDark ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
      aria-label="Переключить тему оформления"
      className={`relative w-8 h-8 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center cursor-pointer overflow-hidden transition-colors duration-150 active:scale-95 shadow-xs ${className}`}
    >
      <Sun className="w-4 h-4 text-[#EA580C] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute w-4 h-4 text-[#FB923C] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Сменить тему</span>
    </button>
  );
};
