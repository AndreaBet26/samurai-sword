import React from 'react';

interface HeartTokenProps {
  isFilled: boolean;
  size?: 'sm' | 'md';
}

export const HeartToken: React.FC<HeartTokenProps> = ({ isFilled, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs';

  if (!isFilled) {
    return (
      <div
        className={`${sizeClasses} rounded-full border border-red-950/60 bg-black/40 flex items-center justify-center opacity-30 shrink-0`}
        title="Vita persa"
      >
        <span className="text-red-950 font-black">×</span>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-br from-red-500 via-red-600 to-red-800 border border-red-300 shadow-md flex items-center justify-center shrink-0 select-none transform hover:scale-110 transition-transform`}
      title="Punto Resistenza (Vita)"
      style={{
        boxShadow: '0 2px 4px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.4)'
      }}
    >
      <span className="text-white select-none text-[9px] leading-none">❤️</span>
    </div>
  );
};

interface HonorTokenProps {
  size?: 'sm' | 'md';
}

export const HonorToken: React.FC<HonorTokenProps> = ({ size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs';

  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-br from-purple-600 to-purple-900 border border-amber-300 shadow-md flex items-center justify-center shrink-0 select-none transform hover:scale-110 transition-transform`}
      title="Gettone Onore (🪷)"
      style={{
        boxShadow: '0 2px 4px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.4)'
      }}
    >
      <span className="text-amber-200 select-none text-[10px] leading-none">🪷</span>
    </div>
  );
};
