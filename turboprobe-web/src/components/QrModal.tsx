import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Smartphone } from 'lucide-react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  subUrl: string;
}

export const QrModal: React.FC<QrModalProps> = ({ isOpen, onClose, subUrl }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(subUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore copy failure
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Card with Scale Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-sm p-6 rounded-2xl bg-[#121212] border border-white/15 shadow-2xl flex flex-col items-center text-center"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/[0.05] text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-3 rounded-full bg-green-500/10 text-green-400 mb-3">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white m-0">
              Импорт на смартфон
            </h3>
            <p className="text-xs text-neutral-400 mt-1 mb-5">
              Отсканируйте камерой приложения v2rayNG, Streisand, Happ или Sing-box
            </p>

            {/* QR Code Container */}
            <div className="p-4 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-black/50 mb-5">
              <QRCodeSVG
                value={subUrl}
                size={220}
                level="M"
                includeMargin={false}
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              type="button"
              className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span>Ссылка скопирована!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-neutral-300" />
                  <span>Скопировать URL</span>
                </>
              )}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
