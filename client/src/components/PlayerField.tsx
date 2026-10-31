import React from 'react';
import { CardDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { Shield } from 'lucide-react';

interface PlayerFieldProps {
  properties: CardDef[];
  onInspectCard?: (card: CardDef) => void;
}

export const PlayerField: React.FC<PlayerFieldProps> = ({
  properties,
  onInspectCard
}) => {
  if (properties.length === 0) return null;

  // Group properties by templateId / name so identical types stack cleanly
  const groups: Record<string, CardDef[]> = {};
  properties.forEach(card => {
    const key = card.templateId || card.name;
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  });

  return (
    <div
      id="table-player-field"
      className="flex items-center justify-center gap-4 px-4 py-1 select-none pointer-events-auto"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-blue-400 bg-black/80 px-2.5 py-0.5 rounded-full border border-blue-600/50 shadow">
        <Shield className="w-3.5 h-3.5 text-blue-400" />
        <span>Terreno</span>
      </div>

      <div className="flex items-center gap-4">
        {Object.entries(groups).map(([groupKey, cards]) => {
          const firstCard = cards[0];
          const count = cards.length;

          return (
            <div
              key={groupKey}
              onClick={() => onInspectCard?.(firstCard)}
              className="relative flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform"
              title={`${firstCard.name} (${count}): Clicca per ingrandire`}
            >
              {/* Stacked Cards Container: directly on top of each other with 3D physical deck depth */}
              <div className="relative">
                {count > 1 && (
                  <>
                    <div className="absolute inset-0 bg-slate-900 border border-slate-700/80 rounded-md shadow-md pointer-events-none translate-x-1 translate-y-1 z-0" />
                    {count > 2 && (
                      <div className="absolute inset-0 bg-slate-900 border border-slate-700/80 rounded-md shadow pointer-events-none translate-x-2 translate-y-2 -z-10" />
                    )}
                    <span className="absolute -top-2.5 -right-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full border-2 border-amber-200 shadow-xl z-30">
                      x{count}
                    </span>
                  </>
                )}

                <div className="relative z-10">
                  <TabletopCard
                    imageSrc={`/assets/cards/${firstCard.templateId}.png`}
                    fallbackText={firstCard.name}
                    size="sm"
                  />
                </div>
              </div>

              <span className="text-[11px] font-bold text-blue-300 mt-1 drop-shadow max-w-[90px] truncate text-center">
                {firstCard.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
