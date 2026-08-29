import React from 'react';

interface FlagProps {
  countryCode?: string;
  className?: string;
}

/**
 * Returns Unicode regional indicator emoji flag for ISO 3166-1 alpha-2 country codes.
 */
export function getCountryFlagEmoji(countryCode?: string): string {
  if (!countryCode || countryCode === 'all' || countryCode === 'global' || countryCode === 'un') {
    return '🌐';
  }
  const code = countryCode.trim().toUpperCase();
  if (code === 'UK') return '🇬🇧';
  if (code.length !== 2) return '🌐';

  try {
    const codePoints = [...code].map((c) => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌐';
  }
}

const CountryFlagComponent: React.FC<FlagProps> = ({ countryCode, className = '' }) => {
  const emoji = getCountryFlagEmoji(countryCode);
  return (
    <span
      className={`inline-flex items-center justify-center select-none leading-none ${className}`}
      aria-label={countryCode || 'global'}
      role="img"
    >
      {emoji}
    </span>
  );
};

export const CountryFlag = React.memo(CountryFlagComponent);
export default CountryFlag;
