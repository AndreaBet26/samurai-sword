/**
 * GEOMETRIA DEL TAVOLO
 *
 * Il tavolo è disegnato su una "scena" di misura fissa (STAGE_W × STAGE_H) che viene poi
 * ridimensionata per riempire lo schermo: così la disposizione è identica su ogni monitor.
 *
 * Tu sei sempre in basso al centro. Gli altri si siedono attorno al tavolo, in senso orario
 * a partire dalla tua sinistra:
 *   - ai lati: posti ruotati di 90°, vicini ai bordi dello schermo, con le carte rivolte verso il centro
 *   - in alto (di fronte e in diagonale): posti dritti, uno accanto all'altro
 * Ogni posto è una colonna che va dal bordo del tavolo verso il centro:
 *   personaggio + ruolo + gettoni  →  carte in mano (coperte)  →  carte giocate
 */

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/** Centro del tavolo: mazzo, scarti, riserva dei gettoni */
export const TABLE_CENTER = { x: 960, y: 435 };

export interface SeatGeometry {
  /** Centro del posto sulla scena */
  x: number;
  y: number;
  /** Rotazione del posto (gradi): 0 in alto, 90 a sinistra, -90 a destra */
  rotation: number;
  /** true = posto in alto: il centro del tavolo è verso il basso dello schermo */
  facingDown: boolean;
  /** Scala del posto (con molti giocatori i posti sono un po' più piccoli) */
  scale: number;
}

type Slot = { x: number; y: number; side: 'left' | 'top' | 'right' };

// I giocatori a sinistra e a destra sono posizionati vicino ai bordi dello schermo per liberare spazio al centro
const LEFT_X = 135;
const RIGHT_X = STAGE_W - LEFT_X; // 1785
const TOP_Y = 205;

/** Posti degli avversari in ordine di turno (il primo è alla tua sinistra) */
function slots(count: number): Slot[] {
  const left = (ys: number[]): Slot[] => ys.map(y => ({ x: LEFT_X, y, side: 'left' as const }));
  const right = (ys: number[]): Slot[] => ys.map(y => ({ x: RIGHT_X, y, side: 'right' as const }));
  const top = (xs: number[]): Slot[] => xs.map(x => ({ x, y: TOP_Y, side: 'top' as const }));
  switch (count) {
    case 0:
      return [];
    case 1:
      return top([960]);
    case 2:
      return [...left([470]), ...right([470])];
    case 3:
      return [...left([470]), ...top([960]), ...right([470])];
    case 4:
      return [...left([470]), ...top([690, 1230]), ...right([470])];
    case 5:
      return [...left([470]), ...top([560, 960, 1360]), ...right([470])];
    default:
      // 6 avversari (7 giocatori): due per lato ben distanziati lungo i bordi e due di fronte
      return [...left([630, 310]), ...top([700, 1220]), ...right([310, 630])];
  }
}

export function computeSeats(count: number): SeatGeometry[] {
  const scale = count >= 6 ? 0.92 : 1.04;
  return slots(count).map(s => ({
    x: s.x,
    y: s.y,
    rotation: s.side === 'left' ? 90 : s.side === 'right' ? -90 : 0,
    facingDown: s.side === 'top',
    scale
  }));
}

// ---- Scala attuale della scena (serve alle animazioni che volano sopra il tavolo) ----
let currentScale = 1;
export function setTableScale(s: number) {
  currentScale = s;
}
export function getTableScale(): number {
  return currentScale;
}

// ---- Velocità delle animazioni (impostazione dell'host): 1 = normale, >1 = più veloci ----
let animRate = 1;
export function setAnimRate(r: number) {
  animRate = r > 0 ? r : 1;
}
export function getAnimRate(): number {
  return animRate;
}
