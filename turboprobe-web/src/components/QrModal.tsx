import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCodeStyling from 'qr-code-styling';
import { X, Copy, Check, Smartphone, Download } from 'lucide-react';
import { TelegramIcon } from './ServiceIcons';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  subUrl: string;
}

// Telegram Blue Badge Data URI
const TG_LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#2481CC"/>
    <path fill="#FFFFFF" d="M22 49l48-20c2.2-1 4.5.6 3.7 3l-8.2 38.6c-.6 2.7-2.2 3.4-4.5 2.1l-12.5-9.2-6 5.8c-.7.7-1.2 1.2-2.5 1.2l.9-12.7 23.1-20.9c1-.9-.2-1.4-1.5-.5l-28.6 18-12.3-3.8c-2.7-.8-2.7-2.7.6-4z"/>
  </svg>`
)}`;

// TurboProbe Terracotta Badge Data URI
const VPN_LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#C25E30"/>
    <path fill="#FFFFFF" d="M50 22l24 9v21c0 15.5-10.2 29.5-24 33-13.8-3.5-24-17.5-24-33V31l24-9zm0 8.5L32 36.8v15.2c0 11.2 7.7 21.6 18 24.5 10.3-2.9 18-13.3 18-24.5V36.8L50 30.5z"/>
  </svg>`
)}`;

export const QrModal: React.FC<QrModalProps> = ({ isOpen, onClose, subUrl }) => {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCodeInstance = useRef<QRCodeStyling | null>(null);

  const isTg =
    subUrl.startsWith('tg://') ||
    subUrl.includes('tg/proxies') ||
    (typeof window !== 'undefined' && window.location.hash === '#tg');

  useEffect(() => {
    if (!isOpen || !subUrl) return;

    const qr = new QRCodeStyling({
      width: 240,
      height: 240,
      type: 'canvas',
      data: subUrl,
      image: isTg ? TG_LOGO_DATA_URI : VPN_LOGO_DATA_URI,
      margin: 4,
      qrOptions: {
        typeNumber: 0,
        mode: 'Byte',
        errorCorrectionLevel: 'Q',
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.32,
        margin: 6,
        crossOrigin: 'anonymous',
      },
      dotsOptions: {
        type: 'extra-rounded',
        gradient: {
          type: 'linear',
          rotation: 45,
          colorStops: isTg
            ? [
                { offset: 0, color: '#2AABEE' },
                { offset: 0.45, color: '#2481CC' },
                { offset: 1, color: '#9D65E8' },
              ]
            : [
                { offset: 0, color: '#F97316' },
                { offset: 0.5, color: '#C25E30' },
                { offset: 1, color: '#E11D48' },
              ],
        },
      },
      backgroundOptions: {
        color: '#FFFFFF',
      },
      cornersSquareOptions: {
        type: 'extra-rounded',
        color: isTg ? '#2481CC' : '#C25E30',
      },
      cornersDotOptions: {
        type: 'dot',
        color: isTg ? '#2AABEE' : '#E08244',
      },
    });

    qrCodeInstance.current = qr;

    if (qrRef.current) {
      qrRef.current.innerHTML = '';
      qr.append(qrRef.current);
    }
  }, [isOpen, subUrl, isTg]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(subUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownloadQr = () => {
    if (qrCodeInstance.current) {
      qrCodeInstance.current.download({
        name: isTg ? 'tgproxy-qr' : 'turboprobe-qr',
        extension: 'png',
      });
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
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Modal Card Styled like Telegram / Material Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full max-w-sm p-6 sm:p-7 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-2xl flex flex-col items-center text-center select-none ${
              isTg ? 'theme-tg' : ''
            }`}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Hub Icon */}
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3.5 shadow-md ${
                isTg
                  ? 'bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white shadow-[0_4px_16px_rgba(36,129,204,0.35)]'
                  : 'bg-gradient-to-tr from-[#C25E30] to-[#E08244] text-white shadow-[0_4px_16px_rgba(194,94,48,0.35)]'
              }`}
            >
              {isTg ? <TelegramIcon className="w-6 h-6 fill-current" /> : <Smartphone className="w-6 h-6" />}
            </div>

            <h3 className="font-display text-lg font-bold text-[var(--text-main)] m-0 tracking-tight">
              {isTg ? 'Подключение Telegram' : 'Импорт на смартфон'}
            </h3>
            <p className="font-body text-xs text-[var(--text-muted)] mt-1 mb-5 max-w-[280px]">
              {isTg
                ? 'Отсканируйте камерой смартфона для мгновенного подключения прокси в Telegram'
                : 'Отсканируйте камерой в приложении Happ, FlClash, v2rayNG или Sing-box'}
            </p>

            {/* Styled Telegram/M3 QR Code Container with subtle outer glow */}
            <div className="relative p-3.5 rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-black/5 mb-5 flex items-center justify-center">
              <div ref={qrRef} className="w-[240px] h-[240px] flex items-center justify-center overflow-hidden rounded-xl" />
            </div>

            {/* Action Buttons */}
            <div className="w-full flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCopy}
                type="button"
                className={`flex-1 h-11 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs ${
                  isTg
                    ? 'bg-gradient-to-r from-[#2481CC] to-[#2AABEE] hover:brightness-105 text-white'
                    : 'bg-gradient-to-r from-[#C25E30] to-[#E08244] hover:brightness-105 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Скопировано!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-white" />
                    <span>Скопировать URL</span>
                  </>
                )}
              </motion.button>

              <button
                onClick={handleDownloadQr}
                title="Сохранить QR-код (PNG)"
                type="button"
                className="h-11 px-3.5 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default QrModal;
