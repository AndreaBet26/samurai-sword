import React, { useEffect, useState, useRef } from 'react';
import { CardDef, LastPlayedCardAnim } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { soundManager } from '../utils/soundEffects';
import { Sparkles } from 'lucide-react';

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
  turnOrder?: string[];
  opponentIds?: string[];
  isInitialDealing?: boolean;
  initialHandCards?: CardDef[];
  incomingDrawnCards?: CardDef[];
  onCardDeliveredToHand?: (card: CardDef) => void;
  onOpponentCardDelivered?: (playerId: string) => void;
  onAllDrawnCardsDelivered?: () => void;
  onInitialDealProgress?: (current: number, total: number) => void;
  onInitialDealComplete?: () => void;
  onInspectCard?: (card: CardDef) => void;
}

export const TableCardAnimator: React.FC<TableCardAnimatorProps> = ({
  lastPlayedCard,
  turnPhase,
  turnPlayerId,
  myId,
  turnOrder = [],
  opponentIds = [],
  isInitialDealing = false,
  initialHandCards = [],
  incomingDrawnCards = [],
  onCardDeliveredToHand,
  onOpponentCardDelivered,
  onAllDrawnCardsDelivered,
  onInitialDealProgress,
  onInitialDealComplete
}) => {
  const [flyingCards, setFlyingCards] = useState<FlyingCardInstance[]>([]);
  const [activePlayCard, setActivePlayCard] = useState<CardDef | null>(null);
  const [activePlayCardInfo, setActivePlayCardInfo] = useState<{ sourceName: string; actionText: string } | null>(null);
  const [activeSlash, setActiveSlash] = useState<SlashStrike | null>(null);
  const [clashEffect, setClashEffect] = useState<{ x: number; y: number } | null>(null);
  const [drawnToast, setDrawnToast] = useState<{ text: string; sub: string; templateId?: string } | null>(null);

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
        return { x: r.left + r.width / 2 - 52, y: r.top + r.height / 2 - 74 };
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
        return { x: r.left + r.width / 2 - 52, y: r.top + r.height / 2 - 74 };
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
        return { x: r.left + r.width / 2 - 52, y: r.top + r.height / 2 - 74 };
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
    durationMs: number = 460,
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
    }, durationMs + 40);
  };

  // 1. ANIMAZIONE DI DISTRIBUZIONE INIZIALE (DEAL COMPLETO A TUTTI I GIOCATORI PRIMA DI GIOCARE!)
  useEffect(() => {
    if (!isInitialDealing || hasRunInitialDealRef.current) return;
    if (!initialHandCards || initialHandCards.length === 0) return;

    hasRunInitialDealRef.current = true;
    soundManager.playRiffleShuffle();

    // Determina l'ordine del tavolo: Shogun per primo, poi in senso orario
    const seating = turnOrder.length > 0 ? turnOrder : [myId, ...opponentIds];
    
    // Regole ufficiali Samurai Sword:
    // Shogun (indice 0): 4 carte
    // Giocatori 2 & 3 (indici 1, 2): 5 carte
    // Giocatori 4 & 5 (indici 3, 4): 6 carte
    // Giocatori 6 & 7 (indici 5, 6): 7 carte
    const dealSteps: { playerId: string; round: number; card?: CardDef }[] = [];
    let myCardIndex = 0;

    for (let r = 0; r < 7; r++) {
      seating.forEach((pId, seatIdx) => {
        let targetCards = 4;
        if (seatIdx === 1 || seatIdx === 2) targetCards = 5;
        else if (seatIdx === 3 || seatIdx === 4) targetCards = 6;
        else if (seatIdx >= 5) targetCards = 7;

        if (r < targetCards) {
          if (pId === myId) {
            const myCard = initialHandCards[myCardIndex];
            myCardIndex++;
            dealSteps.push({ playerId: pId, round: r, card: myCard });
          } else {
            dealSteps.push({ playerId: pId, round: r });
          }
        }
      });
    }

    const totalSteps = dealSteps.length;
    const stepInterval = 230; // 230ms tra ogni carta per un ritmo calmo e maestoso
    let currentDelay = 400;

    dealSteps.forEach((step, idx) => {
      setTimeout(() => {
        soundManager.playCardSlide();
        onInitialDealProgress?.(idx + 1, totalSteps);

        if (step.playerId === myId) {
          // Carta per la mano del giocatore locale (atterra a faccia in su con vera immagine)
          const imgSrc = step.card
            ? `/assets/cards/${step.card.templateId}.png`
            : '/assets/ui/card_back.png';

          spawnFlyingCard(
            imgSrc,
            'table-deck-pile',
            'table-player-hand',
            460,
            (Math.random() - 0.5) * 4,
            () => {
              soundManager.playCardSlam();
              if (step.card) {
                onCardDeliveredToHand?.(step.card);
              }
            }
          );
        } else {
          // Carta per l'avversario (atterra sul suo posto a faccia in giù)
          spawnFlyingCard(
            '/assets/ui/card_back.png',
            'table-deck-pile',
            `table-opponent-${step.playerId}`,
            440,
            (Math.random() - 0.5) * 6,
            () => {
              onOpponentCardDelivered?.(step.playerId);
            }
          );
        }
      }, currentDelay);

      currentDelay += stepInterval;
    });

    // A completamento della distribuzione di tutte le carte a tutti
    setTimeout(() => {
      soundManager.playTaiko();
      onInitialDealComplete?.();
    }, currentDelay + 600);
  }, [isInitialDealing, initialHandCards, turnOrder, opponentIds, myId]);

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

          setDrawnToast({
            text: card.name,
            sub: `Carta ${idx + 1} di ${total}`,
            templateId: card.templateId
          });

          // Vola a faccia in su con la vera immagine della carta in modo ultra-fluido!
          spawnFlyingCard(
            `/assets/cards/${card.templateId}.png`,
            'table-deck-pile',
            'table-player-hand',
            480,
            (Math.random() - 0.5) * 4,
            () => {
              soundManager.playCardSlam();
              onCardDeliveredToHand?.(card);

              if (idx === total - 1) {
                setTimeout(() => {
                  setDrawnToast(null);
                  onAllDrawnCardsDelivered?.();
                }, 800);
              }
            }
          );
        }, idx * 480);
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
      spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', targetId, 440, -3);

      // Seconda carta all'avversario dopo 400ms
      setTimeout(() => {
        soundManager.playCardSlide();
        spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', targetId, 440, 3);
      }, 400);
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
          480,
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
          480,
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
        480,
        (Math.random() - 0.5) * 4,
        () => {
          soundManager.playCardSlam();
          setActivePlayCard(card);
          setActivePlayCardInfo({
            sourceName: lastPlayedCard.sourcePlayerName,
            actionText: lastPlayedCard.actionText
          });

          // Fendente d'attacco direzionale verso il bersaglio
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

            setTimeout(() => {
              soundManager.playSwordSlash();
              setActiveSlash({ startX, startY, distance, angle });

              // Target impact shake
              const targetEl = document.getElementById(targetId);
              if (targetEl) {
                targetEl.classList.add('animate-shake');
                setTimeout(() => targetEl.classList.remove('animate-shake'), 450);
              }

              setTimeout(() => {
                setActiveSlash(null);
                soundManager.playTaiko();
              }, 320);
            }, 300);
          }

          // Effetto parata
          if (isParry) {
            const playCoords = getTargetCoords('table-play-zone');
            setClashEffect({
              x: playCoords.x + 52,
              y: playCoords.y + 74
            });
            soundManager.playParryClash();
            setTimeout(() => setClashEffect(null), 450);
          }

          // Cerimonia del te
          if (isTea) {
            setTimeout(() => {
              for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                  soundManager.playCardSlide();
                  spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', sourceId, 380, -3 + i * 3);
                }, i * 200);
              }
              const otherTargetIds = [
                ...opponentIds.map(id => `table-opponent-${id}`),
                'table-player-hand'
              ].filter(id => id !== sourceId);

              otherTargetIds.forEach((targetId, idx) => {
                setTimeout(() => {
                  soundManager.playCardSlide();
                  spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', targetId, 380);
                }, 250 + idx * 140);
              });
            }, 400);
          }

          // Daimyo
          if (isDaimyo) {
            setTimeout(() => {
              for (let i = 0; i < 2; i++) {
                setTimeout(() => {
                  soundManager.playCardSlide();
                  spawnFlyingCard('/assets/ui/card_back.png', 'table-deck-pile', sourceId, 380, i === 0 ? -3 : 3);
                }, i * 220);
              }
            }, 350);
          }

          // La carta usata resta visibile al centro per essere letta, poi scivola dolcemente negli scarti
          setTimeout(() => {
            setActivePlayCard(null);
            setActivePlayCardInfo(null);
            soundManager.playCardSlide();
            spawnFlyingCard(
              `/assets/cards/${card.templateId}.png`,
              'table-play-zone',
              'table-discard-pile',
              440,
              (Math.random() - 0.5) * 6
            );
          }, 1600); // 1.6s visibile in centro con banner
        }
      );
    }
  }, [lastPlayedCard?.timestamp]);

  return (
    <>
      {/* Carte in volo: dimensioni 104x148px con fisica ultra-fluida ed elevazione tridimensionale */}
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
                ? `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${c.rotation}deg) scale(1)`
                : 'translate3d(0, 0, 0) rotate(0deg) scale(1.08)',
              transition: `transform ${c.durationMs}ms cubic-bezier(0.18, 0.89, 0.32, 1), opacity ${c.durationMs}ms ease-out`,
              boxShadow: c.active
                ? '0 10px 24px rgba(0,0,0,0.75)'
                : '0 25px 45px rgba(0,0,0,0.9)',
              opacity: c.active ? 1 : 0.96
            }}
            className="rounded-lg overflow-hidden border border-amber-600/70 bg-slate-900"
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
            height: '7px',
            transformOrigin: '0 50%',
            transform: `rotate(${activeSlash.angle}deg)`,
            zIndex: 85,
            pointerEvents: 'none'
          }}
          className="bg-gradient-to-r from-amber-300 via-red-500 to-white shadow-[0_0_40px_#ef4444] rounded-full animate-slashStrike"
        />
      )}

      {/* Scintille dello scontro di Parata */}
      {clashEffect && (
        <div
          style={{
            position: 'fixed',
            left: clashEffect.x - 45,
            top: clashEffect.y - 45,
            width: '90px',
            height: '90px',
            zIndex: 90,
            pointerEvents: 'none'
          }}
          className="flex items-center justify-center animate-ping"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-r from-amber-300 via-white to-blue-400 shadow-[0_0_45px_#f59e0b]" />
        </div>
      )}

      {/* CARTA GIOCATA: Mostrata al centro tavolo con banner illustrativo elegante */}
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
          className="flex flex-col items-center gap-2 animate-fadeIn"
        >
          <div className="rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.95)] ring-4 ring-amber-400/80 bg-slate-950">
            <TabletopCard
              imageSrc={`/assets/cards/${activePlayCard.templateId}.png`}
              fallbackText={activePlayCard.name}
              size="md"
              isSelected={true}
            />
          </div>

          {activePlayCardInfo && (
            <div className="bg-black/90 border border-amber-500/80 text-amber-200 px-4 py-1.5 rounded-full text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 max-w-sm text-center">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{activePlayCardInfo.actionText}</span>
            </div>
          )}
        </div>
      )}

      {/* TOAST DELLA CARTA PESCATA: elegante indicatore visivo della carta che entra nella mano */}
      {drawnToast && (
        <div className="fixed bottom-48 left-1/2 -translate-x-1/2 z-80 bg-slate-900/95 border border-amber-500/80 text-amber-300 px-5 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fadeIn pointer-events-none">
          {drawnToast.templateId && (
            <div className="w-6 h-8 rounded overflow-hidden border border-amber-400/60 shrink-0">
              <img
                src={`/assets/cards/${drawnToast.templateId}.png`}
                alt={drawnToast.text}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex flex-col text-left">
            <span className="text-xs font-black text-slate-100">+1 {drawnToast.text}</span>
            <span className="text-[10px] text-amber-400 font-semibold">{drawnToast.sub}</span>
          </div>
        </div>
      )}
    </>
  );
};
