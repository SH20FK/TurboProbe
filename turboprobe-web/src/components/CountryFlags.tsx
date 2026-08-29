import React from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { Globe } from 'lucide-react';

interface FlagProps {
  countryCode?: string;
  className?: string;
  style?: React.CSSProperties;
}

const CountryFlagComponent: React.FC<FlagProps> = ({
  countryCode,
  className = 'w-4 h-3 rounded-xs',
  style,
}) => {
  const rawCode = (countryCode || '').trim().toUpperCase();

  if (!rawCode || rawCode === 'ALL' || rawCode === 'GLOBAL' || rawCode === 'UN') {
    return <Globe className={`inline-block shrink-0 ${className}`} style={style} />;
  }

  const code = rawCode === 'UK' ? 'GB' : rawCode;
  const FlagComponent = (
    Flags as Record<
      string,
      React.ComponentType<{ className?: string; style?: React.CSSProperties; title?: string }>
    >
  )[code];

  if (!FlagComponent) {
    return <Globe className={`inline-block shrink-0 ${className}`} style={style} />;
  }

  return (
    <FlagComponent
      className={`inline-block object-cover shrink-0 shadow-xs rounded-[2px] ${className}`}
      style={style}
      title={code}
    />
  );
};

export const CountryFlag = React.memo(CountryFlagComponent);
export default CountryFlag;
