import React, { useState, useEffect } from 'react';
import { CardDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { Shield, Trash2, ArrowLeftRight } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';

interface HandTrayProps {
  cards: CardDef[];
  isMyTurn: boolean;
  isUnderAttack?: boolean;
  eligibleReactionCardIds?: string[];
  isDiscardPhase?: boolean;
  selectedDiscardIds?: string[];
  selectedCardId?: string | null;
  onCardClick: (card: CardDef) => void;
}

export const HandTray: React.FC<HandTrayProps> = ({
  cards,
  isMyTurn,
  isUnderAttack = false,
  eligibleReactionCardIds = [],
  isDiscardPhase = false,
  selectedDiscardIds = [],
  selectedCardId = null,
  onCardClick
}) => {
  const [orderedHand, setOrderedHand] = useState<CardDef[]>([]);

  useEffect(() => {
    const currentIds = new Set(cards.map(c => c.id));
    const kept = orderedHand.filter(c => currentIds.has(c.id));
    const newCards = cards.filter(c => !kept.some(k => k.id === c.id));
    setOrderedHand([...kept, ...newCards]);
  }, [cards]);

  const sortCardsByType = () => {
    soundManager.playCardSlide();
    const sorted = [...orderedHand].sort((a, b) => {
      const typeOrder = { weapon: 1, property: 2, action: 3 };
      return typeOrder[a.type] - typeOrder[b.type];
    });
    setOrderedHand(sorted);
  };

  // Fixed overlap calculation for 136px wide cards
  const getOverlapMargin = (total: number, index: number) => {
    if (index === 0) return 0;
    if (total <= 4) return 14;
    if (total <= 6) return -24;
    if (total <= 8) return -44;
    return -58;
  };

  return (
    <div
      id="table-player-hand"
      className="relative w-full flex flex-col items-center justify-end select-none pointer-events-auto h-[216px]"
    >
      {/* Top subtle controls bar */}
      <div className="flex items-center justify-center gap-4 mb-1">
        {orderedHand.length > 1 && !isUnderAttack && !isDiscardPhase && (
          <button
            onClick={sortCardsByType}
            className="text-[10px] text-amber-400 hover:text-amber-300 bg-black/70 hover:bg-black/90 border border-slate-700/80 px-3 py-0.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shadow"
            title="Ordina per tipo: Armi, Proprietà, Azioni"
          >
            <ArrowLeftRight className="w-3 h-3" />
            Ordina Mano ({orderedHand.length})
          </button>
        )}
      </div>

      {/* Cards container with rock-solid baseline */}
      <div className="relative flex items-end justify-center h-[195px] w-full px-4 overflow-visible">
        {orderedHand.length > 0 &&
          orderedHand.map((card, idx) => {
            const isParryCandidate = isUnderAttack && eligibleReactionCardIds.includes(card.id);
            const isDiscardSelected = isDiscardPhase && selectedDiscardIds.includes(card.id);
            const isSelected = selectedCardId === card.id;

            const margin = getOverlapMargin(orderedHand.length, idx);

            return (
              <div
                key={card.id}
                style={{
                  marginLeft: `${margin}px`,
                  zIndex: isSelected ? 50 : isParryCandidate ? 45 : isDiscardSelected ? 40 : idx + 1
                }}
                className="relative transition-transform duration-200 shrink-0 animate-fadeIn"
              >
                {/* Visual Badges for Defense or Discard */}
                {isParryCandidate && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 font-black text-[9px] uppercase px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-50 animate-bounce pointer-events-none">
                    <Shield className="w-3 h-3 text-slate-950" />
                    Parata!
                  </div>
                )}

                {isDiscardSelected && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-[9px] uppercase px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 z-50 pointer-events-none">
                    <Trash2 className="w-3 h-3 text-white" />
                    Scarta
                  </div>
                )}

                {/* The card element */}
                <div
                  onClick={() => {
                    soundManager.playCardSlide();
                    onCardClick(card);
                  }}
                  className={`transition-all duration-200 cursor-pointer ${
                    isParryCandidate
                      ? '-translate-y-5 scale-105 ring-4 ring-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.9)] rounded-lg'
                      : isDiscardSelected
                      ? '-translate-y-4 scale-102 ring-4 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] rounded-lg'
                      : isSelected
                      ? '-translate-y-5 scale-105 ring-4 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.8)] rounded-lg'
                      : isUnderAttack
                      ? 'opacity-35 grayscale-[30%] cursor-not-allowed'
                      : 'hover:-translate-y-4 hover:scale-105'
                  }`}
                >
                  <TabletopCard
                    imageSrc={`/assets/cards/${card.templateId}.png`}
                    fallbackText={card.name}
                    size="hand"
                    isHoverable={false}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
