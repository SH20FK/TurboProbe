import React from 'react';

interface FlagProps {
  countryCode?: string;
  className?: string;
}

export const CountryFlag: React.FC<FlagProps> = ({ countryCode = 'all', className = 'w-4 h-3 rounded-[2px] inline-block shadow-sm flex-shrink-0' }) => {
  const code = (countryCode || '').toLowerCase();

  switch (code) {
    case 'de': // Germany 🇩🇪
      return (
        <svg className={className} viewBox="0 0 5 3">
          <rect width="5" height="1" y="0" fill="#000000"/>
          <rect width="5" height="1" y="1" fill="#DD0000"/>
          <rect width="5" height="1" y="2" fill="#FFCE00"/>
        </svg>
      );

    case 'nl': // Netherlands 🇳🇱
      return (
        <svg className={className} viewBox="0 0 9 6">
          <rect fill="#AE1C28" width="9" height="2"/>
          <rect fill="#FFFFFF" y="2" width="9" height="2"/>
          <rect fill="#21468B" y="4" width="9" height="2"/>
        </svg>
      );

    case 'kz': // Kazakhstan 🇰🇿
      return (
        <svg className={className} viewBox="0 0 1000 500">
          <rect width="1000" height="500" fill="#00afca"/>
          <circle cx="500" cy="250" r="100" fill="#fec50c"/>
          <path d="M500 150 L510 240 L500 250 L490 240 Z" fill="#fec50c"/>
          <circle cx="500" cy="250" r="60" fill="#00afca"/>
          <circle cx="500" cy="250" r="50" fill="#fec50c"/>
        </svg>
      );

    case 'fi': // Finland 🇫🇮
      return (
        <svg className={className} viewBox="0 0 18 11">
          <rect width="18" height="11" fill="#fff"/>
          <rect width="18" height="3" y="4" fill="#003580"/>
          <rect width="3" height="11" x="5" fill="#003580"/>
        </svg>
      );

    case 'tr': // Turkey 🇹🇷
      return (
        <svg className={className} viewBox="0 0 1200 800">
          <rect width="1200" height="800" fill="#E30A17"/>
          <circle cx="450" cy="400" r="200" fill="#fff"/>
          <circle cx="500" cy="400" r="160" fill="#E30A17"/>
          <polygon points="620,400 680,420 640,365 640,435 680,380" fill="#fff"/>
        </svg>
      );

    case 'ru': // Russia 🇷🇺
      return (
        <svg className={className} viewBox="0 0 9 6">
          <rect fill="#fff" width="9" height="2"/>
          <rect fill="#0039A6" y="2" width="9" height="2"/>
          <rect fill="#D52B1E" y="4" width="9" height="2"/>
        </svg>
      );

    case 'se': // Sweden 🇸🇪
      return (
        <svg className={className} viewBox="0 0 16 10">
          <rect width="16" height="10" fill="#006aa7"/>
          <rect width="16" height="2" y="4" fill="#fecc00"/>
          <rect width="2" height="10" x="5" fill="#fecc00"/>
        </svg>
      );

    case 'us': // USA 🇺🇸
      return (
        <svg className={className} viewBox="0 0 7410 3900">
          <rect width="7410" height="3900" fill="#b22234"/>
          <path d="M0,300H7410M0,900H7410M0,1500H7410M0,2100H7410M0,2700H7410M0,3300H7410" stroke="#fff" strokeWidth="300"/>
          <rect width="2964" height="2100" fill="#3c3b6e"/>
          <circle cx="1482" cy="1050" r="400" fill="#fff"/>
        </svg>
      );

    case 'gb': // UK 🇬🇧
    case 'uk':
      return (
        <svg className={className} viewBox="0 0 60 30">
          <clipPath id="s"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
          <clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
          <g clipPath="url(#s)">
            <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
            <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
            <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
            <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
            <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
          </g>
        </svg>
      );

    case 'fr': // France 🇫🇷
      return (
        <svg className={className} viewBox="0 0 9 6">
          <rect width="3" height="6" fill="#002654"/>
          <rect x="3" width="3" height="6" fill="#ffffff"/>
          <rect x="6" width="3" height="6" fill="#ce1126"/>
        </svg>
      );

    case 'sg': // Singapore 🇸🇬
      return (
        <svg className={className} viewBox="0 0 9 6">
          <rect width="9" height="3" fill="#ED2939"/>
          <rect y="3" width="9" height="3" fill="#FFFFFF"/>
          <circle cx="2" cy="1.5" r="1.1" fill="#FFFFFF"/>
          <circle cx="2.4" cy="1.5" r="1" fill="#ED2939"/>
        </svg>
      );

    case 'jp': // Japan 🇯🇵
      return (
        <svg className={className} viewBox="0 0 9 6">
          <rect width="9" height="6" fill="#ffffff"/>
          <circle cx="4.5" cy="3" r="1.8" fill="#bc002d"/>
        </svg>
      );

    case 'pl': // Poland 🇵🇱
      return (
        <svg className={className} viewBox="0 0 8 5">
          <rect width="8" height="2.5" fill="#ffffff"/>
          <rect y="2.5" width="8" height="2.5" fill="#dc143c"/>
        </svg>
      );

    case 'ca': // Canada 🇨🇦
      return (
        <svg className={className} viewBox="0 0 12 6">
          <rect width="3" height="6" fill="#ff0000"/>
          <rect x="3" width="6" height="6" fill="#ffffff"/>
          <rect x="9" width="3" height="6" fill="#ff0000"/>
          <circle cx="6" cy="3" r="1.2" fill="#ff0000"/>
        </svg>
      );

    default: // Global / All 🌐
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
  }
};
