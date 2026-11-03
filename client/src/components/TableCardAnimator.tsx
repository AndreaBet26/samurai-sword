import React, { useEffect, useState, useRef } from 'react';
import { CardDef, LastPlayedCardAnim } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { soundManager } from '../utils/soundEffects';
import { getTableScale, getAnimRate } from '../utils/tableLayout';
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

  /** Livello (fuori dalla scena scalata) dove volano le carte: coordinate dello schermo */
  const layerRef = useRef<HTMLDivElement>(null);

  /** Centro di un elemento del tavolo sullo schermo */
  const getTargetCoords = (id: string): { x: number; y: number } => {
    const el = document.getElementById(id);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        // La mano: le carte arrivano nella parte bassa, dove stanno le carte
        if (id === 'table-player-hand') return { x: r.left + r.width / 2, y: r.bottom - r.height * 0.42 };
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  };

  /**
   * Carta che vola da un punto all'altro del tavolo con una traiettoria ad arco,
   * un leggero sollevamento a metà strada e un atterraggio morbido (Web Animations API).
   */
  const spawnFlyingCard = (
    imageSrc: string,
    fromId: string,
    toId: string,
    durationMs: number = 520,
    rotation: number = 0,
    onComplete?: () => void
  ) => {
    const layer = layerRef.current;
    const from = getTargetCoords(fromId);
    const to = getTargetCoords(toId);
    const s = getTableScale();
    durationMs = durationMs / getAnimRate();
    const w = 104 * s;
    const h = 148 * s;
    if (!layer) {
      onComplete?.();
      return;
    }
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: `${w}px`,
      height: `${h}px`,
      borderRadius: `${8 * s}px`,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '75',
      willChange: 'transform',
      boxShadow: '0 14px 28px rgba(0,0,0,0.55)',
      border: '1px solid rgba(217,119,6,0.6)',
      background: '#0f172a'
    });
    el.innerHTML = `<img src="${imageSrc}" alt="" style="width:100%;height:100%;object-fit:cover;display:block" />`;
    layer.appendChild(el);

    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const arc = Math.min(140, dist * 0.18) * s * 1.4;
    const p = (x: number, y: number) => `translate(${x - w / 2}px, ${y - h / 2}px)`;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - arc;
    const anim = el.animate(
      [
        { transform: `${p(from.x, from.y)} rotate(0deg) scale(1)`, offset: 0 },
        { transform: `${p(midX, midY)} rotate(${rotation * 0.6}deg) scale(1.08)`, offset: 0.5 },
        { transform: `${p(to.x, to.y)} rotate(${rotation}deg) scale(1)`, offset: 1 }
      ],
      { duration: durationMs, easing: 'cubic-bezier(0.33, 0, 0.15, 1)', fill: 'forwards' }
    );
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.remove();
      onComplete?.();
    };
    anim.onfinish = finish;
    setTimeout(finish, durationMs + 200); // sicurezza se la scheda è in background
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
            ? `/assets/cards/${step.card.templateId}.webp`
            : '/assets/ui/card_back.webp';

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
            '/assets/ui/card_back.webp',
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
      soundManager.play('cardPlace');
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

          // Vola a faccia in su con la vera immagine della carta in modo ultra-fluido!
          spawnFlyingCard(
            `/assets/cards/${card.templateId}.webp`,
            'table-deck-pile',
            'table-player-hand',
            480,
            (Math.random() - 0.5) * 4,
            () => {
              soundManager.playCardSlam();
              onCardDeliveredToHand?.(card);

              if (idx === total - 1) {
                setTimeout(() => onAllDrawnCardsDelivered?.(), 300);
              }
            }
          );
        }, idx * 480);
      });
    }
  }, [incomingDrawnCards]);

  // 3. La pesca degli avversari ora è animata da EffectsLayer (eventi "draw" dal server, numero esatto di carte)

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
            : `table-field-${lastPlayedCard.sourcePlayerId}`;

        spawnFlyingCard(
          `/assets/cards/${card.templateId}.webp`,
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
            : `table-field-${lastPlayedCard.targetPlayerId}`;

        spawnFlyingCard(
          `/assets/cards/${card.templateId}.webp`,
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
        `/assets/cards/${card.templateId}.webp`,
        sourceId,
        'table-play-zone',
        480,
        (Math.random() - 0.5) * 4,
        () => {
          soundManager.play(card.actionType === 'battle_cry' ? 'battleCry' : 'cardPlace');
          setActivePlayCard(card);

          // Taglio, parata e carte pescate sono animati da EffectsLayer (un solo effetto per azione)

          // La carta usata resta visibile al centro per essere letta, poi scivola dolcemente negli scarti
          setTimeout(() => {
            setActivePlayCard(null);
            soundManager.playCardSlide();
            spawnFlyingCard(
              `/assets/cards/${card.templateId}.webp`,
              'table-play-zone',
              'table-discard-pile',
              440,
              (Math.random() - 0.5) * 6
            );
          }, 1300 / getAnimRate()); // la carta resta leggibile al centro, poi va negli scarti
        }
      );
    }
  }, [lastPlayedCard?.timestamp]);

  return (
    <>
      {/* Livello delle carte in volo */}
      <div ref={layerRef} className="fixed inset-0 pointer-events-none z-[75]" aria-hidden="true" />

      {/* Raggio fendente dell'arma verso il bersaglio */}

      {/* Scintille dello scontro di Parata */}

      {/* CARTA GIOCATA: Mostrata al centro tavolo con banner illustrativo elegante */}
      {activePlayCard && (
        <div
          style={{
            position: 'fixed',
            left: getTargetCoords('table-play-zone').x,
            top: getTargetCoords('table-play-zone').y,
            transform: `translate(-50%, -50%) scale(${getTableScale() * 1.15})`,
            zIndex: 65,
            pointerEvents: 'none'
          }}
          className="flex flex-col items-center gap-2 card-showcase"
        >
          <div className="rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.95)] ring-4 ring-amber-400/80 bg-slate-950">
            <TabletopCard
              imageSrc={`/assets/cards/${activePlayCard.templateId}.webp`}
              fallbackText={activePlayCard.name}
              size="md"
              isSelected={true}
            />
          </div>

        </div>
      )}

    </>
  );
};
