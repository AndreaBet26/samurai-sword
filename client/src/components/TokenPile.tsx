import React from 'react';
import { useTokenCount } from '../utils/tokenLedger';

/**
 * Pila di gettoni fisici (Vita o Onore), appoggiati "alla rinfusa" sul tavolo come nel gioco vero.
 * Le posizioni sono pseudo-casuali ma stabili (non saltellano a ogni aggiornamento).
 */

export type TokenKind = 'hp' | 'honor';

/** Numero pseudo-casuale stabile tra 0 e 1 a partire da una stringa. */
function seeded(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export const HeartTokenFace: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #fca5a5 0%, #dc2626 38%, #7f1d1d 100%)',
      border: '2px solid #fecaca',
      boxShadow: '0 3px 5px rgba(0,0,0,0.75), inset 0 -2px 3px rgba(0,0,0,0.45), inset 0 2px 2px rgba(255,255,255,0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} aria-hidden="true">
      <path
        fill="#fff7ed"
        d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.4 1.1 4.1 2.4h3C14.2 6.1 15.6 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21z"
      />
    </svg>
  </div>
);

export const HonorTokenFace: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #f5d0fe 0%, #a855f7 40%, #4c1d95 100%)',
      border: '2px solid #fcd34d',
      boxShadow: '0 3px 5px rgba(0,0,0,0.75), inset 0 -2px 3px rgba(0,0,0,0.45), inset 0 2px 2px rgba(255,255,255,0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.56,
      lineHeight: 1
    }}
  >
    🪷
  </div>
);

interface TokenPileProps {
  /** id dell'elemento (serve alle animazioni per sapere da dove partono/arrivano i gettoni) */
  id: string;
  kind: TokenKind;
  /** Chiave nel registro dei gettoni in volo (hp:<id>, honor:<id>, reserve) */
  ledgerKey: string;
  count: number;
  /** Seme per la disposizione casuale */
  seed: string;
  size?: number;
  /** Gettoni per riga prima di andare a capo */
  perRow?: number;
  title?: string;
}

export const TokenPile: React.FC<TokenPileProps> = ({ id, kind, ledgerKey, count, seed, size = 24, perRow = 3, title }) => {
  const shown = useTokenCount(ledgerKey, count);
  const stepX = size * 0.72;
  const stepY = size * 0.62;
  const rows = Math.max(1, Math.ceil(Math.max(shown, 1) / perRow));
  const width = stepX * (Math.min(Math.max(shown, 1), perRow) - 1) + size + 8;
  const height = stepY * (rows - 1) + size + 6;

  return (
    <div
      id={id}
      title={title}
      className="relative shrink-0"
      style={{ width, height, minWidth: size + 8, minHeight: size + 6, transition: 'width 0.3s, height 0.3s' }}
    >
      {Array.from({ length: shown }).map((_, i) => {
        const r1 = seeded(`${seed}-${i}-x`);
        const r2 = seeded(`${seed}-${i}-y`);
        const r3 = seeded(`${seed}-${i}-r`);
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        // Le righe dispari sono sfalsate: sembra una manciata di gettoni, non una griglia
        const x = col * stepX + (row % 2 ? stepX * 0.35 : 0) + (r1 - 0.5) * size * 0.3 + 4;
        const y = row * stepY + (r2 - 0.5) * size * 0.25 + 3;
        return (
          <div
            key={i}
            className="absolute token-drop"
            style={{ left: x, top: y, transform: `rotate(${(r3 - 0.5) * 50}deg)`, zIndex: i }}
          >
            {kind === 'hp' ? <HeartTokenFace size={size} /> : <HonorTokenFace size={size} />}
          </div>
        );
      })}
    </div>
  );
};
