import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useToast } from './M3Toast';

interface AnimatedThemeToggleProps {
  className?: string;
  duration?: number;
}

export const AnimatedThemeToggle: React.FC<AnimatedThemeToggleProps> = ({
  className = '',
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

  const applyThemeDOM = useCallback((nextDark: boolean) => {
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

    // Fallback for browsers without View Transitions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof document === 'undefined' || !('startViewTransition' in document) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyThemeDOM(nextDark);
      return;
    }

    const rect = buttonRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const startClip = `circle(0px at ${x}px ${y}px)`;
    const endClip = `circle(${maxRadius}px at ${x}px ${y}px)`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transition = (document as any).startViewTransition(() => {
      applyThemeDOM(nextDark);
    });

    try {
      await transition.ready;

      document.documentElement.animate(
        {
          clipPath: [startClip, endClip],
        },
        {
          duration,
          easing: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    } catch {
      // ignore
    }
  }, [isDark, applyThemeDOM, duration]);

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
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="moon"
            initial={{ scale: 0, rotate: 90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center justify-center text-[var(--primary-accent)]"
          >
            <Moon className="w-4 h-4" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ scale: 0, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center justify-center text-[var(--primary-accent)]"
          >
            <Sun className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};
