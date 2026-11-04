import React, { useLayoutEffect, useRef, useState } from 'react';
import { PlayerPublicState, CardDef, CharacterDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { TokenPile } from './TokenPile';
import { Crosshair, Bot, Crown } from 'lucide-react';
import { getTableScale, type SeatGeometry } from '../utils/tableLayout';

/**
 * POSTO DI UN AVVERSARIO AL TAVOLO
 *
 * Una colonna che va dal bordo del tavolo verso il centro, ruotata come il giocatore:
 *   1. personaggio e ruolo (sovrapposti come carte appoggiate) con i gettoni ai lati
 *   2. davanti: le carte che ha in mano, coperte, a ventaglio
 *   3. ancora più avanti: le carte giocate davanti a sé (Proprietà, Bushido)
 * Il nome sta attaccato al posto, sempre dritto e leggibile.
 */

interface OpponentTableAreaProps {
  player: PlayerPublicState;
  isCurrentTurn: boolean;
  /** Posizione e rotazione del posto attorno al tavolo */
  seat: SeatGeometry;
  distanceFromMe?: number;
  difficultyFromMe?: number;
  isTargetable?: boolean;
  /** Il giocatore deve rispondere/decidere adesso (Parata, Bushido, ...) */
  isDeciding?: boolean;
  /** Mentre scegli il bersaglio: il calcolo (portata / danno) da mostrare accanto al nome */
  targetInfo?: { ok: boolean; text: string };
  onTargetSelect?: () => void;
  onInspectCard?: (card: CardDef) => void;
  onInspectCharacter?: (char: CharacterDef) => void;
}

/** Rotazione pseudo-casuale stabile per le carte appoggiate sul tavolo */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 100) / 100 - 0.5) * 8;
}

export const OpponentTableArea: React.FC<OpponentTableAreaProps> = ({
  player,
  isCurrentTurn,
  seat,
  distanceFromMe,
  difficultyFromMe,
  isTargetable = false,
  isDeciding = false,
  targetInfo,
  onTargetSelect,
  onInspectCard,
  onInspectCharacter
}) => {
  const isShogun = player.role?.id === 'shogun';
  const defeated = player.currentHp <= 0;
  const characterImage = player.character ? `/assets/characters/${player.character.id}.webp` : '/assets/ui/character_back.webp';
  const roleImage = player.role ? `/assets/roles/${player.role.id}.webp` : '/assets/ui/role_back.webp';

  /** Le scritte dentro al posto restano dritte anche se il posto è ruotato */
  const upright: React.CSSProperties = { transform: `rotate(${-seat.rotation}deg)` };

  // --- Il nome si attacca al bordo esterno del posto, misurato dopo il disegno ---
  const blockRef = useRef<HTMLDivElement>(null);
  // Passando sopra il personaggio, la sua abilità compare nella riga del nome
  const [showAbility, setShowAbility] = useState(false);
  const [labelPos, setLabelPos] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const el = blockRef.current;
    const stage = document.getElementById('table-stage');
    if (!el || !stage) return;
    const s = getTableScale() || 1;
    const r = el.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    // Lati: nome sopra al posto; in alto: nome sopra al posto (lato del bordo del tavolo)
    const next = { x: (r.left + r.width / 2 - st.left) / s, y: (r.top - st.top) / s - 4 };
    if (!labelPos || Math.abs(labelPos.x - next.x) > 1 || Math.abs(labelPos.y - next.y) > 1) setLabelPos(next);
  });

  // Proprietà uguali impilate con il numero di copie
  const groups: Record<string, CardDef[]> = {};
  player.propertiesInPlay.forEach(prop => {
    (groups[prop.templateId || prop.name] ??= []).push(prop);
  });

  const seatState = defeated
    ? 'opponent-defeated'
    : isTargetable
      ? 'cursor-pointer seat-target'
      : isDeciding && !isCurrentTurn
        ? 'seat-deciding'
        : isCurrentTurn
          ? 'seat-turn'
          : '';

  // 1. Personaggio + ruolo sovrapposti, gettoni ai lati
  const identity = (
    <div className={`flex items-center justify-center gap-2 ${seatState}`}>
      <TokenPile
        id={`tokens-hp-${player.id}`}
        kind="hp"
        ledgerKey={`hp:${player.id}`}
        count={player.currentHp}
        seed={`hp-${player.id}`}
        size={22}
        perRow={2}
        title={`Resistenza: ${player.currentHp} su ${player.maxHp}`}
      />
      <div className="relative" style={{ width: 88 + 46, height: 125 }}>
        {/* Ruolo sotto, sfalsato a destra */}
        <div className="absolute" style={{ left: 46, top: 0, rotate: '4deg' }}>
          <TabletopCard imageSrc={roleImage} fallbackText={player.role?.name || 'Ruolo'} size="seat" />
          {isShogun && (
            <div className="absolute -top-2 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full shadow" style={upright}>
              <Crown className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        {/* Personaggio sopra */}
        <div
          id={`character-card-${player.id}`}
          className="absolute cursor-pointer transition-transform"
          style={{ left: 0, top: 0, rotate: '-2deg' }}
          onMouseEnter={() => setShowAbility(true)}
          onMouseLeave={() => setShowAbility(false)}
          onClick={e => {
            if (isTargetable) return;
            if (player.character && onInspectCharacter) {
              e.stopPropagation();
              onInspectCharacter(player.character);
            }
          }}
          title={player.character ? `${player.character.name}: clicca per vedere l'abilità` : ''}
        >
          <TabletopCard imageSrc={characterImage} fallbackText={player.character?.name || 'Personaggio'} size="seat" />
        </div>
        {/* Abbattuto: unico segno, finché non recupera al suo turno */}
        {defeated && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <span className="font-jp text-6xl text-red-600/85 drop-shadow-[0_0_12px_rgba(220,38,38,0.8)] animate-fadeIn" style={upright}>
              斬
            </span>
          </div>
        )}
      </div>
      <TokenPile
        id={`tokens-honor-${player.id}`}
        kind="honor"
        ledgerKey={`honor:${player.id}`}
        count={player.honorPoints}
        seed={`honor-${player.id}`}
        size={22}
        perRow={2}
        title={`Punti Onore: ${player.honorPoints}`}
      />
    </div>
  );

  // 2. Davanti: le carte in mano, coperte a ventaglio
  const shownBacks = Math.min(8, player.handCount);
  const handFan = (
    <div className="flex items-center justify-center" style={{ height: 66 }} title={`${player.handCount} carte in mano`}>
      {player.handCount === 0 ? (
        <span className="text-[10px] font-bold text-amber-400/80 seat-label" style={upright}>
          nessuna carta in mano
        </span>
      ) : (
        <div className="flex items-end">
          {Array.from({ length: shownBacks }).map((_, idx) => (
            <div
              key={idx}
              className="card-in"
              style={{
                marginLeft: idx === 0 ? 0 : -22,
                rotate: `${(idx - (shownBacks - 1) / 2) * 6}deg`,
                transformOrigin: seat.facingDown ? 'top center' : 'bottom center'
              }}
            >
              <TabletopCard imageSrc="/assets/ui/card_back.webp" fallbackText="Dorso" size="xs" />
            </div>
          ))}
          {player.handCount > shownBacks && (
            <span className="text-[11px] font-bold text-slate-300 ml-2 seat-label self-center" style={upright}>
              +{player.handCount - shownBacks}
            </span>
          )}
        </div>
      )}
    </div>
  );

  // 3. Ancora più avanti: le carte giocate davanti a sé
  const playZone = (
    <div id={`table-field-${player.id}`} className="flex flex-row items-center justify-center gap-3" style={{ minWidth: 120, minHeight: 92 }}>
      {Object.entries(groups).map(([groupKey, list]) => {
        const topCard = list[0];
        const count = list.length;
        return (
          <div
            key={groupKey}
            onClick={e => {
              e.stopPropagation();
              onInspectCard?.(topCard);
            }}
            className="relative cursor-pointer card-in hover:scale-110 transition-transform duration-300"
            style={{ rotate: `${tilt(topCard.id)}deg` }}
            title={`${topCard.name}${count > 1 ? ` ×${count}` : ''}: clicca per ingrandire`}
          >
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
              <span className="absolute -bottom-2 -right-2 text-amber-300 font-black text-sm seat-label" style={upright}>
                ×{count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Nome attaccato al posto, sempre dritto */}
      {labelPos && (
        <div
          className="absolute z-30 pointer-events-none"
          style={{ left: labelPos.x, top: labelPos.y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="flex items-center gap-1.5 text-xs seat-label whitespace-nowrap">
            <span className={`font-title font-bold transition-colors duration-500 ${isCurrentTurn ? 'text-amber-300 seat-name-turn' : 'text-slate-100'}`}>
              {player.name}
            </span>
            {player.isBot && <Bot className="w-3 h-3 text-blue-400 opacity-80" />}
            {!player.isBot && player.isAway && (
              <span title="Disconnesso: un bot gioca al suo posto" className="text-[10px] font-bold text-sky-300">
                🤖 bot
              </span>
            )}
            {!player.isBot && !player.isAway && player.isConnected === false && (
              <span title="Connessione persa: in attesa che rientri" className="text-[10px] font-bold text-red-300 animate-pulse">
                offline
              </span>
            )}
            {showAbility && player.character ? (
              // Abilità del personaggio (passando sopra la sua carta)
              <span className="text-[11px] text-slate-200 italic">
                {player.character.name} · {player.character.shortAbility}
              </span>
            ) : targetInfo ? (
              // Mentre scegli il bersaglio: perché è (o non è) colpibile
              <span className={`text-[11px] font-bold flex items-center gap-1 ${targetInfo.ok ? 'text-emerald-300' : 'text-red-400/90'}`}>
                {targetInfo.ok && <Crosshair className="w-3.5 h-3.5" />}
                {targetInfo.text}
              </span>
            ) : (
              distanceFromMe !== undefined && (
                <span className="text-[10px] text-amber-400/90 font-semibold" title="Distanza · Difficoltà per colpirlo">
                  D{distanceFromMe} · Diff {difficultyFromMe}
                </span>
              )
            )}
            {isDeciding && !isTargetable && (
              <span className="text-sky-300 text-[11px] font-bold flex items-center gap-1">
                sta decidendo
                <span className="thinking-dots">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Il posto: dal bordo del tavolo verso il centro */}
      <div
        ref={blockRef}
        id={`table-opponent-${player.id}`}
        onClick={() => isTargetable && onTargetSelect?.()}
        className={`absolute select-none flex ${seat.facingDown ? 'flex-col' : 'flex-col-reverse'} items-center gap-2 ${isTargetable ? 'cursor-pointer' : ''}`}
        style={{
          left: seat.x,
          top: seat.y,
          transform: `translate(-50%, -50%) rotate(${seat.rotation}deg) scale(${seat.scale})`
        }}
      >
        {identity}
        {handFan}
        {playZone}
      </div>
    </>
  );
};
