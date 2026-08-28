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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Card in MD3 Dialog style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-sm p-6 sm:p-7 rounded-[32px] bg-[#211F26] border border-[#49454F]/50 shadow-2xl flex flex-col items-center text-center select-none"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full bg-[#36343B] text-[#CAC4D0] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-[#4F378B] text-[#D0BCFF] flex items-center justify-center mb-3">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="font-display text-base sm:text-lg font-bold text-[#E6E0E9] m-0">
              Импорт на смартфон
            </h3>
            <p className="font-body text-xs text-[#CAC4D0] mt-1 mb-5">
              Отсканируйте камерой в приложении v2rayNG, Streisand, Happ или Sing-box
            </p>

            {/* QR Code Container */}
            <div className="p-4 rounded-2xl bg-white flex items-center justify-center shadow-md mb-5">
              <QRCodeSVG
                value={subUrl}
                size={210}
                level="M"
                includeMargin={false}
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleCopy}
              type="button"
              className="w-full h-12 px-5 rounded-full bg-[#36343B] hover:bg-[#49454F] text-xs sm:text-sm font-semibold text-[#E6E0E9] flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#7BE08F]" />
                  <span className="text-[#7BE08F]">Ссылка скопирована!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#D0BCFF]" />
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

