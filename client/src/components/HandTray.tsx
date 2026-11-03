import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getTableScale } from '../utils/tableLayout';
import { CardDef } from '../../../shared/types';
import { TabletopCard } from './TabletopCard';
import { Shield, Trash2 } from 'lucide-react';
import { soundManager } from '../utils/soundEffects';

/**
 * LA TUA MANO
 *
 * - Carte grandi, a ventaglio, come tenute in mano.
 * - Trascina una carta a destra o a sinistra dentro la mano per riordinarla come preferisci
 *   (l'ordine resta finché giochi).
 * - Trascina una carta verso il tavolo per giocarla: se la lasci sopra un avversario, lui è il bersaglio.
 * - Un semplice clic apre la carta ingrandita (come prima).
 * Funziona con mouse e touch (Pointer Events).
 */

interface HandTrayProps {
  cards: CardDef[];
  isMyTurn: boolean;
  isUnderAttack?: boolean;
  /** Tipo di richiesta in corso: serve a scrivere l'etichetta giusta sulle carte utilizzabili */
  reactionType?: 'parry_weapon' | 'battle_cry' | 'jujutsu' | 'bushido' | null;
  eligibleReactionCardIds?: string[];
  isDiscardPhase?: boolean;
  selectedDiscardIds?: string[];
  selectedCardId?: string | null;
  onCardClick: (card: CardDef) => void;
  /** Carte che adesso non si possono giocare (id -> motivo): restano in mano un po' più basse e spente */
  blockedReasons?: Record<string, string>;
  /** Passaggio del mouse su una carta (per mostrare il motivo al centro del tavolo) */
  onHoverCard?: (card: CardDef | null) => void;
  /** Carta trascinata e lasciata sul tavolo (targetPlayerId se lasciata sopra un avversario) */
  onDropToTable?: (card: CardDef, targetPlayerId: string | null) => void;
  /** Inizio/fine trascinamento verso il tavolo (per evidenziare bersagli e zona di gioco) */
  onDragToTableChange?: (card: CardDef | null, hoveredPlayerId: string | null) => void;
}

interface DragState {
  card: CardDef;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  mode: 'reorder' | 'play';
  insertIndex: number;
  hoveredPlayerId: string | null;
}

const DRAG_THRESHOLD = 8;

export const HandTray: React.FC<HandTrayProps> = ({
  cards,
  isMyTurn,
  isUnderAttack = false,
  reactionType = null,
  eligibleReactionCardIds = [],
  isDiscardPhase = false,
  selectedDiscardIds = [],
  selectedCardId = null,
  onCardClick,
  blockedReasons = {},
  onHoverCard,
  onDropToTable,
  onDragToTableChange
}) => {
  const [orderedHand, setOrderedHand] = useState<CardDef[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Mantiene l'ordine scelto dal giocatore: le carte nuove vanno in fondo, quelle giocate spariscono
  useEffect(() => {
    setOrderedHand(prev => {
      const currentIds = new Set(cards.map(c => c.id));
      const kept = prev.filter(c => currentIds.has(c.id));
      const newCards = cards.filter(c => !kept.some(k => k.id === c.id));
      return [...kept, ...newCards];
    });
  }, [cards]);

  const setDragBoth = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  /** In quale posizione della mano andrebbe la carta, in base alla x del puntatore */
  const computeInsertIndex = (x: number, draggedId: string): number => {
    const others = orderedHand.filter(c => c.id !== draggedId);
    let idx = others.length;
    for (let i = 0; i < others.length; i++) {
      const el = cardRefs.current.get(others[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x < r.left + r.width / 2) {
        idx = i;
        break;
      }
    }
    return idx;
  };

  /** Avversario sotto il puntatore (per giocare direttamente su di lui) */
  const playerUnderPointer = (x: number, y: number): string | null => {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const seat = (el as HTMLElement).closest?.('[id^="table-opponent-"]') as HTMLElement | null;
      if (seat) return seat.id.replace('table-opponent-', '');
    }
    return null;
  };

  // I movimenti si ascoltano su window: durante il riordino la carta cambia posto nel DOM
  // e un "pointer capture" sull'elemento andrebbe perso.
  const handlersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; cancel: (e: PointerEvent) => void } | null>(null);
  const detachWindow = () => {
    const h = handlersRef.current;
    if (!h) return;
    window.removeEventListener('pointermove', h.move);
    window.removeEventListener('pointerup', h.up);
    window.removeEventListener('pointercancel', h.cancel);
    handlersRef.current = null;
  };
  useEffect(() => detachWindow, []);

  const onPointerDown = (e: React.PointerEvent, card: CardDef) => {
    if (e.button !== 0) return;
    detachWindow();
    const h = {
      move: (ev: PointerEvent) => onPointerMoveRef.current(ev),
      up: (ev: PointerEvent) => {
        detachWindow();
        finishDragRef.current(ev, false);
      },
      cancel: (ev: PointerEvent) => {
        detachWindow();
        finishDragRef.current(ev, true);
      }
    };
    handlersRef.current = h;
    window.addEventListener('pointermove', h.move);
    window.addEventListener('pointerup', h.up);
    window.addEventListener('pointercancel', h.cancel);
    setDragBoth({
      card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      mode: 'reorder',
      insertIndex: orderedHand.findIndex(c => c.id === card.id),
      hoveredPlayerId: null
    });
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (!d.active && dist < DRAG_THRESHOLD) return;

    const handTop = containerRef.current?.getBoundingClientRect().top ?? window.innerHeight - 220;
    // Sopra la mano = stai portando la carta sul tavolo
    const mode: DragState['mode'] = e.clientY < handTop + 30 ? 'play' : 'reorder';
    const hoveredPlayerId = mode === 'play' ? playerUnderPointer(e.clientX, e.clientY) : null;
    const next: DragState = {
      ...d,
      x: e.clientX,
      y: e.clientY,
      active: true,
      mode,
      hoveredPlayerId,
      insertIndex: mode === 'reorder' ? computeInsertIndex(e.clientX, d.card.id) : d.insertIndex
    };
    if (!d.active) soundManager.playCardSlide();
    if (mode !== d.mode || hoveredPlayerId !== d.hoveredPlayerId || !d.active) {
      onDragToTableChange?.(mode === 'play' ? d.card : null, hoveredPlayerId);
    }
    setDragBoth(next);
  };

  const finishDrag = (e: PointerEvent, cancelled = false) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setDragBoth(null);
    onDragToTableChange?.(null, null);

    if (!d.active) {
      if (!cancelled) {
        soundManager.playCardSlide();
        onCardClick(d.card);
      }
      return;
    }
    if (cancelled) return;

    if (d.mode === 'play') {
      onDropToTable?.(d.card, d.hoveredPlayerId);
    } else {
      // Riordino della mano
      setOrderedHand(prev => {
        const without = prev.filter(c => c.id !== d.card.id);
        without.splice(Math.min(d.insertIndex, without.length), 0, d.card);
        return without;
      });
      soundManager.playCardSlam();
    }
  };

  const onPointerMoveRef = useRef(onPointerMove);
  onPointerMoveRef.current = onPointerMove;
  const finishDragRef = useRef(finishDrag);
  finishDragRef.current = finishDrag;

  // Ordine mostrato: durante il riordino la carta trascinata "fa spazio" nella posizione d'arrivo
  let displayHand = orderedHand;
  if (drag?.active && drag.mode === 'reorder') {
    const without = orderedHand.filter(c => c.id !== drag.card.id);
    without.splice(Math.min(drag.insertIndex, without.length), 0, drag.card);
    displayHand = without;
  }

  const n = displayHand.length;
  // Sovrapposizione in base al numero di carte (carte da 150px)
  const overlap = n <= 4 ? 10 : n <= 6 ? -34 : n <= 8 ? -56 : -72;

  return (
    <div
      ref={containerRef}
      id="table-player-hand"
      className="relative w-full flex items-end justify-center select-none pointer-events-auto h-[240px] pb-2"
    >
      <div className="relative flex items-end justify-center h-[225px] w-full px-4 overflow-visible">
        {displayHand.map((card, idx) => {
          const isParryCandidate = isUnderAttack && eligibleReactionCardIds.includes(card.id);
          const isDiscardSelected = isDiscardPhase && selectedDiscardIds.includes(card.id);
          const isSelected = selectedCardId === card.id;
          const isDragged = drag?.active && drag.card.id === card.id;

          // Ventaglio: leggera rotazione e curvatura come una mano vera
          const mid = (n - 1) / 2;
          const off = idx - mid;
          const angle = off * (n > 6 ? 2.6 : 3.5);
          const k = n > 6 ? 1.2 : 2;
          // Le carte al centro si alzano, quelle ai lati restano sulla linea di base (nessuna carta tagliata)
          const lift = Math.abs(off) * Math.abs(off) * k - mid * mid * k;

          return (
            <div
              key={card.id}
              ref={el => {
                if (el) cardRefs.current.set(card.id, el);
                else cardRefs.current.delete(card.id);
              }}
              style={{
                marginLeft: idx === 0 ? 0 : `${overlap}px`,
                zIndex: isSelected ? 50 : isParryCandidate ? 45 : isDiscardSelected ? 40 : idx + 1,
                transform: `translateY(${lift}px) rotate(${angle}deg)`,
                transformOrigin: 'bottom center',
                transition: 'margin 300ms cubic-bezier(0.22, 1, 0.36, 1), transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms',
                opacity: isDragged ? (drag?.mode === 'play' ? 0.15 : 0.45) : 1,
                touchAction: 'none'
              }}
              className="relative shrink-0"
              onPointerDown={e => onPointerDown(e, card)}
              onMouseEnter={() => !drag?.active && onHoverCard?.(card)}
              onMouseLeave={() => onHoverCard?.(null)}
              onDragStart={e => e.preventDefault()}
            >
              {isParryCandidate && (
                <div
                  className={`absolute -top-5 left-1/2 -translate-x-1/2 font-black text-[11px] uppercase flex items-center gap-1 z-50 pointer-events-none whitespace-nowrap seat-label ${
                    reactionType === 'jujutsu' || reactionType === 'bushido' ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  {reactionType === 'jujutsu' || reactionType === 'bushido' ? (
                    // Jiujitsu e Bushido NON si parano: si scarta un'arma
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Scarta
                    </>
                  ) : card.type === 'weapon' ? (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      Para con l'arma (Hanzō)
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      Parata
                    </>
                  )}
                </div>
              )}
              {isDiscardSelected && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-red-400 font-black text-[11px] uppercase flex items-center gap-1 z-50 pointer-events-none seat-label">
                  <Trash2 className="w-3.5 h-3.5" />
                  Scarta
                </div>
              )}

              <div
                className={`transition-all duration-300 ease-out ${drag?.active ? 'cursor-grabbing' : 'cursor-grab'} ${
                  isParryCandidate
                    ? '-translate-y-6 scale-105 ring-4 ring-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.9)] rounded-xl'
                    : isDiscardSelected
                      ? '-translate-y-5 ring-4 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] rounded-xl'
                      : isSelected
                        ? '-translate-y-6 scale-105 ring-4 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.8)] rounded-xl'
                        : isUnderAttack
                          ? 'opacity-35 grayscale-[30%]'
                          : drag?.active
                            ? ''
                            : blockedReasons[card.id]
                              ? 'translate-y-4 brightness-[0.62] saturate-[0.55] hover:translate-y-1'
                              : 'hover:-translate-y-8 hover:scale-105'
                }`}
              >
                <TabletopCard imageSrc={`/assets/cards/${card.templateId}.webp`} fallbackText={card.name} size="hand" isHoverable={false} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Carta che segue il puntatore mentre la trascini (fuori dalla scena scalata, in coordinate schermo) */}
      {drag?.active &&
        createPortal(
        <div
          className="fixed pointer-events-none z-[120]"
          style={{
            left: drag.x,
            top: drag.y,
            transform: `translate(-50%, -60%) rotate(${drag.mode === 'play' ? -4 : 0}deg) scale(${(drag.mode === 'play' ? 0.85 : 1) * getTableScale()})`,
            transition: 'transform 150ms ease-out',
            filter:
              drag.mode === 'play'
                ? 'drop-shadow(0 0 18px rgba(251,191,36,0.85)) drop-shadow(0 18px 24px rgba(0,0,0,0.8))'
                : 'drop-shadow(0 18px 24px rgba(0,0,0,0.8))'
          }}
        >
          <TabletopCard imageSrc={`/assets/cards/${drag.card.templateId}.webp`} fallbackText={drag.card.name} size="hand" />
          {drag.mode === 'play' && (
            <div className="mt-1 text-center text-amber-200 text-xs font-black seat-label whitespace-nowrap">
              {drag.hoveredPlayerId ? 'Rilascia sul bersaglio' : 'Rilascia per giocare'}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
