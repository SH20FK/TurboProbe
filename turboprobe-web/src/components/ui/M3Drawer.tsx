import React from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';

interface M3DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const M3Drawer: React.FC<M3DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Bottom Sheet Modal with Drag Down */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="relative w-full max-w-lg bg-[#1D1B20] border-t border-[#49454F]/40 rounded-t-[32px] px-6 pt-3 pb-8 shadow-2xl overflow-y-auto max-h-[85vh] text-[#E6E0E9]"
          >
            {/* Drag Handle */}
            <div className="w-full flex justify-center py-2 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-[#49454F]" />
            </div>

            {title && (
              <h3 className="text-base font-display font-bold text-center text-white mt-1 mb-4">
                {title}
              </h3>
            )}

            <div>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
