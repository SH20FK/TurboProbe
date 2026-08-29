import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCodeStyling from 'qr-code-styling';
import { X, Copy, Check, Download } from 'lucide-react';
import { TelegramIcon } from './ServiceIcons';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  subUrl: string;
}

// Telegram Center Icon (circular cutout with authentic plane)
const TG_LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#1C2733"/>
    <circle cx="50" cy="50" r="40" fill="#2481CC"/>
    <path fill="#FFFFFF" d="M30 49.5l38-16c1.8-.8 3.6.5 3 2.4l-6.5 30.8c-.5 2.1-1.8 2.7-3.6 1.7L51 61l-4.8 4.6c-.6.6-1 .9-2 .9l.7-10.1 18.5-16.7c.8-.7-.2-1.1-1.2-.4L39.4 53.7 29.6 50.6c-2.1-.7-2.1-2.1.4-3.1z"/>
  </svg>`
)}`;

// TurboProbe Shield Center Icon (circular cutout with warm shield)
const VPN_LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#241E1A"/>
    <circle cx="50" cy="50" r="40" fill="#C25E30"/>
    <path fill="#FFFFFF" d="M50 26l20 7.5v17.5c0 12.9-8.5 24.6-20 27.5-11.5-2.9-20-14.6-20-27.5V33.5L50 26zm0 7.1L35 38.7v12.3c0 9.3 6.4 18 15 20.4 8.6-2.4 15-11.1 15-20.4V38.7L50 33.1z"/>
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

    const qrBgColor = isTg ? '#151F2A' : '#1A1614';

    const qr = new QRCodeStyling({
      width: 260,
      height: 260,
      type: 'canvas',
      data: subUrl,
      image: isTg ? TG_LOGO_DATA_URI : VPN_LOGO_DATA_URI,
      margin: 8,
      qrOptions: {
        typeNumber: 0,
        mode: 'Byte',
        errorCorrectionLevel: 'M',
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.3,
        margin: 5,
        crossOrigin: 'anonymous',
      },
      dotsOptions: {
        type: 'extra-rounded',
        gradient: {
          type: 'linear',
          rotation: 45,
          colorStops: isTg
            ? [
                { offset: 0, color: '#86E3CE' },
                { offset: 0.35, color: '#56CCF2' },
                { offset: 0.7, color: '#2F80ED' },
                { offset: 1, color: '#B18CFE' },
              ]
            : [
                { offset: 0, color: '#FCD34D' },
                { offset: 0.45, color: '#F97316' },
                { offset: 1, color: '#E11D48' },
              ],
        },
      },
      backgroundOptions: {
        color: qrBgColor,
      },
      cornersSquareOptions: {
        type: 'extra-rounded',
        gradient: {
          type: 'linear',
          rotation: 45,
          colorStops: isTg
            ? [
                { offset: 0, color: '#86E3CE' },
                { offset: 1, color: '#56CCF2' },
              ]
            : [
                { offset: 0, color: '#FCD34D' },
                { offset: 1, color: '#F97316' },
              ],
        },
      },
      cornersDotOptions: {
        type: 'dot',
        color: isTg ? '#B18CFE' : '#E11D48',
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
          {/* Dark Glassmorphism Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full max-w-sm p-6 rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] shadow-2xl flex flex-col items-center text-center select-none overflow-hidden ${
              isTg ? 'theme-tg' : ''
            }`}
          >
            {/* Ambient Backlight Glow */}
            <div
              className={`absolute top-0 w-48 h-48 rounded-full blur-3xl pointer-events-none -mt-16 opacity-40 ${
                isTg ? 'bg-[#2481CC]' : 'bg-[#C25E30]'
              }`}
            />

            {/* Close Button */}
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Top Badge Icon */}
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-md ${
                isTg
                  ? 'bg-gradient-to-tr from-[#2481CC] to-[#2AABEE] text-white shadow-[0_4px_16px_rgba(36,129,204,0.35)]'
                  : 'bg-gradient-to-tr from-[#C25E30] to-[#E08244] text-white shadow-[0_4px_16px_rgba(194,94,48,0.35)]'
              }`}
            >
              <TelegramIcon className="w-6 h-6 fill-current" />
            </div>

            <h3 className="font-display text-lg font-bold text-[var(--text-main)] m-0 tracking-tight">
              {isTg ? 'Подключение Telegram' : 'Импорт на смартфон'}
            </h3>
            <p className="font-body text-xs text-[var(--text-muted)] mt-1 mb-4 max-w-[280px]">
              {isTg
                ? 'Отсканируйте камерой смартфона для мгновенного подключения'
                : 'Отсканируйте камерой в приложении Happ, FlClash или v2rayNG'}
            </p>

            {/* Seamless Dark QR Canvas Card */}
            <div
              className="relative p-2 rounded-2xl border border-[var(--border-main)] mb-5 flex items-center justify-center shadow-lg"
              style={{ backgroundColor: isTg ? '#151F2A' : '#1A1614' }}
            >
              <div ref={qrRef} className="w-[260px] h-[260px] flex items-center justify-center overflow-hidden rounded-xl" />
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
