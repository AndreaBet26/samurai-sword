import { useSyncExternalStore } from 'react';

/**
 * "Registro" dei gettoni in volo.
 *
 * Lo stato del server cambia subito (es. -2 Vite), ma vogliamo che i gettoni lascino la pila del
 * giocatore solo quando parte l'animazione e arrivino a destinazione quando l'animazione atterra.
 * Il registro tiene una correzione temporanea per ogni pila:
 *   hp:<id>      gettoni Vita del giocatore
 *   honor:<id>   gettoni Onore del giocatore
 *   reserve      riserva comune delle Vite al centro del tavolo
 * Le pile mostrano: valore reale + correzione.
 */
type Listener = () => void;

const offsets = new Map<string, number>();
const listeners = new Set<Listener>();
let version = 0;

function notify() {
  version++;
  listeners.forEach(l => l());
}

export const tokenLedger = {
  add(key: string, delta: number) {
    if (!delta) return;
    const v = (offsets.get(key) ?? 0) + delta;
    if (v === 0) offsets.delete(key);
    else offsets.set(key, v);
    notify();
  },
  get(key: string) {
    return offsets.get(key) ?? 0;
  },
  reset() {
    if (offsets.size === 0) return;
    offsets.clear();
    notify();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  }
};

/** Valore visualizzato di una pila: reale + correzione dei gettoni ancora in volo. */
export function useTokenCount(key: string, realCount: number): number {
  const offset = useSyncExternalStore(
    tokenLedger.subscribe,
    () => tokenLedger.get(key),
    () => 0
  );
  void version;
  return Math.max(0, realCount + offset);
}
