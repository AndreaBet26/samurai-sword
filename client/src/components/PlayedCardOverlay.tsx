import React, { useEffect, useState } from 'react';
import { LastPlayedCardAnim } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { soundManager } from '../utils/soundEffects';

interface PlayedCardOverlayProps {
  lastPlayedCard: LastPlayedCardAnim | null;
}

export const PlayedCardOverlay: React.FC<PlayedCardOverlayProps> = ({ lastPlayedCard }) => {
  const [currentAnim, setCurrentAnim] = useState<LastPlayedCardAnim | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [randomTilt, setRandomTilt] = useState(0);

  useEffect(() => {
    if (!lastPlayedCard) return;

    // Trigger on new card or new timestamp
    if (!currentAnim || currentAnim.timestamp !== lastPlayedCard.timestamp) {
      setCurrentAnim(lastPlayedCard);
      setIsVisible(true);
      // Random natural physical card tilt between -4 and +4 degrees
      setRandomTilt((Math.random() - 0.5) * 8);

      // Play appropriate sound effect
      if (lastPlayedCard.card.actionType === 'parry') {
        soundManager.playParryClash();
      } else if (lastPlayedCard.card.type === 'weapon') {
        soundManager.playSwordSlash();
        setTimeout(() => soundManager.playCardSlam(), 150);
      } else {
        soundManager.playCardSlam();
      }

      // Hide after 2.4 seconds so players can clearly read and appreciate the card
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 2400);

      return () => clearTimeout(timer);
    }
  }, [lastPlayedCard?.timestamp]);

  if (!isVisible || !currentAnim) return null;

  const isWeapon = currentAnim.card.type === 'weapon';
  const isParry = currentAnim.card.actionType === 'parry';

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex flex-col items-center justify-center">
      {/* Subtle dark backdrop focus */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 animate-fadeIn" />

      {/* Slamming Card Container */}
      <div
        className="relative flex flex-col items-center z-50 transform transition-all duration-300 animate-cardSlam"
        style={{
          transform: `rotate(${randomTilt}deg)`
        }}
      >
        {/* Banner with Player & Action */}
        <div className="mb-3 px-4 py-1.5 rounded-full bg-slate-950/90 border border-amber-500/70 shadow-2xl flex items-center gap-2 drop-shadow-lg backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="font-title font-bold text-amber-300 text-xs sm:text-sm tracking-wider uppercase">
            {currentAnim.sourcePlayerName}
          </span>
          <span className="text-slate-200 text-xs sm:text-sm font-semibold">
            {isParry ? 'gioca' : isWeapon ? 'attacca con' : 'ha giocato'}
          </span>
          <span
            className={`font-title font-black text-xs sm:text-sm uppercase tracking-wide ${
              isParry ? 'text-blue-400' : isWeapon ? 'text-red-400' : 'text-amber-400'
            }`}
          >
            {currentAnim.card.name}
          </span>
          {currentAnim.targetPlayerName && (
            <span className="text-red-300 text-xs font-semibold">
              ➔ {currentAnim.targetPlayerName}
            </span>
          )}
        </div>

        {/* The Card thrown down in full physical glory */}
        <div
          style={{
            width: '140px',
            height: '198px',
            borderRadius: '10px',
            boxShadow: isParry
              ? '0 0 25px rgba(59,130,246,0.8), 0 20px 40px rgba(0,0,0,0.95)'
              : isWeapon
              ? '0 0 30px rgba(239,68,68,0.8), 0 20px 40px rgba(0,0,0,0.95)'
              : '0 0 25px rgba(245,158,11,0.6), 0 20px 40px rgba(0,0,0,0.95)'
          }}
          className="relative overflow-hidden bg-slate-900 border-2 border-amber-400/80"
        >
          <img
            src={`/assets/cards/${currentAnim.card.templateId}.png`}
            alt={currentAnim.card.name}
            className="w-full h-full object-cover object-center block"
          />

          {/* Impact flash overlay */}
          <div className="absolute inset-0 bg-white/20 pointer-events-none animate-pulse" />
        </div>
      </div>
    </div>
  );
};
