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

    case 'it': // Italy 🇮🇹
      return (
        <svg className={className} viewBox="0 0 3 2">
          <rect width="1" height="2" fill="#009246"/>
          <rect width="1" height="2" x="1" fill="#ffffff"/>
          <rect width="1" height="2" x="2" fill="#ce2b37"/>
        </svg>
      );

    case 'es': // Spain 🇪🇸
      return (
        <svg className={className} viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#AA151B"/>
          <rect width="3" height="1" y="0.5" fill="#F1BF00"/>
        </svg>
      );

    case 'ch': // Switzerland 🇨🇭
      return (
        <svg className={className} viewBox="0 0 1 1">
          <rect width="1" height="1" fill="#D52B1E"/>
          <rect width="0.6" height="0.2" x="0.2" y="0.4" fill="#ffffff"/>
          <rect width="0.2" height="0.6" x="0.4" y="0.2" fill="#ffffff"/>
        </svg>
      );

    case 'at': // Austria 🇦🇹
      return (
        <svg className={className} viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#ED2939"/>
          <rect width="3" height="0.66" y="0.66" fill="#ffffff"/>
        </svg>
      );

    case 'cz': // Czechia 🇨🇿
      return (
        <svg className={className} viewBox="0 0 3 2">
          <rect width="3" height="1" fill="#ffffff"/>
          <rect width="3" height="1" y="1" fill="#d7141a"/>
          <polygon points="0,0 1.5,1 0,2" fill="#11457e"/>
        </svg>
      );

    case 'no': // Norway 🇳🇴
      return (
        <svg className={className} viewBox="0 0 22 16">
          <rect width="22" height="16" fill="#ba0c2f"/>
          <rect width="4" height="16" x="6" fill="#ffffff"/>
          <rect width="22" height="4" y="6" fill="#ffffff"/>
          <rect width="2" height="16" x="7" fill="#00205b"/>
          <rect width="22" height="2" y="7" fill="#00205b"/>
        </svg>
      );

    case 'ua': // Ukraine 🇺🇦
      return (
        <svg className={className} viewBox="0 0 3 2">
          <rect width="3" height="1" fill="#0057B7"/>
          <rect width="3" height="1" y="1" fill="#FFDD00"/>
        </svg>
      );

    case 'am': // Armenia 🇦🇲
      return (
        <svg className={className} viewBox="0 0 6 3">
          <rect width="6" height="1" fill="#D90012"/>
          <rect width="6" height="1" y="1" fill="#0033A0"/>
          <rect width="6" height="1" y="2" fill="#F2A800"/>
        </svg>
      );

    case 'in': // India 🇮🇳
      return (
        <svg className={className} viewBox="0 0 9 6">
          <rect width="9" height="2" fill="#FF9933"/>
          <rect width="9" height="2" y="2" fill="#ffffff"/>
          <rect width="9" height="2" y="4" fill="#138808"/>
          <circle cx="4.5" cy="3" r="0.7" fill="#000080"/>
        </svg>
      );

    case 'au': // Australia 🇦🇺
      return (
        <svg className={className} viewBox="0 0 60 30">
          <rect width="60" height="30" fill="#00008b"/>
          <rect width="30" height="15" fill="#012169"/>
          <path d="M0,0 L30,15 M30,0 L0,15" stroke="#fff" strokeWidth="2"/>
          <path d="M15,0 v15 M0,7.5 h30" stroke="#fff" strokeWidth="4"/>
          <circle cx="45" cy="18" r="3" fill="#fff"/>
        </svg>
      );

    case 'br': // Brazil 🇧🇷
      return (
        <svg className={className} viewBox="0 0 10 7">
          <rect width="10" height="7" fill="#009739"/>
          <polygon points="5,0.7 9.2,3.5 5,6.3 0.8,3.5" fill="#FEDD00"/>
          <circle cx="5" cy="3.5" r="1.6" fill="#012169"/>
        </svg>
      );

    case 'hk': // Hong Kong 🇭🇰
      return (
        <svg className={className} viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#ED1C24"/>
          <circle cx="1.5" cy="1" r="0.5" fill="#ffffff"/>
        </svg>
      );

    case 'kr': // South Korea 🇰🇷
      return (
        <svg className={className} viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#ffffff"/>
          <circle cx="1.5" cy="1" r="0.5" fill="#CD2E3A"/>
        </svg>
      );

    case 'ro': // Romania 🇷🇴
      return (
        <svg className={className} viewBox="0 0 3 2">
          <rect width="1" height="2" fill="#002B7F"/>
          <rect width="1" height="2" x="1" fill="#FCD116"/>
          <rect width="1" height="2" x="2" fill="#CE1126"/>
        </svg>
      );

    case 'bg': // Bulgaria 🇧🇬
      return (
        <svg className={className} viewBox="0 0 5 3">
          <rect width="5" height="1" fill="#ffffff"/>
          <rect width="5" height="1" y="1" fill="#00966E"/>
          <rect width="5" height="1" y="2" fill="#D62612"/>
        </svg>
      );

    case 'ee': // Estonia 🇪🇪
      return (
        <svg className={className} viewBox="0 0 33 21">
          <rect width="33" height="7" fill="#0072CE"/>
          <rect width="33" height="7" y="7" fill="#000000"/>
          <rect width="33" height="7" y="14" fill="#ffffff"/>
        </svg>
      );

    case 'lv': // Latvia 🇱🇻
      return (
        <svg className={className} viewBox="0 0 20 10">
          <rect width="20" height="4" fill="#9E3039"/>
          <rect width="20" height="2" y="4" fill="#ffffff"/>
          <rect width="20" height="4" y="6" fill="#9E3039"/>
        </svg>
      );

    case 'lt': // Lithuania 🇱🇹
      return (
        <svg className={className} viewBox="0 0 5 3">
          <rect width="5" height="1" fill="#FDB913"/>
          <rect width="5" height="1" y="1" fill="#006A44"/>
          <rect width="5" height="1" y="2" fill="#C1272D"/>
        </svg>
      );

    case 'gr': // Greece 🇬🇷
      return (
        <svg className={className} viewBox="0 0 9 6">
          <rect width="9" height="6" fill="#0D5EAF"/>
          <rect width="9" height="0.66" y="0.66" fill="#ffffff"/>
          <rect width="9" height="0.66" y="2" fill="#ffffff"/>
          <rect width="9" height="0.66" y="3.33" fill="#ffffff"/>
          <rect width="9" height="0.66" y="4.66" fill="#ffffff"/>
          <rect width="3.33" height="3.33" fill="#0D5EAF"/>
          <rect width="0.66" height="3.33" x="1.33" fill="#ffffff"/>
          <rect width="3.33" height="0.66" y="1.33" fill="#ffffff"/>
        </svg>
      );

    case 'il': // Israel 🇮🇱
      return (
        <svg className={className} viewBox="0 0 22 16">
          <rect width="22" height="16" fill="#ffffff"/>
          <rect width="22" height="2" y="2" fill="#0038b8"/>
          <rect width="22" height="2" y="12" fill="#0038b8"/>
          <polygon points="11,5 14,10 8,10" fill="none" stroke="#0038b8" strokeWidth="0.8"/>
          <polygon points="11,11 14,6 8,6" fill="none" stroke="#0038b8" strokeWidth="0.8"/>
        </svg>
      );

    case 'ae': // UAE 🇦🇪
      return (
        <svg className={className} viewBox="0 0 6 3">
          <rect width="6" height="1" fill="#00732f"/>
          <rect width="6" height="1" y="1" fill="#ffffff"/>
          <rect width="6" height="1" y="2" fill="#000000"/>
          <rect width="1.5" height="3" fill="#ff0000"/>
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
