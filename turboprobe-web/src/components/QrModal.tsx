import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCodeStyling from 'qr-code-styling';
import { X, Copy, Check, Download, Send, Shield } from 'lucide-react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  subUrl: string;
}

// Telegram Center Icon (clean SVG on white circle)
const TG_LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#FFFFFF"/>
    <circle cx="50" cy="50" r="40" fill="#2481CC"/>
    <path fill="#FFFFFF" d="M30 49.5l38-16c1.8-.8 3.6.5 3 2.4l-6.5 30.8c-.5 2.1-1.8 2.7-3.6 1.7L51 61l-4.8 4.6c-.6.6-1 .9-2 .9l.7-10.1 18.5-16.7c.8-.7-.2-1.1-1.2-.4L39.4 53.7 29.6 50.6c-2.1-.7-2.1-2.1.4-3.1z"/>
  </svg>`
)}`;

// TurboProbe Key/Shield Center Icon (clean SVG on white circle)
const VPN_LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="#FFFFFF"/>
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

    // Cohesive, clean single-tone QR code design
    const qrColor = isTg ? '#132337' : '#1C1917';

    const qr = new QRCodeStyling({
      width: 236,
      height: 236,
      type: 'canvas',
      data: subUrl,
      image: isTg ? TG_LOGO_DATA_URI : VPN_LOGO_DATA_URI,
      margin: 1,
      qrOptions: {
        typeNumber: 0,
        mode: 'Byte',
        errorCorrectionLevel: 'M',
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.3,
        margin: 3,
        crossOrigin: 'anonymous',
      },
      dotsOptions: {
        type: 'rounded',
        color: qrColor,
      },
      backgroundOptions: {
        color: '#FFFFFF',
      },
      cornersSquareOptions: {
        type: 'extra-rounded',
        color: qrColor,
      },
      cornersDotOptions: {
        type: 'dot',
        color: qrColor,
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

  // Truncated preview text
  const previewText = subUrl.length > 42 ? `${subUrl.slice(0, 42)}...` : subUrl;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`relative z-10 w-full max-w-sm p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-2xl flex flex-col items-center text-center select-none ${
              isTg ? 'theme-tg' : ''
            }`}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              type="button"
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-main)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header Icon */}
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-white shadow-xs ${
                isTg ? 'bg-[#2481CC]' : 'bg-[#C25E30]'
              }`}
            >
              {isTg ? <Send className="w-5 h-5 fill-current" /> : <Shield className="w-5 h-5" />}
            </div>

            <h3 className="font-display text-lg font-bold text-[var(--text-main)] m-0 tracking-tight">
              {isTg ? 'Подключение в Telegram' : 'Импорт конфигурации'}
            </h3>
            <p className="font-body text-xs text-[var(--text-muted)] mt-1 mb-4 max-w-[260px]">
              {isTg
                ? 'Отсканируйте камерой смартфона для автоматического подключения'
                : 'Отсканируйте камерой в приложении v2rayNG, Happ или FlClash'}
            </p>

            {/* Crisp High-Contrast White QR Card with Slim Border */}
            <div className="p-1.5 bg-white rounded-xl shadow-sm border border-slate-200/80 mb-3 flex items-center justify-center">
              <div ref={qrRef} className="w-[236px] h-[236px] flex items-center justify-center overflow-hidden rounded-lg" />
            </div>

            {/* Sub URL Preview Pill */}
            <div className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-main)] text-[10px] font-mono text-[var(--text-muted)] truncate mb-4">
              {previewText}
            </div>

            {/* Action Buttons */}
            <div className="w-full flex items-center gap-2">
              <button
                onClick={handleCopy}
                type="button"
                className={`flex-1 h-10 px-4 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isTg
                    ? 'bg-[#2481CC] hover:bg-[#1C72B8] text-white'
                    : 'bg-[#C25E30] hover:bg-[#A84C22] text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-white" />
                    <span>Скопировать ссылку</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadQr}
                title="Скачать QR-код (PNG)"
                type="button"
                className="h-10 px-3 rounded-xl bg-[var(--bg-app)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center transition-colors cursor-pointer"
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
