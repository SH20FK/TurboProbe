import React from 'react';
import ReactCountryFlag from 'react-country-flag';
import { Globe } from 'lucide-react';

interface FlagProps {
  countryCode?: string;
  className?: string;
  style?: React.CSSProperties;
}

const CountryFlagComponent: React.FC<FlagProps> = ({ countryCode, className = '', style }) => {
  const code = (countryCode || '').trim().toUpperCase();

  if (!code || code === 'ALL' || code === 'GLOBAL' || code === 'UN' || code.length !== 2) {
    return <Globe className={`inline-block ${className}`} style={style} />;
  }

  const normalizedCode = code === 'UK' ? 'GB' : code;

  return (
    <ReactCountryFlag
      countryCode={normalizedCode}
      svg
      className={`inline-block object-cover ${className}`}
      style={{
        width: '1.25em',
        height: '0.95em',
        verticalAlign: 'middle',
        borderRadius: '2px',
        ...style,
      }}
      title={normalizedCode}
      aria-label={normalizedCode}
    />
  );
};

export const CountryFlag = React.memo(CountryFlagComponent);
export default CountryFlag;
