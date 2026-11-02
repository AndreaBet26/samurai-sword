import React, { useEffect, useLayoutEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { GameEvent, PlayerPublicState } from '../../../shared/types';
import { soundManager } from '../utils/soundEffects';
import { tokenLedger } from '../utils/tokenLedger';

/**
 * EFFETTI CINEMATOGRAFICI
 *
 * Riceve dal server la lista degli eventi di gioco (danni, parate, abbattimenti, Onore, carte...)
 * e li anima uno dopo l'altro sopra il tavolo. Gli effetti sono creati direttamente nel DOM con la
 * Web Animations API (solo transform/opacity: fluidi anche su telefono) e si autodistruggono.
 *
 * Con "Riduci movimento" attivo nel sistema operativo restano solo scritte e dissolvenze.
 */

interface EffectsLayerProps {
  events: GameEvent[];
  myId: string;
  players: PlayerPublicState[];
}

/** Quanto tempo (ms) ogni evento "occupa" prima che parta il successivo: dà il ritmo alla scena. */
const SLOT_MS: Record<GameEvent['kind'], number> = {
  damage: 450,
  parry: 420,
  defeat: 1700,
  honor_transfer: 1000,
  honor_loss: 700,
  reshuffle: 1300,
  draw: 170,
  steal: 650,
  discard_from_hand: 550,
  property_removed: 600,
  bushido_reveal: 1100,
  bushido_pass: 700,
  heal: 500,
  game_over: 0
};

const CARD_W = 72;
const CARD_H = 102;

export const EffectsLayer: React.FC<EffectsLayerProps> = ({ events, myId, players }) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const lastSeenIdRef = useRef<number | null>(null);
  const nextFreeAtRef = useRef(0);
  const playersRef = useRef(players);
  playersRef.current = players;

  // useLayoutEffect: i gettoni vengono "congelati" prima che il browser disegni il nuovo stato (niente sfarfallii)
  useLayoutEffect(() => {
    const maxId = events.reduce((m, e) => Math.max(m, e.id), 0);
    // Al primo render (o dopo un rientro / nuova partita) non si rianimano gli eventi già accaduti
    if (lastSeenIdRef.current === null || maxId < lastSeenIdRef.current) {
      lastSeenIdRef.current = maxId;
      tokenLedger.reset();
      return;
    }
    const fresh = events.filter(e => e.id > lastSeenIdRef.current!);
    if (fresh.length === 0) return;
    lastSeenIdRef.current = maxId;

    // I gettoni restano dove sono finché la loro animazione non parte (vedi tokenLedger)
    for (const ev of fresh) holdTokens(ev);

    const now = performance.now();
    // Se la coda è troppo lunga (scheda in background, molte azioni rapide) si accelera
    const backlog = nextFreeAtRef.current - now;
    const speed = backlog > 4000 ? 0.35 : 1;

    for (const ev of fresh) {
      const start = Math.max(now, nextFreeAtRef.current);
      const slot = SLOT_MS[ev.kind] * speed;
      nextFreeAtRef.current = start + slot;
      window.setTimeout(() => runEffect(ev, speed < 1), start - now);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(() => () => tokenLedger.reset(), []);

  /** Congela le pile di gettoni coinvolte nell'evento fino all'animazione. */
  const holdTokens = (ev: GameEvent) => {
    switch (ev.kind) {
      case 'damage':
        tokenLedger.add(`hp:${ev.targetId}`, ev.amount);
        tokenLedger.add('reserve', -ev.amount);
        break;
      case 'heal':
        if (ev.amount > 0) {
          tokenLedger.add(`hp:${ev.playerId}`, -ev.amount);
          tokenLedger.add('reserve', ev.amount);
        }
        break;
      case 'honor_transfer':
        tokenLedger.add(`honor:${ev.fromId}`, 1);
        tokenLedger.add(`honor:${ev.toId}`, -1);
        break;
      case 'honor_loss':
        ev.playerIds.forEach(id => tokenLedger.add(`honor:${id}`, 1));
        break;
    }
  };

  // ---------------------------------------------------------------------------------------
  // Utilità
  // ---------------------------------------------------------------------------------------

  const reduced = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const nameOf = (id: string) => playersRef.current.find(p => p.id === id)?.name ?? '';

  const anchorEl = (playerId: string): HTMLElement | null =>
    document.getElementById(playerId === myId ? 'table-player-mat' : `table-opponent-${playerId}`);

  const centerOf = (el: HTMLElement | null): { x: number; y: number } => {
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const playerPoint = (id: string) => centerOf(anchorEl(id));
  const deckPoint = () => centerOf(document.getElementById('table-deck-pile'));
  const pileOrPlayer = (pileId: string, playerId: string) => {
    const el = document.getElementById(pileId);
    return el ? centerOf(el) : playerPoint(playerId);
  };
  const hpPoint = (id: string) => pileOrPlayer(`tokens-hp-${id}`, id);
  const honorPoint = (id: string) => pileOrPlayer(`tokens-honor-${id}`, id);
  const reservePoint = () => centerOf(document.getElementById('table-token-reserve'));
  const discardPoint = () => centerOf(document.getElementById('table-discard-pile'));

  /** Crea un elemento nell'overlay; viene rimosso automaticamente dopo `life` ms. */
  const spawn = (style: Partial<CSSStyleDeclaration>, html = '', life = 2000): HTMLDivElement | null => {
    const layer = layerRef.current;
    if (!layer) return null;
    const el = document.createElement('div');
    Object.assign(el.style, { position: 'fixed', left: '0px', top: '0px', pointerEvents: 'none', willChange: 'transform, opacity' }, style);
    el.innerHTML = html;
    layer.appendChild(el);
    window.setTimeout(() => el.remove(), life);
    return el;
  };

  /** Particelle (scintille, sangue, petali) con canvas-confetti, origine in coordinate schermo. */
  const burst = (p: { x: number; y: number }, colors: string[], count = 40, opts: confetti.Options = {}) => {
    if (reduced()) return;
    const scale = window.innerWidth < 700 ? 0.5 : 1;
    try {
      confetti({
        particleCount: Math.round(count * scale),
        spread: 70,
        startVelocity: 28,
        gravity: 1.1,
        ticks: 90,
        scalar: 0.8,
        shapes: ['circle'],
        colors,
        origin: { x: p.x / window.innerWidth, y: p.y / window.innerHeight },
        disableForReducedMotion: true,
        zIndex: 95,
        ...opts
      });
    } catch {
      /* ignora */
    }
  };

  /** Scritta che compare con un "pop" e sale svanendo. */
  const floatText = (
    p: { x: number; y: number },
    text: string,
    color: string,
    size = 34,
    opts: { duration?: number; rise?: number; delay?: number; glow?: string } = {}
  ) => {
    const { duration = 1300, rise = 70, delay = 0, glow = color } = opts;
    const el = spawn(
      {
        transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
        fontFamily: "'Cinzel', serif",
        fontWeight: '900',
        fontSize: `${size}px`,
        color,
        whiteSpace: 'nowrap',
        textShadow: `0 0 12px ${glow}, 0 3px 0 rgba(0,0,0,0.9), 0 0 2px #000`,
        opacity: '0',
        zIndex: '96'
      },
      text,
      duration + delay + 200
    );
    if (!el) return;
    const base = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    if (reduced()) {
      el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration, delay, fill: 'forwards' });
      return;
    }
    el.animate(
      [
        { transform: `${base} scale(0.3)`, opacity: 0 },
        { transform: `${base} scale(1.35)`, opacity: 1, offset: 0.12 },
        { transform: `${base} scale(1)`, opacity: 1, offset: 0.25 },
        { transform: `${base} translateY(-${rise * 0.6}px) scale(1)`, opacity: 1, offset: 0.7 },
        { transform: `${base} translateY(-${rise}px) scale(0.9)`, opacity: 0 }
      ],
      { duration, delay, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' }
    );
  };

  /** Scossa di un elemento (giocatore colpito, mazzo, tavolo). */
  const shake = (el: HTMLElement | null, intensity = 8, duration = 420) => {
    if (!el || reduced()) return;
    const i = intensity;
    el.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-i}px, ${i / 3}px) rotate(-1deg)` },
        { transform: `translate(${i}px, ${-i / 3}px) rotate(1deg)` },
        { transform: `translate(${-i * 0.6}px, 0)` },
        { transform: `translate(${i * 0.4}px, 0)` },
        { transform: 'translate(0,0)' }
      ],
      { duration, easing: 'ease-out' }
    );
  };

  /** Bagliore colorato attorno a un elemento. */
  const glow = (el: HTMLElement | null, color: string, duration = 900) => {
    if (!el) return;
    el.animate(
      [
        { boxShadow: `0 0 0px 0px ${color}`, filter: 'brightness(1)' },
        { boxShadow: `0 0 45px 12px ${color}`, filter: 'brightness(1.35)', offset: 0.3 },
        { boxShadow: `0 0 0px 0px ${color}`, filter: 'brightness(1)' }
      ],
      { duration, easing: 'ease-out' }
    );
  };

  /** Lampo a tutto schermo (bordo colorato), usato quando vieni colpito tu. */
  const screenFlash = (color: string, duration = 650) => {
    const el = spawn(
      { inset: '0', width: '100vw', height: '100vh', boxShadow: `inset 0 0 160px 40px ${color}`, opacity: '0', zIndex: '94' },
      '',
      duration + 100
    );
    el?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], { duration, easing: 'ease-out' });
  };

  /** Taglio di spada che attraversa il bersaglio. */
  const slashAt = (p: { x: number; y: number }, color = '#ef4444') => {
    if (reduced()) return;
    const angle = -25 + Math.random() * 20;
    const el = spawn(
      {
        width: '220px',
        height: '5px',
        borderRadius: '3px',
        background: `linear-gradient(90deg, transparent, #fff 45%, ${color} 70%, transparent)`,
        boxShadow: `0 0 18px ${color}`,
        transformOrigin: 'left center',
        zIndex: '96'
      },
      '',
      700
    );
    const base = `translate(${p.x - 110}px, ${p.y}px) rotate(${angle}deg)`;
    el?.animate(
      [
        { transform: `${base} scaleX(0)`, opacity: 1 },
        { transform: `${base} scaleX(1)`, opacity: 1, offset: 0.35 },
        { transform: `${base} scaleX(1) translateY(6px)`, opacity: 0 }
      ],
      { duration: 520, easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)', fill: 'forwards' }
    );
  };

  /** Carta (o gettone) che vola ad arco da un punto all'altro. */
  const fly = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    html: string,
    opts: { w?: number; h?: number; duration?: number; arc?: number; spin?: number; endScale?: number; fadeOut?: boolean; trail?: string } = {}
  ): number => {
    const { w = CARD_W, h = CARD_H, duration = 650, arc = 80, spin = 0, endScale = 0.8, fadeOut = true, trail } = opts;
    const el = spawn(
      {
        width: `${w}px`,
        height: `${h}px`,
        zIndex: '97',
        filter: trail ? `drop-shadow(0 0 10px ${trail})` : 'drop-shadow(0 8px 12px rgba(0,0,0,0.6))'
      },
      html,
      duration + 150
    );
    if (!el) return 0;
    const p0 = `translate(${from.x - w / 2}px, ${from.y - h / 2}px)`;
    const p1 = `translate(${to.x - w / 2}px, ${to.y - h / 2}px)`;
    if (reduced()) {
      el.animate([{ transform: p0, opacity: 0 }, { transform: p1, opacity: 1, offset: 0.5 }, { transform: p1, opacity: 0 }], { duration: 400, fill: 'forwards' });
      return 400;
    }
    const mx = (from.x + to.x) / 2 - w / 2;
    const my = Math.min(from.y, to.y) - arc - h / 2;
    el.animate(
      [
        { transform: `${p0} rotate(0deg) scale(0.9)`, opacity: 0 },
        { transform: `${p0} rotate(0deg) scale(1)`, opacity: 1, offset: 0.08 },
        { transform: `translate(${mx}px, ${my}px) rotate(${spin / 2}deg) scale(1.12)`, opacity: 1, offset: 0.5 },
        { transform: `${p1} rotate(${spin}deg) scale(${endScale})`, opacity: fadeOut ? 0 : 1 }
      ],
      { duration, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)', fill: 'forwards' }
    );
    return duration;
  };

  /** Un gettone che vola da una pila all'altra e aggiorna le pile alla partenza e all'arrivo. */
  const flyToken = (
    kind: 'hp' | 'honor',
    from: { x: number; y: number },
    to: { x: number; y: number },
    fromKey: string | null,
    toKey: string | null,
    opts: { delay?: number; duration?: number; arc?: number } = {}
  ) => {
    const { delay = 0, duration = 620, arc = 90 } = opts;
    window.setTimeout(() => {
      if (fromKey) tokenLedger.add(fromKey, -1); // il gettone lascia la pila
      const size = kind === 'hp' ? 26 : 30;
      const d = fly(from, to, kind === 'hp' ? heartHtml(size) : lotusHtml(size), {
        w: size,
        h: size,
        duration,
        arc,
        spin: (Math.random() - 0.5) * 540,
        endScale: 1,
        fadeOut: false,
        trail: kind === 'hp' ? '#f87171' : '#e879f9'
      });
      window.setTimeout(() => {
        if (toKey) tokenLedger.add(toKey, 1); // il gettone atterra nella pila di destinazione
      }, d);
      if (!reduced() && delay === 0) soundManager.playCardSlide();
    }, delay);
  };

  const cardHtml = (templateId: string) =>
    `<img src="/assets/cards/${templateId}.webp" style="width:100%;height:100%;object-fit:cover;border-radius:6px;border:2px solid rgba(255,255,255,0.85)" />`;
  const backHtml = () =>
    `<img src="/assets/ui/card_back.webp" style="width:100%;height:100%;object-fit:cover;border-radius:6px;border:2px solid rgba(0,0,0,0.6)" />`;
  const heartHtml = (size = 26) =>
    `<div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 30%, #fca5a5 0%, #dc2626 38%, #7f1d1d 100%);border:2px solid #fecaca;box-shadow:0 3px 6px rgba(0,0,0,0.7)"><svg viewBox="0 0 24 24" width="${size * 0.55}" height="${size * 0.55}"><path fill="#fff7ed" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.4 1.1 4.1 2.4h3C14.2 6.1 15.6 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21z"/></svg></div>`;
  const lotusHtml = (size = 44) =>
    `<div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${size * 0.62}px;background:radial-gradient(circle at 35% 30%, #f5d0fe, #a855f7 55%, #581c87);border:2px solid #f0abfc;box-shadow:0 0 18px #c084fc">🪷</div>`;

  /** Banner centrale cinematografico (kanji + titolo + sottotitolo). */
  const cinematicBanner = (kanji: string, title: string, subtitle: string, color: string, duration = 1600) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    // Vignetta scura che "rallenta" la scena
    const veil = spawn(
      { inset: '0', width: '100vw', height: '100vh', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.82) 75%)', opacity: '0', zIndex: '93' },
      '',
      duration + 100
    );
    veil?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration, fill: 'forwards' });

    const banner = spawn(
      { transform: `translate(${cx}px, ${cy}px) translate(-50%, -50%)`, textAlign: 'center', zIndex: '98', opacity: '0' },
      `<div style="font-family:'Yuji Boku',serif;font-size:min(26vw,190px);line-height:1;color:${color};text-shadow:0 0 40px ${color},0 6px 0 #000">${kanji}</div>
       <div style="font-family:'Cinzel',serif;font-weight:900;font-size:min(7vw,40px);color:#fff;letter-spacing:0.08em;text-shadow:0 0 18px ${color},0 3px 0 #000;margin-top:-6px">${title}</div>
       <div style="font-family:'Noto Sans',sans-serif;font-weight:700;font-size:min(4vw,17px);color:#e2e8f0;text-shadow:0 2px 6px #000;margin-top:6px">${subtitle}</div>`,
      duration + 100
    );
    const base = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    if (reduced()) {
      banner?.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration, fill: 'forwards' });
      return;
    }
    banner?.animate(
      [
        { transform: `${base} scale(2.4)`, opacity: 0, filter: 'blur(8px)' },
        { transform: `${base} scale(1)`, opacity: 1, filter: 'blur(0px)', offset: 0.14 },
        { transform: `${base} scale(1.06)`, opacity: 1, offset: 0.78 },
        { transform: `${base} scale(1.12)`, opacity: 0 }
      ],
      { duration, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
    );

    // Taglio orizzontale che attraversa lo schermo
    const cut = spawn(
      { width: '130vw', height: '4px', background: `linear-gradient(90deg, transparent, #fff, ${color}, transparent)`, boxShadow: `0 0 30px ${color}`, zIndex: '97', transformOrigin: 'left center' },
      '',
      900
    );
    const cutBase = `translate(-15vw, ${cy + 10}px) rotate(-8deg)`;
    cut?.animate(
      [{ transform: `${cutBase} scaleX(0)`, opacity: 1 }, { transform: `${cutBase} scaleX(1)`, opacity: 1, offset: 0.4 }, { transform: `${cutBase} scaleX(1)`, opacity: 0 }],
      { duration: 800, easing: 'cubic-bezier(0.1, 0.9, 0.2, 1)', fill: 'forwards' }
    );
  };

  // ---------------------------------------------------------------------------------------
  // Effetti per tipo di evento
  // ---------------------------------------------------------------------------------------

  const runEffect = (ev: GameEvent, hurried: boolean) => {
    try {
      switch (ev.kind) {
        case 'damage': {
          const el = anchorEl(ev.targetId);
          const p = centerOf(el);
          const lethal = ev.hpLeft <= 0;
          const self = ev.sourceId === ev.targetId; // Nobunaga
          if (ev.weapon) {
            slashAt(p);
            burst(p, ['#dc2626', '#991b1b', '#f87171'], 26 + ev.amount * 14, { spread: 80, startVelocity: 32 });
          } else if (!self) {
            burst(p, ['#f97316', '#fbbf24'], 18, { spread: 60 });
          }
          shake(el, 6 + ev.amount * 3 + (lethal ? 6 : 0), lethal ? 600 : 420);
          glow(el, lethal ? 'rgba(220,38,38,0.95)' : 'rgba(220,38,38,0.7)', 700);
          floatText(p, `−${ev.amount} ❤`, lethal ? '#ff1f1f' : ev.weapon ? '#f87171' : '#fb923c', lethal ? 52 : 34 + ev.amount * 4, {
            glow: '#7f1d1d',
            duration: lethal ? 1600 : 1300
          });
          if (ev.targetId === myId && !self) {
            screenFlash(lethal ? 'rgba(220,38,38,0.85)' : 'rgba(220,38,38,0.55)');
            shake(document.getElementById('table-root'), lethal ? 10 : 5, 380);
          }
          if (!hurried && !ev.weapon) soundManager.playTaiko();
          // I gettoni Vita persi vengono buttati nella riserva al centro del tavolo
          const fromHp = hpPoint(ev.targetId);
          const toReserve = reservePoint();
          for (let k = 0; k < ev.amount; k++) {
            flyToken('hp', fromHp, toReserve, `hp:${ev.targetId}`, 'reserve', { delay: 150 + k * 140, duration: hurried ? 380 : 650 });
          }
          break;
        }

        case 'parry': {
          const el = anchorEl(ev.playerId);
          const p = centerOf(el);
          const label = ev.against === 'jujutsu' ? 'SCHIVATO!' : 'PARATA!';
          const color = ev.against === 'jujutsu' ? '#fbbf24' : '#e0f2fe';
          // Scudo che si apre
          const shield = spawn(
            {
              transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              border: `4px solid ${color}`,
              boxShadow: `0 0 30px ${color}, inset 0 0 30px ${color}`,
              zIndex: '96',
              opacity: '0'
            },
            '',
            800
          );
          const base = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
          shield?.animate(
            [
              { transform: `${base} scale(0.2)`, opacity: 1 },
              { transform: `${base} scale(1)`, opacity: 1, offset: 0.35 },
              { transform: `${base} scale(1.6)`, opacity: 0 }
            ],
            { duration: 700, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)', fill: 'forwards' }
          );
          burst(p, ['#ffffff', '#fde68a', '#bae6fd'], 45, { spread: 120, startVelocity: 35, scalar: 0.6, gravity: 0.8 });
          glow(el, 'rgba(186,230,253,0.9)', 700);
          floatText(p, `🛡️ ${label}`, color, 32, { glow: '#0ea5e9' });
          if (ev.playerId !== myId && !hurried) soundManager.playParryClash();
          break;
        }

        case 'defeat': {
          const el = anchorEl(ev.targetId);
          const isMe = ev.targetId === myId;
          cinematicBanner(
            '斬',
            isMe ? 'SEI STATO ABBATTUTO' : 'ABBATTUTO!',
            `${nameOf(ev.targetId)} cade per mano di ${nameOf(ev.attackerId)}`,
            '#dc2626',
            hurried ? 900 : 1600
          );
          if (!reduced()) {
            el?.animate(
              [{ filter: 'grayscale(0) brightness(1)' }, { filter: 'grayscale(1) brightness(0.6)', offset: 0.3 }, { filter: 'grayscale(0.7) brightness(0.8)' }],
              { duration: 1500, easing: 'ease-out' }
            );
            shake(document.getElementById('table-root'), 12, 500);
          }
          burst(centerOf(el), ['#7f1d1d', '#dc2626', '#000000'], 70, { spread: 160, startVelocity: 40 });
          if (!hurried) soundManager.playGong();
          break;
        }

        case 'honor_transfer': {
          const from = honorPoint(ev.fromId);
          const to = honorPoint(ev.toId);
          flyToken('honor', from, to, `honor:${ev.fromId}`, `honor:${ev.toId}`, { duration: hurried ? 500 : 950, arc: 140 });
          window.setTimeout(() => {
            burst(to, ['#f0abfc', '#c084fc', '#facc15'], 50, { spread: 100, gravity: 0.6, scalar: 0.7 });
            glow(anchorEl(ev.toId), 'rgba(232,121,249,0.9)', 900);
            floatText(to, '+1 🪷', '#f5d0fe', 34, { glow: '#a855f7' });
            if (!hurried) soundManager.playHonorChime();
          }, reduced() ? 300 : 900);
          floatText(from, '−1 🪷', '#d8b4fe', 26, { glow: '#581c87', delay: 100 });
          break;
        }

        case 'honor_loss': {
          ev.playerIds.forEach((id, i) => {
            const p = honorPoint(id);
            window.setTimeout(() => tokenLedger.add(`honor:${id}`, -1), i * 80); // il gettone esce dal gioco
            const token = spawn({ zIndex: '96', opacity: '0' }, lotusHtml(36), 1400);
            const base = `translate(${p.x - 18}px, ${p.y - 18}px)`;
            token?.animate(
              [
                { transform: `${base} scale(0.5)`, opacity: 0 },
                { transform: `${base} scale(1.1)`, opacity: 1, offset: 0.2 },
                { transform: `${base} translateY(-90px) scale(0.6) rotate(40deg)`, opacity: 0 }
              ],
              { duration: 1200, delay: i * 80, easing: 'ease-out', fill: 'forwards' }
            );
            floatText(p, '−1 🪷', '#c4b5fd', 26, { delay: i * 80, glow: '#4c1d95' });
          });
          break;
        }

        case 'reshuffle': {
          const from = discardPoint();
          const to = deckPoint();
          for (let i = 0; i < 8; i++) {
            window.setTimeout(() => fly(from, to, backHtml(), { duration: 420, arc: 40 + i * 6, spin: -180, endScale: 1, fadeOut: true }), i * 70);
          }
          window.setTimeout(() => {
            const deck = document.getElementById('table-deck-pile');
            deck?.animate(
              [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg) scale(1.08)' }, { transform: 'rotate(8deg) scale(1.08)' }, { transform: 'rotate(0)' }],
              { duration: 450 }
            );
            floatText(to, 'Mazzo rimescolato!', '#fde68a', 26, { duration: 1700, rise: 40, glow: '#b45309' });
          }, 600);
          if (!hurried) soundManager.playRiffleShuffle();
          break;
        }

        case 'draw': {
          if (ev.playerId === myId) break; // le proprie carte le anima già la mano
          const from = ev.fromDiscard ? discardPoint() : deckPoint();
          const html = ev.fromDiscard && ev.cardTemplateId ? cardHtml(ev.cardTemplateId) : backHtml();
          fly(from, playerPoint(ev.playerId), html, { duration: hurried ? 300 : 520, arc: 60, spin: (Math.random() - 0.5) * 30, endScale: 0.5 });
          if (!hurried) soundManager.playCardSlide();
          break;
        }

        case 'steal': {
          const from = playerPoint(ev.fromId);
          const to = playerPoint(ev.toId);
          // Carta coperta che "sguscia" via: scia viola
          fly(from, to, backHtml(), { duration: 700, arc: 110, spin: 540, endScale: 0.5, trail: '#a855f7' });
          floatText(from, 'Rubata!', '#e9d5ff', 24, { glow: '#7e22ce' });
          if (!hurried) soundManager.playCardSlide();
          break;
        }

        case 'discard_from_hand':
        case 'property_removed': {
          const from = playerPoint(ev.playerId);
          fly(from, discardPoint(), cardHtml(ev.cardTemplateId), { duration: 650, arc: 70, spin: 200, endScale: 0.9 });
          floatText(from, ev.kind === 'property_removed' ? 'Proprietà scartata!' : 'Carta scartata!', '#fecaca', 22, { glow: '#9f1239' });
          glow(anchorEl(ev.playerId), 'rgba(244,63,94,0.7)', 600);
          break;
        }

        case 'bushido_reveal': {
          const deck = deckPoint();
          const card = spawn({ width: `${CARD_W * 1.6}px`, height: `${CARD_H * 1.6}px`, zIndex: '98', opacity: '0' }, cardHtml(ev.cardTemplateId), 1300);
          const w = CARD_W * 1.6;
          const h = CARD_H * 1.6;
          const base = `translate(${deck.x - w / 2}px, ${deck.y - h / 2 - 40}px)`;
          card?.animate(
            [
              { transform: `${base} rotateY(90deg) scale(0.6)`, opacity: 0 },
              { transform: `${base} rotateY(0deg) scale(1)`, opacity: 1, offset: 0.25 },
              { transform: `${base} scale(1.05)`, opacity: 1, offset: 0.8 },
              { transform: `${base} scale(0.8)`, opacity: 0 }
            ],
            { duration: 1200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' }
          );
          window.setTimeout(() => {
            if (ev.isWeapon) {
              floatText({ x: deck.x, y: deck.y - 140 }, '⚔️ BUSHIDO: ARMA!', '#fca5a5', 28, { glow: '#b91c1c', duration: 1400 });
              if (!hurried) soundManager.playTaiko();
            } else {
              floatText({ x: deck.x, y: deck.y - 140 }, 'Bushido: salvo', '#e2e8f0', 22, { glow: '#334155' });
            }
          }, 300);
          break;
        }

        case 'bushido_pass': {
          fly(playerPoint(ev.fromId), playerPoint(ev.toId), cardHtml('bushido'), { duration: 700, arc: 90, spin: 0, endScale: 0.7, trail: '#facc15' });
          floatText(playerPoint(ev.toId), 'Bushido ➜', '#fde68a', 22, { delay: 500, glow: '#a16207' });
          break;
        }

        case 'heal': {
          if (ev.amount <= 0) break;
          const el = anchorEl(ev.playerId);
          const p = centerOf(el);
          // I gettoni tornano dalla riserva al giocatore
          const fromReserve = reservePoint();
          const toHp = hpPoint(ev.playerId);
          for (let k = 0; k < ev.amount; k++) {
            flyToken('hp', fromReserve, toHp, 'reserve', `hp:${ev.playerId}`, { delay: k * 110, duration: hurried ? 380 : 600 });
          }
          glow(el, 'rgba(74,222,128,0.85)', 1000);
          burst(p, ['#86efac', '#4ade80', '#fef08a'], 30, { spread: 360, startVelocity: 14, gravity: -0.25, ticks: 120, scalar: 0.6 });
          floatText(p, `+${ev.amount} ❤`, '#86efac', 32, { glow: '#15803d' });
          break;
        }

        case 'game_over': {
          const colors: Record<string, string> = { shogun: '#facc15', ninja: '#3b82f6', ronin: '#ef4444', draw: '#e2e8f0' };
          const c = colors[ev.winnerTeam] ?? '#facc15';
          const names: Record<string, string> = { shogun: 'Shōgun & Samurai', ninja: 'Ninja', ronin: 'Ronin', draw: 'Pareggio' };
          cinematicBanner(
            '決着',
            ev.endReason === 'swordmaster' ? 'MAESTRO DI SPADA' : 'FINE DELLA BATTAGLIA',
            `Vittoria: ${names[ev.winnerTeam] ?? ''}`,
            c,
            2300
          );
          soundManager.playGong();
          [0.15, 0.85].forEach((x, i) =>
            window.setTimeout(
              () => burst({ x: window.innerWidth * x, y: window.innerHeight * 0.7 }, [c, '#ffffff', '#fde68a'], 120, { spread: 70, startVelocity: 55, angle: i === 0 ? 60 : 120, shapes: ['square', 'circle'], ticks: 200 }),
              400 + i * 150
            )
          );
          break;
        }
      }
    } catch (err) {
      console.error('[Effetti] errore animazione', err);
    }
  };

  return <div ref={layerRef} className="fixed inset-0 pointer-events-none z-[90] overflow-hidden" aria-hidden="true" />;
};
