import React, { useState } from 'react';
import { CardDef } from '../../../shared/types';
import { soundManager } from '../utils/soundEffects';
import { Sword, Shield, Zap, Crosshair, Heart } from 'lucide-react';

interface CardViewProps {
  card: CardDef;
  isSelected?: boolean;
  isPlayable?: boolean;
  isCompact?: boolean;
  onClick?: () => void;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  isSelected = false,
  isPlayable = true,
  isCompact = false,
  onClick
}) => {
  const [imageError, setImageError] = useState(false);

  const isWeapon = card.type === 'weapon';
  const isProperty = card.type === 'property';
  const isAction = card.type === 'action';

  // Card asset path
  const imageSrc = `/assets/cards/${card.templateId}.png`;

  // Color Schemes
  const borderColor = isWeapon
    ? 'border-red-600/90 hover:border-red-400'
    : isProperty
    ? 'border-blue-500/90 hover:border-blue-300'
    : 'border-amber-500/90 hover:border-amber-300';

  const headerBg = isWeapon
    ? 'bg-gradient-to-r from-red-950 via-red-900 to-red-950 text-red-100'
    : isProperty
    ? 'bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 text-blue-100'
    : 'bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 text-amber-100';

  const badgeColor = isWeapon
    ? 'bg-red-900/60 text-red-200 border-red-700/60'
    : isProperty
    ? 'bg-blue-900/60 text-blue-200 border-blue-700/60'
    : 'bg-amber-900/60 text-amber-200 border-amber-700/60';

  const handleClick = () => {
    if (!isPlayable) return;
    soundManager.playCardSlide();
    onClick?.();
  };

  const handleMouseEnter = () => {
    if (isPlayable) {
      soundManager.playCardSlide();
    }
  };

  if (isCompact) {
    return (
      <div
        onClick={handleClick}
        className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all ${borderColor} ${
          isSelected ? 'ring-2 ring-yellow-400 scale-105' : ''
        } bg-slate-900/95`}
        title={card.description}
      >
        {isWeapon && <Sword className="w-3.5 h-3.5 text-red-400" />}
        {isProperty && <Shield className="w-3.5 h-3.5 text-blue-400" />}
        {isAction && <Zap className="w-3.5 h-3.5 text-amber-400" />}
        <span className="font-semibold truncate max-w-[110px] text-slate-200">{card.name}</span>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={`relative w-40 sm:w-44 h-56 sm:h-60 rounded-2xl border-2 flex flex-col justify-between overflow-hidden shadow-2xl select-none transition-all duration-200 ${borderColor} ${
        isSelected
          ? 'ring-4 ring-yellow-400 -translate-y-4 shadow-yellow-500/40 scale-105 z-10'
          : isPlayable
          ? 'hover:-translate-y-3 hover:shadow-2xl cursor-pointer hover:scale-102'
          : 'opacity-65 cursor-not-allowed'
      } bg-gradient-to-b from-slate-900 to-slate-950`}
    >
      {/* Glossy top reflection */}
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

      {/* Top Header */}
      <div className={`p-2 border-b border-slate-800/80 z-10 ${headerBg}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-black tracking-wider opacity-90 flex items-center gap-1">
            {isWeapon && <Sword className="w-3 h-3 text-red-300" />}
            {isProperty && <Shield className="w-3 h-3 text-blue-300" />}
            {isAction && <Zap className="w-3 h-3 text-amber-300" />}
            {isWeapon ? 'Arma' : isProperty ? 'Proprietà' : 'Azione'}
          </span>

          {isWeapon && (
            <div className="flex items-center gap-1.5">
              <span
                className="flex items-center text-xs font-black text-amber-300 bg-black/60 px-1.5 py-0.5 rounded border border-amber-600/40 shadow-sm"
                title="Gittata / Difficoltà"
              >
                <Crosshair className="w-3 h-3 mr-0.5 text-amber-400" />
                {card.difficulty}
              </span>
              <span
                className="flex items-center text-xs font-black text-red-300 bg-black/60 px-1.5 py-0.5 rounded border border-red-600/40 shadow-sm"
                title="Danno inflitto"
              >
                <Heart className="w-3 h-3 mr-0.5 text-red-500 fill-red-500" />
                {card.damage}
              </span>
            </div>
          )}
        </div>
        <h4 className="font-title font-bold text-sm tracking-wide mt-1 truncate text-slate-100">
          {card.name}
        </h4>
      </div>

      {/* Card Artwork / Center Illustration */}
      <div className="flex-1 flex flex-col items-center justify-center p-2.5 text-center bg-slate-950/60 relative overflow-hidden">
        {!imageError ? (
          <img
            src={imageSrc}
            alt={card.name}
            onError={() => setImageError(true)}
            className="w-full h-24 object-contain rounded-lg drop-shadow-md mb-1 z-10"
          />
        ) : (
          /* Fallback illustrated Sumi-e badge if custom PNG image isn't loaded yet */
          <div className="flex flex-col items-center justify-center my-auto">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 mb-2 shadow-inner ${badgeColor}`}
            >
              {isWeapon && <Sword className="w-7 h-7 text-red-400" />}
              {isProperty && <Shield className="w-7 h-7 text-blue-400" />}
              {isAction && <Zap className="w-7 h-7 text-amber-400" />}
            </div>
          </div>
        )}

        <p className="text-[11px] text-slate-300 leading-snug line-clamp-3 z-10 px-1">
          {card.description}
        </p>
      </div>

      {/* Bottom Footer */}
      <div className="px-2.5 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
        <span className="font-jp text-xs opacity-50">侍の刀</span>
        {isWeapon && (
          <span className="font-black text-red-400">
            Gittata {card.difficulty} • Danno {card.damage}
          </span>
        )}
        {isProperty && <span className="font-black text-blue-400">Permanente</span>}
        {isAction && <span className="font-black text-amber-400">Usa e getta</span>}
      </div>
    </div>
  );
};
