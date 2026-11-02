import React from 'react';
import { CardDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';

/**
 * LA TUA ZONA DI GIOCO
 * Le carte che hai giocato davanti a te (Proprietà, Bushido): piccole, distanziate e appoggiate
 * sul tappeto, ben separate dalla mano. Senza riquadri: l'elemento resta sempre presente (anche vuoto)
 * perché è il punto d'arrivo delle animazioni e la zona dove trascinare le carte.
 */

interface PlayerFieldProps {
  properties: CardDef[];
  onInspectCard?: (card: CardDef) => void;
  /** Evidenzia la zona mentre trascini una carta da giocare */
  isDropActive?: boolean;
}

function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 100) / 100 - 0.5) * 8;
}

export const PlayerField: React.FC<PlayerFieldProps> = ({ properties, onInspectCard, isDropActive = false }) => {
  const groups: Record<string, CardDef[]> = {};
  properties.forEach(card => {
    (groups[card.templateId || card.name] ??= []).push(card);
  });

  return (
    <div
      id="table-player-field"
      className={`flex items-center justify-center gap-6 select-none pointer-events-auto transition-all duration-300 ${
        isDropActive ? 'field-drop-active' : ''
      }`}
      style={{ minHeight: 104, minWidth: 220 }}
    >
      {properties.length === 0 && isDropActive && (
        <span className="text-amber-200/80 text-xs font-bold seat-label">Rilascia qui per giocare la carta</span>
      )}
      {Object.entries(groups).map(([groupKey, cards]) => {
        const firstCard = cards[0];
        const count = cards.length;
        return (
          <div
            key={groupKey}
            onClick={() => onInspectCard?.(firstCard)}
            className="relative cursor-pointer hover:scale-110 transition-transform animate-fadeIn"
            style={{ rotate: `${tilt(firstCard.id)}deg` }}
            title={`${firstCard.name}${count > 1 ? ` ×${count}` : ''}: clicca per ingrandire`}
          >
            {count > 1 &&
              Array.from({ length: Math.min(count - 1, 2) }).map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-[6px] bg-slate-900 border border-slate-700/80 shadow"
                  style={{ transform: `translate(${(i + 1) * 4}px, ${(i + 1) * 3}px)`, zIndex: -1 - i }}
                />
              ))}
            <TabletopCard imageSrc={`/assets/cards/${firstCard.templateId}.webp`} fallbackText={firstCard.name} size="sm" />
            {count > 1 && <span className="absolute -bottom-2 -right-2 text-amber-300 font-black text-sm seat-label">×{count}</span>}
          </div>
        );
      })}
    </div>
  );
};
