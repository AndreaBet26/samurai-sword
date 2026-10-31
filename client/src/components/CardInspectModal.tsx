import React from 'react';
import { CardDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { X, Sword, Shield, Zap } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';

interface CardInspectModalProps {
  card: CardDef;
  isPlayable: boolean;
  onPlay: (card: CardDef) => void;
  onClose: () => void;
}

export const CardInspectModal: React.FC<CardInspectModalProps> = ({
  card,
  isPlayable,
  onPlay,
  onClose
}) => {
  const imageSrc = `/assets/cards/${card.templateId}.png`;

  const handlePlay = () => {
    soundManager.playCardSlide();
    onPlay(card);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col items-center max-w-sm sm:max-w-md w-full"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-full border border-slate-700 transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Full-Bleed Authentic Card in High Definition */}
        <div className="transform hover:scale-102 transition-transform duration-200">
          <TabletopCard
            imageSrc={imageSrc}
            fallbackText={card.name}
            size="zoom"
            isHoverable={false}
          />
        </div>

        {/* Bottom Play Action (if playable) */}
        {isPlayable && (
          <div className="mt-5 flex items-center justify-center w-full">
            <button
              onClick={handlePlay}
              className="py-3 px-8 rounded-2xl font-title font-bold text-sm bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:scale-105 text-white shadow-2xl shadow-red-600/40 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sword className="w-4 h-4" />
              {card.type === 'weapon'
                ? 'Attacca con quest\'Arma'
                : card.type === 'property'
                ? 'Equipaggia'
                : 'Gioca questa Azione'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
