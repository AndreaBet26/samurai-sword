import React from 'react';
import { PlayerPublicState, CardDef, CharacterDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { TokenPile } from './TokenPile';
import { Crosshair, Bot, Crown } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';

/**
 * POSTO DI UN AVVERSARIO AL TAVOLO
 *
 * Diviso in due zone, senza riquadri:
 *  - Zona giocatore (sul bordo del tavolo): personaggio, ruolo, gettoni Vita/Onore, carte in mano coperte
 *  - Zona di gioco (verso il centro del tavolo): le carte giocate davanti a sé (Proprietà, Bushido),
 *    più piccole e appoggiate come su un tavolo vero
 */

export type SeatSide = 'top' | 'left' | 'right';

interface OpponentTableAreaProps {
  player: PlayerPublicState;
  isCurrentTurn: boolean;
  /** Lato del tavolo: decide dove sta la zona di gioco (sempre verso il centro) */
  side?: SeatSide;
  distanceFromMe?: number;
  difficultyFromMe?: number;
  isTargetable?: boolean;
  /** Il giocatore deve rispondere/decidere adesso (Parata, Bushido, ...) */
  isDeciding?: boolean;
  onTargetSelect?: () => void;
  onInspectCard?: (card: CardDef) => void;
  onInspectCharacter?: (char: CharacterDef) => void;
}

/** Rotazione pseudo-casuale stabile per le carte appoggiate sul tavolo */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 100) / 100 - 0.5) * 10;
}

export const OpponentTableArea: React.FC<OpponentTableAreaProps> = ({
  player,
  isCurrentTurn,
  side = 'top',
  distanceFromMe,
  difficultyFromMe,
  isTargetable = false,
  isDeciding = false,
  onTargetSelect,
  onInspectCard,
  onInspectCharacter
}) => {
  const isShogun = player.role?.id === 'shogun';
  const defeated = player.currentHp <= 0;

  const characterImage = player.character ? `/assets/characters/${player.character.id}.webp` : '/assets/ui/character_back.webp';
  const roleImage = player.role ? `/assets/roles/${player.role.id}.webp` : '/assets/ui/role_back.webp';

  const handleClickTarget = () => {
    if (isTargetable) {
      soundManager.playSwordSlash();
      onTargetSelect?.();
    }
  };

  // Proprietà uguali impilate con il numero di copie
  const groups: Record<string, CardDef[]> = {};
  player.propertiesInPlay.forEach(prop => {
    const key = prop.templateId || prop.name;
    (groups[key] ??= []).push(prop);
  });
  const propertyEntries = Object.entries(groups);

  // ---- ZONA GIOCATORE ----
  const identity = (
    <div className="flex flex-col items-center gap-1">
      {/* Nome, distanza, stato connessione */}
      <div className="flex items-center gap-1.5 text-xs seat-label">
        <span className={`font-title font-bold transition-colors ${isCurrentTurn ? 'text-amber-300 seat-name-turn' : 'text-slate-100'}`}>
          {player.name}
        </span>
        {player.isBot && <Bot className="w-3 h-3 text-blue-400 opacity-80" />}
        {!player.isBot && player.isAway && (
          <span title="Disconnesso: un bot gioca al suo posto" className="text-[10px] font-bold text-sky-300">🤖 bot</span>
        )}
        {!player.isBot && !player.isAway && player.isConnected === false && (
          <span title="Connessione persa: in attesa che rientri" className="text-[10px] font-bold text-red-300 animate-pulse">offline</span>
        )}
        {distanceFromMe !== undefined && (
          <span className="text-[10px] text-amber-400/90 font-semibold" title="Distanza · Difficoltà per colpirlo">
            D{distanceFromMe} · Diff {difficultyFromMe}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Personaggio + ruolo */}
        <div className="relative flex items-center gap-1">
          <div
            onClick={e => {
              if (isTargetable) return;
              if (player.character && onInspectCharacter) {
                e.stopPropagation();
                onInspectCharacter(player.character);
              }
            }}
            className="relative cursor-pointer"
            title={player.character ? `${player.character.name}: clicca per vedere l'abilità` : ''}
          >
            <TabletopCard imageSrc={characterImage} fallbackText={player.character?.name || 'Personaggio'} size="seat" isTargetable={isTargetable} />
          </div>
          <div className="relative">
            <TabletopCard imageSrc={roleImage} fallbackText={player.role?.name || 'Ruolo'} size="seat" />
            {isShogun && (
              <div className="absolute -top-2 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full shadow">
                <Crown className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
          {/* Abbattuto: unico segno, finché non recupera al suo turno */}
          {defeated && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
              <span className="font-jp text-6xl text-red-600/85 drop-shadow-[0_0_12px_rgba(220,38,38,0.8)] rotate-[-12deg] animate-fadeIn">斬</span>
            </div>
          )}
        </div>

        {/* Gettoni fisici + carte in mano coperte */}
        <div className="flex flex-col items-start gap-1">
          <TokenPile
            id={`tokens-hp-${player.id}`}
            kind="hp"
            ledgerKey={`hp:${player.id}`}
            count={player.currentHp}
            seed={`hp-${player.id}`}
            size={20}
            title={`Resistenza: ${player.currentHp} su ${player.maxHp}`}
          />
          <TokenPile
            id={`tokens-honor-${player.id}`}
            kind="honor"
            ledgerKey={`honor:${player.id}`}
            count={player.honorPoints}
            seed={`honor-${player.id}`}
            size={20}
            title={`Punti Onore: ${player.honorPoints}`}
          />
          <div className="flex items-center mt-0.5" title={`${player.handCount} carte in mano`}>
            {player.handCount === 0 ? (
              <span className="text-[10px] font-bold text-amber-400/90 seat-label">Nessuna carta</span>
            ) : (
              <div className="flex items-center -space-x-5">
                {Array.from({ length: Math.min(6, player.handCount) }).map((_, idx, arr) => (
                  <div key={idx} style={{ transform: `rotate(${(idx - (arr.length - 1) / 2) * 7}deg)`, transformOrigin: 'bottom center' }}>
                    <TabletopCard imageSrc="/assets/ui/card_back.webp" fallbackText="Dorso" size="xs" />
                  </div>
                ))}
                {player.handCount > 6 && <span className="text-[10px] font-bold text-slate-300 ml-6 seat-label">+{player.handCount - 6}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ---- ZONA DI GIOCO (davanti al giocatore, verso il centro) ----
  const playZone = (
    <div
      id={`table-field-${player.id}`}
      className={`flex ${side === 'top' ? 'flex-row' : 'flex-col'} items-center justify-center gap-3`}
      style={{ minWidth: side === 'top' ? 90 : 70, minHeight: side === 'top' ? 96 : 100 }}
    >
      {propertyEntries.map(([groupKey, cards]) => {
        const topCard = cards[0];
        const count = cards.length;
        return (
          <div
            key={groupKey}
            onClick={e => {
              e.stopPropagation();
              onInspectCard?.(topCard);
            }}
            className="relative cursor-pointer hover:scale-110 transition-transform animate-fadeIn"
            style={{ rotate: `${tilt(topCard.id)}deg` }}
            title={`${topCard.name}${count > 1 ? ` ×${count}` : ''}: clicca per ingrandire`}
          >
            {/* Copie uguali: carte sfalsate sotto, come una piccola pila */}
            {count > 1 &&
              Array.from({ length: Math.min(count - 1, 2) }).map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-[5px] bg-slate-900 border border-slate-700/80 shadow"
                  style={{ transform: `translate(${(i + 1) * 4}px, ${(i + 1) * 3}px)`, zIndex: -1 - i }}
                />
              ))}
            <TabletopCard imageSrc={`/assets/cards/${topCard.templateId}.webp`} fallbackText={topCard.name} size="table" />
            {count > 1 && (
              <span className="absolute -bottom-2 -right-2 text-amber-300 font-black text-sm seat-label">×{count}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  const layout =
    side === 'top' ? 'flex-col items-center gap-4' : side === 'left' ? 'flex-row items-center gap-6' : 'flex-row-reverse items-center gap-6';

  return (
    <div
      id={`table-opponent-${player.id}`}
      onClick={handleClickTarget}
      className={`relative flex ${layout} select-none transition-all duration-300 shrink-0 ${
        defeated
          ? 'opponent-defeated'
          : isTargetable
            ? 'cursor-pointer scale-105 seat-target'
            : isDeciding && !isCurrentTurn
              ? 'seat-deciding'
              : isCurrentTurn
                ? 'seat-turn'
                : ''
      }`}
    >
      {/* Sta decidendo (es. se parare un attacco) */}
      {isDeciding && !isTargetable && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 text-sky-300 text-[11px] font-bold whitespace-nowrap flex items-center gap-1 seat-label">
          <span>Sta decidendo</span>
          <span className="thinking-dots"><i /><i /><i /></span>
        </div>
      )}
      {isTargetable && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 text-red-400 text-[11px] font-black uppercase flex items-center gap-1 animate-bounce whitespace-nowrap seat-label">
          <Crosshair className="w-3.5 h-3.5" />
          Colpisci
        </div>
      )}

      {identity}
      {playZone}
    </div>
  );
};
