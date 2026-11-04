import React, { useState } from 'react';
import { CardDef, PlayerPublicState } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { soundManager } from '../utils/soundEffects';

/**
 * SCELTA DI UNA CARTA DALLA MANO DI UN AVVERSARIO (Diversione, Geisha)
 *
 * Le carte dell'avversario sono mostrate coperte, a ventaglio: scegli tu quale prendere.
 * Resta una scelta "alla cieca" come al tavolo vero (il server rimescola la mano prima di prenderla).
 * Con la Geisha puoi in alternativa scegliere una delle sue Proprietà scoperte sul tavolo.
 */

interface HiddenCardPickerProps {
  card: CardDef; // la carta che stai giocando (Diversione o Geisha)
  target: PlayerPublicState;
  onPickHand: (index: number) => void;
  onPickProperty: (propertyId: string) => void;
  onCancel: () => void;
}

export const HiddenCardPicker: React.FC<HiddenCardPickerProps> = ({ card, target, onPickHand, onPickProperty, onCancel }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const isGeisha = card.actionType === 'geisha';
  const n = target.handCount;
  const spread = Math.min(9, 60 / Math.max(1, n));

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/70 animate-fadeIn select-none"
      onClick={onCancel}
    >
      <div className="text-center mb-6 seat-label" onClick={e => e.stopPropagation()}>
        <div className="font-title text-2xl font-black text-amber-300">{card.name}</div>
        <div className="text-slate-200 text-sm mt-1">
          {isGeisha
            ? `Scegli cosa far scartare a ${target.name}: una sua Proprietà oppure una carta coperta dalla mano`
            : `Scegli una carta coperta dalla mano di ${target.name}: sarà tua`}
        </div>
      </div>

      {/* Geisha: Proprietà scoperte dell'avversario */}
      {isGeisha && target.propertiesInPlay.length > 0 && (
        <div className="flex flex-col items-center mb-8" onClick={e => e.stopPropagation()}>
          <div className="flex items-end gap-5">
            {target.propertiesInPlay.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  soundManager.play('cardPlace');
                  onPickProperty(p.id);
                }}
                className="transition-transform duration-200 hover:-translate-y-3 hover:scale-105 cursor-pointer"
                title={`Fai scartare ${p.name}`}
              >
                <TabletopCard imageSrc={`/assets/cards/${p.templateId}.webp`} fallbackText={p.name} size="md" />
              </button>
            ))}
          </div>
          {n > 0 && <div className="text-slate-400 text-xs font-bold mt-5 seat-label">oppure una carta dalla mano</div>}
        </div>
      )}

      {/* Carte coperte a ventaglio */}
      {n > 0 && (
        <div className="relative flex items-end justify-center h-[230px]" onClick={e => e.stopPropagation()}>
          {Array.from({ length: n }).map((_, i) => {
            const off = i - (n - 1) / 2;
            const isHover = hovered === i;
            return (
              <button
                key={i}
                onMouseEnter={() => {
                  setHovered(i);
                  soundManager.play('cardHover');
                }}
                onMouseLeave={() => setHovered(h => (h === i ? null : h))}
                onClick={() => {
                  soundManager.play('cardDraw');
                  onPickHand(i);
                }}
                className="cursor-pointer"
                style={{
                  marginLeft: i === 0 ? 0 : -50,
                  transform: `translateY(${isHover ? -28 : Math.abs(off) * Math.abs(off) * 1.5}px) rotate(${off * spread}deg) scale(${isHover ? 1.08 : 1})`,
                  transformOrigin: 'bottom center',
                  transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                  zIndex: isHover ? 50 : i,
                  filter: isHover ? 'drop-shadow(0 0 14px rgba(251,191,36,0.9))' : undefined
                }}
                title="Prendi questa carta"
              >
                <TabletopCard imageSrc="/assets/ui/card_back.webp" fallbackText="Carta coperta" size="lg" />
              </button>
            );
          })}
        </div>
      )}


    </div>
  );
};
