import React, { useEffect, useState, useRef } from 'react';
import { CardDef, LastPlayedCardAnim } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { soundManager } from '../utils/soundEffects';

interface FlyingCardInstance {
  id: string;
  imageSrc: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
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
  isInitialDealing?: boolean;
  incomingDrawnCards?: CardDef[];
  onCardDeliveredToHand?: (card: CardDef) => void;
  onAllDrawnCardsDelivered?: () => void;
  onInitialDealComplete?: () => void;
  onInspectCard?: (card: CardDef) => void;
}

export const TableCardAnimator: React.FC<TableCardAnimatorProps> = ({
  lastPlayedCard,
  turnPhase,
  turnPlayerId,
  myId,
  opponentIds = [],
  isInitialDealing = false,
  incomingDrawnCards = [],
  onCardDeliveredToHand,
  onAllDrawnCardsDelivered,
  onInitialDealComplete
}) => {
  const [flyingCards, setFlyingCards] = useState<FlyingCardInstance[]>([]);
  const [activePlayCard, setActivePlayCard] = useState<CardDef | null>(null);
  const [activeSlash, setActiveSlash] = useState<SlashStrike | null>(null);
  const [clashEffect, setClashEffect] = useState<{ x: number; y: number } | null>(null);

  const lastPlayedTimestampRef = useRef<number>(0);
  const lastDrawPhaseKeyRef = useRef<string>('');
  const lastDrawnBatchKeyRef = useRef<string>('');
  const hasRunInitialDealRef = useRef<boolean>(false);

  // Exact coordinates helper for large realistic cards (104x148px)
  const getTargetCoords = (id: string): { x: number; y: number } => {
    // 1. Player's Hand: directly into the center of the player's bottom hand dock
    if (id === 'table-player-hand') {
      return {
        x: window.innerWidth / 2 - 52,
        y: window.innerHeight - 175
      };
    }

    // 2. Player's Field (Terrain): directly in front of the hand on the table felt
    if (id === 'table-player-field') {
      const el = document.getElementById('table-player-field');
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          return {
            x: r.left + r.width / 2 - 52,
            y: r.top + r.height / 2 - 74
          };
        }
      }
      return {
        x: window.innerWidth / 2 - 52,
        y: window.innerHeight - 270
      };
    }

    // 3. Center Play Zone
    if (id === 'table-play-zone') {
      const el = document.getElementById('table-play-zone');
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top };
      }
      return {
        x: window.innerWidth / 2 - 52,
        y: window.innerHeight / 2 - 74
      };
    }

    // 4. Center Deck Pile
    if (id === 'table-deck-pile') {
      const el = document.getElementById('table-deck-pile');
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top };
      }
      return {
        x: window.innerWidth / 2 - 140,
        y: window.innerHeight / 2 - 74
      };
    }

    // 5. Center Discard Pile
    if (id === 'table-discard-pile') {
      const el = document.getElementById('table-discard-pile');
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top };
      }
      return {
        x: window.innerWidth / 2 + 80,
        y: window.innerHeight / 2 - 74
      };
    }

    // 6. Opponents on table
    const el = document.getElementById(id);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return {
          x: r.left + r.width / 2 - 52,
          y: r.top + r.height / 2 - 74
        };
      }
    }

    // Default table center
    return {
      x: window.innerWidth / 2 - 52,
      y: window.innerHeight / 2 - 74
    };
  };

  const spawnFlyingCard = (
    imageSrc: string,
    fromId: string,
    toId: string,
    durationMs: number = 300,
    rotation: number = 0,
    onComplete?: () => void
  ) => {
    const from = getTargetCoords(fromId);
    const to = getTargetCoords(toId);
    const id = `flying-${Date.now()}-${Math.random()}`;

    const newCard: FlyingCardInstance = {
      id,
      imageSrc,
      startX: from.x,
      startY: from.y,
      endX: to.x,
      endY: to.y,
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
    }, durationMs + 30);
  };

  // 1. ANIMAZIONE DI DISTRIBUZIONE INIZIALE (DEAL DI INIZIO PARTITA)
  useEffect(() => {
    if (isInitialDealing && !hasRunInitialDealRef.current) {
      hasRunInitialDealRef.current = true;
      soundManager.playRiffleShuffle();

      const targets = [...opponentIds.map(id => `table-opponent-${id}`), 'table-player-hand'];
      let delay = 250;

      for (let round = 0; round < 2; round++) {
        targets.forEach((targetId) => {
          setTimeout(() => {
            soundManager.playCardSlide();
            spawnFlyingCard(
              '/assets/ui/card_back.png',
              'table-deck-pile',
              targetId,
              260,
              (Math.random() - 0.5) * 6
            );
          }, delay);
          delay += 100;
        });
      }

      setTimeout(() => {
        onInitialDealComplete?.();
      }, delay + 300);
    }
  }, [isInitialDealing]);

  // 2. PESCA DI CARTE NELLA MANO: UNA ALLA VOLTA, CON IMMAGINE DELLA CARTA E ANNUNCIO!
  useEffect(() => {
    if (incomingDrawnCards && incomingDrawnCards.length > 0) {
      const batchKey = incomingDrawnCards.map(c => c.id).join('-');
      if (batchKey === lastDrawnBatchKeyRef.current) return;
      lastDrawnBatchKeyRef.current = batchKey;

      const total = incomingDrawnCards.length;

      incomingDrawnCards.forEach((card, idx) => {
        setTimeout(() => {
          soundManager.playCardSlide();

          // Mostra l'annuncio della carta che sta arrivando
          setDrawnToast({
            text: card.name,
            sub: `Carta ${idx + 1} di ${total}`
          });

          // Vola a faccia in su con la vera immagine della carta!
          spawnFlyingCard(
            `/assets/cards/${card.templateId}.png`,
            'table-deck-pile',
            'table-player-hand',
            320,
            (Math.random() - 0.5) * 4,
            () => {
              soundManager.playCardSlam();
              // Arrivata nella mano: la fa apparire nel dock della mano
              onCardDeliveredToHand?.(card);

              if (idx === total - 1) {
                setTimeout(() => {
                  setDrawnToast(null);
                  onAllDrawnCardsDelivered?.();
                }, 600);
              }
            }
          );
        }, idx * 460); // 460ms di intervallo: chiaramente visibili una alla volta!
      });
    }
  }, [incomingDrawnCards]);

  // 3. ANIMAZIONE AUTOMATICA DI PESCA PER GLI AVVERSARI (UNA ALLA VOLTA)
  useEffect(() => {
    if (turnPhase === 'draw' && !isInitialDealing && turnPlayerId !== myId) {
      const drawKey = `${turnPlayerId}-${Date.now()}`;
      if (lastDrawPhaseKeyRef.current && Date.now() - parseInt(lastDrawPhaseKeyRef.current.split('-')[1] || '0') < 2000) {
        return;
      }
      lastDrawPhaseKeyRef.current = drawKey;

      const targetId = `table-opponent-${turnPlayerId}`;

      // Prima carta all'avversario
      soundManager.playCardSlide();
      spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', targetId, 280, -3);

      // Seconda carta all'avversario dopo 380ms
      setTimeout(() => {
        soundManager.playCardSlide();
        spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', targetId, 280, 3);
      }, 380);
    }
  }, [turnPhase, turnPlayerId, myId, isInitialDealing]);

  // 4. ANIMAZIONE DI GIOCATA, TERRENO, ATTACCHI E SCARTI
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
      const isProperty = card.type === 'property';
      const isBushido = card.propertyType === 'bushido';
      const isTea = card.actionType === 'tea_ceremony';
      const isDaimyo = card.actionType === 'daimyo';

      soundManager.playCardSlide();

      // CASE A: CARTE TERRENO (PROPRIETA') -> Vanno direttamente sul terreno davanti alla mano!
      if (isProperty && !isBushido) {
        const fieldTarget =
          lastPlayedCard.sourcePlayerId === myId
            ? 'table-player-field'
            : `table-opponent-${lastPlayedCard.sourcePlayerId}`;

        spawnFlyingCard(
          `/assets/cards/${card.templateId}.png`,
          sourceId,
          fieldTarget,
          320,
          0,
          () => {
            soundManager.playCardSlam();
          }
        );
        return;
      }

      // CASE B: BUSHIDO -> Vola sul terreno dell'avversario mirato
      if (isBushido && lastPlayedCard.targetPlayerId) {
        const bushidoTarget =
          lastPlayedCard.targetPlayerId === myId
            ? 'table-player-field'
            : `table-opponent-${lastPlayedCard.targetPlayerId}`;

        spawnFlyingCard(
          `/assets/cards/${card.templateId}.png`,
          sourceId,
          bushidoTarget,
          320,
          0,
          () => {
            soundManager.playCardSlam();
          }
        );
        return;
      }

      // CASE C: ARMI, AZIONI, PARATA -> Volano sul panno centrale
      spawnFlyingCard(
        `/assets/cards/${card.templateId}.png`,
        sourceId,
        'table-play-zone',
        300,
        (Math.random() - 0.5) * 5,
        () => {
          soundManager.playCardSlam();
          setActivePlayCard(card);

          // Fendente d'attacco direzionale verso l'avversario
          if (isWeapon && lastPlayedCard.targetPlayerId) {
            const targetId =
              lastPlayedCard.targetPlayerId === myId
                ? 'table-player-hand'
                : `table-opponent-${lastPlayedCard.targetPlayerId}`;

            const playCoords = getTargetCoords('table-play-zone');
            const targetCoords = getTargetCoords(targetId);

            const startX = playCoords.x + 52;
            const startY = playCoords.y + 74;
            const endX = targetCoords.x + 52;
            const endY = targetCoords.y + 74;

            const distance = Math.hypot(endX - startX, endY - startY);
            const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;

            soundManager.playSwordSlash();
            setActiveSlash({ startX, startY, distance, angle });

            setTimeout(() => {
              setActiveSlash(null);
              soundManager.playTaiko();
            }, 260);
          }

          // Effetto parata
          if (isParry) {
            const playCoords = getTargetCoords('table-play-zone');
            setClashEffect({
              x: playCoords.x + 52,
              y: playCoords.y + 74
            });
            soundManager.playParryClash();
            setTimeout(() => setClashEffect(null), 350);
          }

          // Cerimonia del te
          if (isTea) {
            setTimeout(() => {
              for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                  soundManager.playCardSlide();
                  spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', sourceId, 260, -3 + i * 3);
                }, i * 160);
              }
              // Invia 1 carta dal mazzo a OGNI ALTRO giocatore sul tavolo (inclusa la tua mano!)
              const otherTargetIds = [
                ...opponentIds.map(id => `table-opponent-${id}`),
                'table-player-hand'
              ].filter(id => id !== sourceId);

              otherTargetIds.forEach((targetId, idx) => {
                setTimeout(() => {
                  soundManager.playCardSlide();
                  spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', targetId, 260);
                }, 200 + idx * 100);
              });
            }, 350);
          }

          // Daimyo
          if (isDaimyo) {
            setTimeout(() => {
              for (let i = 0; i < 2; i++) {
                setTimeout(() => {
                  soundManager.playCardSlide();
                  spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', sourceId, 260, i === 0 ? -3 : 3);
                }, i * 180);
              }
            }, 300);
          }

          // La carta usata scivola nella pila degli scarti in sovraimpressione
          setTimeout(() => {
            setActivePlayCard(null);
            soundManager.playCardSlide();
            spawnFlyingCard(
              `/assets/cards/${card.templateId}.png`,
              'table-play-zone',
              'table-discard-pile',
              280,
              (Math.random() - 0.5) * 6
            );
          }, 1000);
        }
      );
    }
  }, [lastPlayedCard?.timestamp]);

  return (
    <>
      {/* Carte in volo: dimensioni ampie (104x148px) con animazione scattante e fluida */}
      {flyingCards.map(c => {
        const deltaX = c.endX - c.startX;
        const deltaY = c.endY - c.startY;

        return (
          <div
            key={c.id}
            style={{
              position: 'fixed',
              left: c.startX,
              top: c.startY,
              width: '104px',
              height: '148px',
              zIndex: 75,
              pointerEvents: 'none',
              transform: c.active
                ? `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${c.rotation}deg)`
                : 'translate3d(0, 0, 0) rotate(0deg)',
              transition: `transform ${c.durationMs}ms cubic-bezier(0.15, 0.9, 0.25, 1), opacity ${c.durationMs}ms ease-out`,
              opacity: c.active ? 1 : 0.95
            }}
            className="rounded-lg shadow-[0_15px_30px_rgba(0,0,0,0.85)] overflow-hidden border border-amber-600/70 bg-slate-900"
          >
            <img
              src={c.imageSrc}
              alt="Carta in volo"
              className="w-full h-full object-cover object-center block"
            />
          </div>
        );
      })}

      {/* Raggio fendente dell'arma verso il bersaglio */}
      {activeSlash && (
        <div
          style={{
            position: 'fixed',
            left: activeSlash.startX,
            top: activeSlash.startY,
            width: `${activeSlash.distance}px`,
            height: '6px',
            transformOrigin: '0 50%',
            transform: `rotate(${activeSlash.angle}deg)`,
            zIndex: 85,
            pointerEvents: 'none'
          }}
          className="bg-gradient-to-r from-amber-300 via-red-500 to-white shadow-[0_0_35px_#ef4444] rounded-full animate-slashStrike"
        />
      )}

      {/* Scintille dello scontro di Parata */}
      {clashEffect && (
        <div
          style={{
            position: 'fixed',
            left: clashEffect.x - 40,
            top: clashEffect.y - 40,
            width: '80px',
            height: '80px',
            zIndex: 90,
            pointerEvents: 'none'
          }}
          className="flex items-center justify-center animate-ping"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-300 via-white to-blue-400 shadow-[0_0_40px_#f59e0b]" />
        </div>
      )}

      {/* CARTA GIOCATA: Mostrata in SOVRAIMPRESSIONE al centro tavolo */}
      {activePlayCard && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 65,
            pointerEvents: 'none'
          }}
          className="animate-fadeIn drop-shadow-[0_20px_40px_rgba(0,0,0,0.95)]"
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
