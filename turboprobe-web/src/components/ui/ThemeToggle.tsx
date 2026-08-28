import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useToast } from './M3Toast';

interface AnimatedThemeToggleProps {
  className?: string;
}

export const AnimatedThemeToggle: React.FC<AnimatedThemeToggleProps> = ({ className = '' }) => {
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

  const applyThemeClasses = (darkMode: boolean) => {
    try {
      localStorage.setItem('turboprobe_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }

    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      toast.info('Темная тема', 'Включен ночной режим');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      toast.info('Светлая тема', 'Включен дневной режим');
    }
  };

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const nextDark = !isDark;

    // 1. Check for native View Transitions API support (MagicUI Animated Theme Toggler)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (document as any).startViewTransition !== 'function') {
      setIsDark(nextDark);
      applyThemeClasses(nextDark);
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transition = (document as any).startViewTransition(() => {
      setIsDark(nextDark);
      applyThemeClasses(nextDark);
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      document.documentElement.animate(
        {
          clipPath: nextDark ? clipPath : [...clipPath].reverse(),
        },
        {
          duration: 500,
          easing: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)',
          pseudoElement: nextDark
            ? '::view-transition-new(root)'
            : '::view-transition-old(root)',
        }
      );
    });
  };

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
      onClick={toggleTheme}
      type="button"
      title={isDark ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
      aria-label="Переключить тему оформления"
      className={`relative w-8 h-8 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-150 active:scale-95 shadow-xs ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="moon"
            initial={{ scale: 0, rotate: 90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: -90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="flex items-center justify-center text-[#FB923C]"
          >
            <Moon className="w-4 h-4" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ scale: 0, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="flex items-center justify-center text-[#EA580C]"
          >
            <Sun className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};
