import React, { useState, useEffect } from 'react';
import { CardDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { ArrowLeftRight, Layers, MoveHorizontal } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';

interface HandTrayProps {
  cards: CardDef[];
  isMyTurn: boolean;
  onCardClick: (card: CardDef) => void;
}

export const HandTray: React.FC<HandTrayProps> = ({
  cards,
  isMyTurn,
  onCardClick
}) => {
  const [orderedHand, setOrderedHand] = useState<CardDef[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    soundManager.playCardSlide();
    const updated = [...orderedHand];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setOrderedHand(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div id="table-player-hand" className="flex flex-col items-center select-none shrink-0 max-w-full">
      {/* Hand Controls Header */}
      <div className="flex items-center justify-between w-full px-3 mb-1 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-title font-bold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5 drop-shadow">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            La Tua Mano ({orderedHand.length})
          </span>
          {orderedHand.length > 1 && (
            <button
              onClick={sortCardsByType}
              className="text-[9px] text-amber-400 hover:text-amber-300 bg-black/60 hover:bg-black/90 border border-slate-700 px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer shadow"
              title="Ordina per tipo: Armi, Proprietà, Azioni"
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
              Ordina
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 drop-shadow">
          <MoveHorizontal className="w-3 h-3 text-slate-500" />
          <span>Trascina per ordinare • Clicca per ingrandire</span>
        </div>
      </div>

      {/* Cards Row with fanned/overlapping spacing & Drag and Drop */}
      <div className="flex items-end justify-center px-4 overflow-visible py-1">
        {orderedHand.length === 0 ? (
          <div className="py-2.5 px-6 rounded-xl border border-dashed border-slate-700/70 text-slate-400 text-xs italic bg-black/30">
            Nessuna carta in mano. Sei Inoffensivo!
          </div>
        ) : (
          orderedHand.map((card, idx) => {
            // Overlapping fan layout
            const overlapMargin = idx === 0 
              ? '0px' 
              : orderedHand.length > 6 
                ? '-34px' 
                : orderedHand.length > 4 
                  ? '-22px' 
                  : '8px';

            const isDragged = draggedIndex === idx;
            const isOver = dragOverIndex === idx && !isDragged;

            return (
              <div
                key={card.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`relative transition-all duration-200 cursor-grab active:cursor-grabbing hover:z-40 ${
                  isDragged ? 'opacity-30 scale-90 -translate-y-2' : ''
                } ${
                  isOver ? 'scale-110 -translate-y-5 z-30' : ''
                }`}
                style={{
                  marginLeft: overlapMargin,
                  zIndex: isOver ? 50 : idx + 1
                }}
              >
                {/* The full-bleed card with hover lift */}
                <div
                  onClick={() => {
                    soundManager.playCardSlide();
                    onCardClick(card);
                  }}
                  className="transition-transform duration-200 hover:-translate-y-4 hover:scale-105"
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
          })
        )}
      </div>
    </div>
  );
};
