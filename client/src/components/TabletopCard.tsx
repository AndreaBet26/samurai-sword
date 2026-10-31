import React, { useState } from 'react';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'player' | 'hand' | 'zoom';

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

  // Explicit pixel-perfect dimensions with standard card ratio 1 : 1.42
  const sizeStyles: Record<CardSize, { width: string; height: string; borderRadius: string }> = {
    xs: { width: '32px', height: '45px', borderRadius: '3px' },
    sm: { width: '56px', height: '80px', borderRadius: '5px' },
    md: { width: '80px', height: '114px', borderRadius: '6px' },
    lg: { width: '110px', height: '156px', borderRadius: '8px' },
    hand: { width: '110px', height: '156px', borderRadius: '8px' },
    player: { width: '92px', height: '130px', borderRadius: '8px' },
    zoom: { width: '280px', height: '398px', borderRadius: '16px' }
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
          ? '0 0 0 3px #f59e0b, 0 10px 20px rgba(0,0,0,0.9)'
          : isTargetable
          ? '0 0 0 3px #ef4444, 0 0 18px rgba(239,68,68,0.7), 0 6px 12px rgba(0,0,0,0.9)'
          : '0 4px 10px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.6)'
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
          <span className="text-[9px] font-bold leading-tight">{fallbackText}</span>
        </div>
      )}
    </div>
  );
};
