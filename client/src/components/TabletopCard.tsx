import React, { useState } from 'react';

export type CardSize = 'xs' | 'table' | 'sm' | 'seat' | 'md' | 'lg' | 'player' | 'hand' | 'zoom';

interface TabletopCardProps {
  imageSrc: string;
  fallbackText?: string;
  size?: CardSize;
  isHoverable?: boolean;
  isSelected?: boolean;
  isTargetable?: boolean;
  onClick?: () => void;
  className?: string;
}

export const TabletopCard: React.FC<TabletopCardProps> = ({
  imageSrc,
  fallbackText = 'Carta',
  size = 'md',
  isHoverable = false,
  isSelected = false,
  isTargetable = false,
  onClick,
  className = ''
}) => {
  const [loadError, setLoadError] = useState(false);

  // Generous pixel-perfect dimensions with standard card ratio 1 : 1.42
  const sizeStyles: Record<CardSize, { width: string; height: string; borderRadius: string }> = {
    xs: { width: '40px', height: '57px', borderRadius: '4px' },
    table: { width: '62px', height: '88px', borderRadius: '5px' }, // carte appoggiate nella zona di gioco
    sm: { width: '72px', height: '102px', borderRadius: '6px' },
    seat: { width: '88px', height: '125px', borderRadius: '7px' }, // personaggio/ruolo degli avversari
    md: { width: '104px', height: '148px', borderRadius: '8px' },
    lg: { width: '130px', height: '185px', borderRadius: '10px' },
    hand: { width: '150px', height: '213px', borderRadius: '11px' }, // carte in mano: le più grandi
    player: { width: '112px', height: '159px', borderRadius: '9px' },
    zoom: { width: '310px', height: '440px', borderRadius: '18px' }
  };

  const currentSize = sizeStyles[size] || sizeStyles.md;

  return (
    <div
      onClick={onClick}
      style={{
        width: currentSize.width,
        height: currentSize.height,
        borderRadius: currentSize.borderRadius,
        boxShadow: isSelected
          ? '0 0 0 3px #f59e0b, 0 10px 25px rgba(0,0,0,0.95)'
          : isTargetable
          ? '0 0 0 3px #ef4444, 0 0 22px rgba(239,68,68,0.8), 0 6px 14px rgba(0,0,0,0.9)'
          : '0 5px 14px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.6)'
      }}
      className={`relative select-none shrink-0 overflow-hidden cursor-pointer transition-all duration-200 ${
        isHoverable ? 'hover:-translate-y-2 hover:shadow-2xl hover:scale-105' : ''
      } ${
        isSelected ? '-translate-y-3 scale-105 z-10' : ''
      } ${
        isTargetable ? 'animate-pulse hover:scale-110 z-10' : ''
      } bg-slate-900 border border-slate-700/80 ${className}`}
    >
      {!loadError ? (
        <img
          src={imageSrc}
          alt={fallbackText}
          onError={() => setLoadError(true)}
          className="w-full h-full object-cover object-center pointer-events-none block"
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-slate-900 text-slate-300">
          <span className="text-base mb-1">⚔️</span>
          <span className="text-[10px] font-bold leading-tight">{fallbackText}</span>
        </div>
      )}
    </div>
  );
};
