import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, Copy, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'copy';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (title: string, desc?: string) => void;
    error: (title: string, desc?: string) => void;
    info: (title: string, desc?: string) => void;
    copy: (text: string, title?: string) => Promise<void>;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ title, description, type = 'info', duration = 3000 }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, title, description, type, duration };

      setToasts((prev) => [newToast, ...prev].slice(0, 4));

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
    },
    [removeToast]
  );

  const toastMethods = {
    success: (title: string, desc?: string) => addToast({ title, description: desc, type: 'success' }),
    error: (title: string, desc?: string) => addToast({ title, description: desc, type: 'error' }),
    info: (title: string, desc?: string) => addToast({ title, description: desc, type: 'info' }),
    copy: async (text: string, title = 'Скопировано в буфер') => {
      try {
        await navigator.clipboard.writeText(text);
        addToast({
          title,
          description: text.length > 42 ? `${text.slice(0, 42)}...` : text,
          type: 'copy',
        });
      } catch {
        addToast({ title: 'Ошибка копирования', type: 'error' });
      }
    },
  };

  const getIcon = (type?: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4.5 h-4.5 text-[#7BE08F] flex-shrink-0" />;
      case 'copy':
        return <Copy className="w-4.5 h-4.5 text-[#D0BCFF] flex-shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4.5 h-4.5 text-[#FF897D] flex-shrink-0" />;
      default:
        return <Info className="w-4.5 h-4.5 text-[#38BDF8] flex-shrink-0" />;
    }
  };

  return (
    <ToastContext.Provider value={{ toast: toastMethods }}>
      {children}

      {/* Sonner-style 3D Stacking Container */}
      <div
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end pointer-events-none select-none max-w-sm w-[calc(100vw-2.5rem)]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative w-full min-h-14">
          <AnimatePresence mode="popLayout">
            {toasts.map((item, index) => {
              const yOffset = isHovered ? -(index * 64) : -(index * 10);
              const scale = isHovered ? 1 : 1 - index * 0.04;
              const opacity = isHovered ? 1 : 1 - index * 0.2;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 25, scale: 0.9 }}
                  animate={{
                    opacity,
                    y: yOffset,
                    scale,
                    zIndex: 50 - index,
                  }}
                  exit={{ opacity: 0, scale: 0.85, y: 10, transition: { duration: 0.18 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  className="absolute bottom-0 right-0 w-full pointer-events-auto rounded-2xl border border-[#49454F]/40 bg-[#2B2930]/95 backdrop-blur-md p-3.5 shadow-2xl text-[#E6E0E9]"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getIcon(item.type)}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-semibold leading-tight font-display text-white">
                        {item.title}
                      </h4>
                      {item.description && (
                        <p className="mt-0.5 text-[11px] text-[#CAC4D0] font-mono truncate">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeToast(item.id)}
                      className="text-[#CAC4D0] hover:text-white p-1 -mr-1 -mt-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context.toast;
};
