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

  const toggleTheme = () => {
    const nextDark = !isDark;
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
            className="flex items-center justify-center text-[#38BDF8]"
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
            className="flex items-center justify-center text-[#F59E0B]"
          >
            <Sun className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};
