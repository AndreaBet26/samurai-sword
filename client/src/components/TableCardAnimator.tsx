import React, { useEffect, useState, useRef } from 'react';
import { CardDef, LastPlayedCardAnim } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { soundManager } from '../utils/soundEffects';

interface FlyingCardInstance {
  id: string;
  imageSrc: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  endX: number;
  endY: number;
  endW: number;
  endH: number;
  rotation: number;
  durationMs: number;
  active: boolean;
}

interface SlashStrike {
  startX: number;
  startY: number;
  distance: number;
  angle: number;
}

interface TableCardAnimatorProps {
  lastPlayedCard: LastPlayedCardAnim | null;
  turnPhase: string;
  turnPlayerId: string;
  myId: string;
  opponentIds?: string[];
  onInspectCard?: (card: CardDef) => void;
}

export const TableCardAnimator: React.FC<TableCardAnimatorProps> = ({
  lastPlayedCard,
  turnPhase,
  turnPlayerId,
  myId,
  opponentIds = [],
  onInspectCard
}) => {
  const [flyingCards, setFlyingCards] = useState<FlyingCardInstance[]>([]);
  const [activePlayCard, setActivePlayCard] = useState<CardDef | null>(null);
  const [activeSlash, setActiveSlash] = useState<SlashStrike | null>(null);
  const [clashEffect, setClashEffect] = useState<{ x: number; y: number } | null>(null);
  const [damagedRect, setDamagedRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const lastPlayedTimestampRef = useRef<number>(0);
  const lastDrawPhaseKeyRef = useRef<string>('');

  const getElementRect = (id: string): { x: number; y: number; w: number; h: number } => {
    const el = document.getElementById(id);
    if (el) {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    // Fallback to table center
    return {
      x: window.innerWidth / 2 - 40,
      y: window.innerHeight / 2 - 57,
      w: 80,
      h: 114
    };
  };

  const spawnFlyingCard = (
    imageSrc: string,
    fromId: string,
    toId: string,
    durationMs: number = 420,
    rotation: number = 0,
    onComplete?: () => void
  ) => {
    const fromRect = getElementRect(fromId);
    const toRect = getElementRect(toId);
    const id = `flying-${Date.now()}-${Math.random()}`;

    const newCard: FlyingCardInstance = {
      id,
      imageSrc,
      startX: fromRect.x,
      startY: fromRect.y,
      startW: fromRect.w,
      startH: fromRect.h,
      endX: toRect.x,
      endY: toRect.y,
      endW: toRect.w,
      endH: toRect.h,
      rotation,
      durationMs,
      active: false
    };

    setFlyingCards(prev => [...prev, newCard]);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlyingCards(prev =>
          prev.map(c => (c.id === id ? { ...c, active: true } : c))
        );
      });
    });

    setTimeout(() => {
      setFlyingCards(prev => prev.filter(c => c.id !== id));
      onComplete?.();
    }, durationMs + 40);
  };

  // 1. ANIMAZIONE DI PESCA (Mazzo -> Mano / Giocatore)
  useEffect(() => {
    if (turnPhase === 'draw') {
      const drawKey = `${turnPlayerId}-${Date.now()}`;
      if (lastDrawPhaseKeyRef.current && Date.now() - parseInt(lastDrawPhaseKeyRef.current.split('-')[1] || '0') < 2000) {
        return;
      }
      lastDrawPhaseKeyRef.current = drawKey;

      const targetId = turnPlayerId === myId ? 'table-player-hand' : `table-opponent-${turnPlayerId}`;

      soundManager.playCardSlide();
      spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', targetId, 450, -4);

      setTimeout(() => {
        soundManager.playCardSlide();
        spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', targetId, 450, 3);
      }, 220);
    }
  }, [turnPhase, turnPlayerId, myId]);

  // 2. ANIMAZIONE DI GIOCATA, ATTACCHI CON ARMA, PARATE ED EQUIPAGGIAMENTI
  useEffect(() => {
    if (!lastPlayedCard) return;

    if (lastPlayedCard.timestamp !== lastPlayedTimestampRef.current) {
      lastPlayedTimestampRef.current = lastPlayedCard.timestamp;

      const sourceId =
        lastPlayedCard.sourcePlayerId === myId
          ? 'table-player-hand'
          : `table-opponent-${lastPlayedCard.sourcePlayerId}`;

      const card = lastPlayedCard.card;
      const isWeapon = card.type === 'weapon';
      const isParry = card.actionType === 'parry';
      const isProperty = card.type === 'property' && card.propertyType !== 'bushido';
      const isTea = card.actionType === 'tea_ceremony';
      const isDaimyo = card.actionType === 'daimyo';

      soundManager.playCardSlide();

      // Step A: Fly from player into table play zone
      spawnFlyingCard(
        `/assets/cards/${card.templateId}.png`,
        sourceId,
        'table-play-zone',
        400,
        (Math.random() - 0.5) * 6,
        () => {
          // Card landed on table felt!
          soundManager.playCardSlam();
          setActivePlayCard(card);

          // CASE 1: Weapon Attack -> Directional Slash towards target
          if (isWeapon && lastPlayedCard.targetPlayerId) {
            const targetId =
              lastPlayedCard.targetPlayerId === myId
                ? 'table-player-mat'
                : `table-opponent-${lastPlayedCard.targetPlayerId}`;

            const playRect = getElementRect('table-play-zone');
            const targetRect = getElementRect(targetId);

            const startX = playRect.x + playRect.w / 2;
            const startY = playRect.y + playRect.h / 2;
            const endX = targetRect.x + targetRect.w / 2;
            const endY = targetRect.y + targetRect.h / 2;

            const distance = Math.hypot(endX - startX, endY - startY);
            const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;

            soundManager.playSwordSlash();
            setActiveSlash({ startX, startY, distance, angle });

            // Slash impact at target
            setTimeout(() => {
              setActiveSlash(null);
              setDamagedRect(targetRect);
              soundManager.playTaiko();
              setTimeout(() => setDamagedRect(null), 550);
            }, 320);
          }

          // CASE 2: Parry Defense -> Blade Clash in center
          if (isParry) {
            const playRect = getElementRect('table-play-zone');
            setClashEffect({
              x: playRect.x + playRect.w / 2,
              y: playRect.y + playRect.h / 2
            });
            soundManager.playParryClash();
            setTimeout(() => setClashEffect(null), 450);
          }

          // CASE 3: Cerimonia del Tè -> Multi-draw radial cards
          if (isTea) {
            setTimeout(() => {
              // 3 cards to source player
              for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                  soundManager.playCardSlide();
                  spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', sourceId, 450, -3 + i * 3);
                }, i * 160);
              }
              // 1 card to everyone else
              opponentIds.forEach((opId, idx) => {
                if (opId !== lastPlayedCard.sourcePlayerId) {
                  setTimeout(() => {
                    const opTarget = opId === myId ? 'table-player-hand' : `table-opponent-${opId}`;
                    spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', opTarget, 450);
                  }, 200 + idx * 100);
                }
              });
            }, 600);
          }

          // CASE 4: Daimyo -> 2 cards to player
          if (isDaimyo) {
            setTimeout(() => {
              for (let i = 0; i < 2; i++) {
                setTimeout(() => {
                  soundManager.playCardSlide();
                  spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', sourceId, 450, i === 0 ? -3 : 3);
                }, i * 200);
              }
            }, 500);
          }

          // Step B: Rest on felt so players see it, then slide to Discard Pile or Equipment slot
          setTimeout(() => {
            setActivePlayCard(null);

            if (isProperty) {
              // Slides into player's equipped properties row on table
              const equipTarget =
                lastPlayedCard.sourcePlayerId === myId
                  ? 'table-player-mat'
                  : `table-opponent-${lastPlayedCard.sourcePlayerId}`;

              soundManager.playCardSlide();
              spawnFlyingCard(
                `/assets/cards/${card.templateId}.png`,
                'table-play-zone',
                equipTarget,
                380
              );
            } else {
              // Slides into Discard Pile
              soundManager.playCardSlide();
              spawnFlyingCard(
                `/assets/cards/${card.templateId}.png`,
                'table-play-zone',
                'table-discard-pile',
                400,
                (Math.random() - 0.5) * 8
              );
            }
          }, 1800);
        }
      );
    }
  }, [lastPlayedCard?.timestamp]);

  return (
    <>
      {/* Ghost flying cards traveling across the table */}
      {flyingCards.map(c => {
        const deltaX = c.endX - c.startX;
        const deltaY = c.endY - c.startY;
        const scale = c.endW > 0 && c.startW > 0 ? c.endW / c.startW : 1;

        return (
          <div
            key={c.id}
            style={{
              position: 'fixed',
              left: c.startX,
              top: c.startY,
              width: c.startW,
              height: c.startH,
              zIndex: 70,
              pointerEvents: 'none',
              transform: c.active
                ? `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scale}) rotate(${c.rotation}deg)`
                : 'translate3d(0, 0, 0) scale(1) rotate(0deg)',
              transition: `transform ${c.durationMs}ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity ${c.durationMs}ms ease-out`,
              opacity: c.active ? 1 : 0.9
            }}
            className="rounded-lg shadow-[0_15px_30px_rgba(0,0,0,0.85)] overflow-hidden border border-amber-600/60 bg-slate-900"
          >
            <img
              src={c.imageSrc}
              alt="Carta in volo"
              className="w-full h-full object-cover object-center block"
            />
          </div>
        );
      })}

      {/* Directional Weapon Slash Ray targeting the victim */}
      {activeSlash && (
        <div
          style={{
            position: 'fixed',
            left: activeSlash.startX,
            top: activeSlash.startY,
            width: `${activeSlash.distance}px`,
            height: '4px',
            transformOrigin: '0 50%',
            transform: `rotate(${activeSlash.angle}deg)`,
            zIndex: 80,
            pointerEvents: 'none'
          }}
          className="bg-gradient-to-r from-amber-400 via-red-500 to-white shadow-[0_0_25px_#ef4444] rounded-full animate-slashStrike"
        />
      )}

      {/* Target Impact Hit Shake & Flash */}
      {damagedRect && (
        <div
          style={{
            position: 'fixed',
            left: damagedRect.x - 8,
            top: damagedRect.y - 8,
            width: damagedRect.w + 16,
            height: damagedRect.h + 16,
            zIndex: 85,
            pointerEvents: 'none'
          }}
          className="rounded-2xl border-4 border-red-500 bg-red-600/25 shadow-[0_0_40px_#ef4444] animate-shake"
        />
      )}

      {/* Parry Clash Sparks in Play Zone */}
      {clashEffect && (
        <div
          style={{
            position: 'fixed',
            left: clashEffect.x - 35,
            top: clashEffect.y - 35,
            width: '70px',
            height: '70px',
            zIndex: 85,
            pointerEvents: 'none'
          }}
          className="flex items-center justify-center animate-ping"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-300 via-white to-blue-400 shadow-[0_0_35px_#f59e0b]" />
        </div>
      )}

      {/* Active Played Card resting visibly on the table felt in the play zone */}
      {activePlayCard && (
        <div
          onClick={() => onInspectCard?.(activePlayCard)}
          className="cursor-pointer transform hover:scale-105 transition-transform duration-200 animate-fadeIn"
          title="Carta appena giocata sul tavolo (clicca per ingrandire)"
        >
          <TabletopCard
            imageSrc={`/assets/cards/${activePlayCard.templateId}.png`}
            fallbackText={activePlayCard.name}
            size="md"
            isSelected={true}
          />
        </div>
      )}
    </>
  );
};
