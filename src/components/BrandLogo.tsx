import React, { useEffect, useState } from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  showTagline?: boolean;
  variant?: 'full' | 'compact' | 'seal-only';
  theme?: 'dark' | 'light';
  logoUrl?: string;
}

const dimensions = {
  sm: 38,
  md: 52,
  lg: 78,
  xl: 108,
  '2xl': 142,
  hero: 176,
};

/** Isologotipo institucional según el Manual de Marca El Desayuno. */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = true,
  variant = 'full',
  theme = 'dark',
  logoUrl,
}) => {
  const symbolSize = dimensions[size];
  const isLight = theme === 'light';
  const [customLogoFailed, setCustomLogoFailed] = useState(false);
  const ink = isLight ? '#FFFFFF' : '#18332F';
  const cut = isLight ? '#18332F' : '#FFFFFF';

  useEffect(() => {
    setCustomLogoFailed(false);
  }, [logoUrl]);

  const symbol = logoUrl && !customLogoFailed ? (
    <img
      src={logoUrl}
      alt="El Desayuno Fideicomiso"
      className="object-contain shrink-0"
      style={{ width: symbolSize, height: symbolSize }}
      onError={() => setCustomLogoFailed(true)}
    />
  ) : (
    <svg
      width={symbolSize}
      height={symbolSize}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Isologotipo El Desayuno Fideicomiso"
      className="shrink-0"
    >
      <path fill={ink} d="M17 82V48l14-11v34L17 82Zm20-17V30l14-11v35L37 65Zm20-18V13c28 1 50 23 50 51 0 23-16 42-38 47H42l15-18V47Z" />
      <path d="M25 99c25-35 49-46 82-46" fill="none" stroke={cut} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );

  if (variant === 'seal-only') return <span className={`inline-flex ${className}`}>{symbol}</span>;

  const wordmarkSize = size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-3xl';
  const submarkSize = size === 'sm' ? 'text-[7px]' : size === 'md' ? 'text-[9px]' : 'text-[11px]';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {symbol}
      <span className="flex flex-col leading-none">
        <span className={`${wordmarkSize} font-bold tracking-[0.05em]`} style={{ color: ink, fontFamily: "'HK Grotesk', 'Avenir Next', Arial, sans-serif" }}>
          EL DESAYUNO
        </span>
        <span className={`${submarkSize} mt-1 font-medium tracking-[0.34em]`} style={{ color: ink, fontFamily: "'HK Grotesk', 'Avenir Next', Arial, sans-serif" }}>
          FIDEICOMISO
        </span>
        {showTagline && variant === 'full' && (
          <span className="mt-2 text-[9px] tracking-wide opacity-70" style={{ color: ink }}>Gestión patrimonial</span>
        )}
      </span>
    </div>
  );
};
