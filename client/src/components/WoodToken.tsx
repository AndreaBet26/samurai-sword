import React from 'react';

interface HeartTokenProps {
  isFilled: boolean;
  size?: 'sm' | 'md';
}

export const HeartToken: React.FC<HeartTokenProps> = ({ isFilled, size = 'sm' }) => {
  const sizePx = size === 'sm' ? 18 : 24;

  if (!isFilled) {
    return (
      <div
        className="relative shrink-0 flex items-center justify-center opacity-30 grayscale select-none"
        style={{ width: sizePx, height: sizePx }}
        title="Resistenza persa"
      >
        <img
          src="/assets/ui/resilience_token.webp"
          alt="Resistenza persa"
          className="w-full h-full object-contain brightness-50"
          draggable={false}
        />
        <span className="absolute inset-0 flex items-center justify-center text-red-500 font-black text-xs select-none">×</span>
      </div>
    );
  }

  return (
    <div
      className="relative shrink-0 select-none transform hover:scale-115 transition-transform"
      style={{ width: sizePx, height: sizePx }}
      title="Punto Resistenza (Vita)"
    >
      <img
        src="/assets/ui/resilience_token.webp"
        alt="Resistenza"
        className="w-full h-full object-contain filter drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
        draggable={false}
      />
    </div>
  );
};

interface HonorTokenProps {
  size?: 'sm' | 'md';
}

export const HonorToken: React.FC<HonorTokenProps> = ({ size = 'sm' }) => {
  const sizePx = size === 'sm' ? 18 : 24;

  return (
    <div
      className="relative shrink-0 select-none transform hover:scale-115 transition-transform"
      style={{ width: sizePx, height: sizePx }}
      title="Gettone Onore"
    >
      <img
        src="/assets/ui/honor_token.webp"
        alt="Gettone Onore"
        className="w-full h-full object-contain filter drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
        draggable={false}
      />
    </div>
  );
};
