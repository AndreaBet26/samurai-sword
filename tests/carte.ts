/**
 * Controllo di tutte le carte e abilità contro il regolamento (npm test).
 * Contro un attacco con arma e contro il Grido di Battaglia si difende SOLO la Parata
 * (eccezione: Hanzō con un'arma, se non è la sua ultima carta); contro il Jiujitsu si scarta un'arma.
 */
(global as any).setTimeout = (fn: any) => setImmediate(fn);
import { GameEngine } from '../server/src/gameEngine';
import { CHARACTERS_DATA } from '../shared/charactersData';
GameEngine.decisionTimersEnabled = false;
const tick = () => new Promise(r => setImmediate(r));
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) fails++; };
const priv = (e: any) => [...e.playersPrivate.values()] as any[];
const all = (e: any) => [...e.deck, ...e.discardPile, ...priv(e).flatMap((p: any) => [...p.hand, ...p.propertiesInPlay])];
function give(e: any, p: any, pred: (c: any) => boolean) {
  const c = all(e).find(c => pred(c) && !p.hand.includes(c));
  for (const q of priv(e)) { q.hand = q.hand.filter((x: any) => x !== c); q.propertiesInPlay = q.propertiesInPlay.filter((x: any) => x !== c); }
  e.deck = e.deck.filter((x: any) => x !== c); e.discardPile = e.discardPile.filter((x: any) => x !== c);
  p.hand.push(c); return c;
}
async function setup(chars: string[] = []) {
  const e: any = new GameEngine('T');
  for (let i = 0; i < 4; i++) e.addPlayer('p' + i, 'P' + i, i === 0, false);
  e.startGame(); e.completeInitialDeal();
  for (let i = 0; i < 10; i++) await tick();
  if (e.state.turnPhase === 'draw') { e.drawForIeyasu(e.state.turnPlayerId, false); for (let i = 0; i < 10; i++) await tick(); }
  const ps = e.state.turnOrder.map((id: string) => e.playersPrivate.get(id));
  ps.forEach((p: any, i: number) => {
    const ch = (CHARACTERS_DATA as any)[chars[i] || ['tomoe', 'benkei', 'nobunaga', 'kojiro'][i]];
    p.character = ch; p.maxHp = ch.maxHp; p.currentHp = ch.maxHp; e.discardPile.push(...p.hand, ...p.propertiesInPlay); p.hand = []; p.propertiesInPlay = [];
    p.maxWeaponsPerTurn = ch.id === 'goemon' ? 2 : 1; p.weaponsPlayedThisTurn = 0;
    give(e, p, c => c.actionType === 'geisha'); // una carta per non essere inoffensivi
  });
  e.syncPublicState();
  return { e, a: ps[0], b: ps[1], c: ps[2], d: ps[3] };
}
const attack = (e: any, a: any, b: any, pred: (c: any) => boolean) => {
  const w = give(e, a, pred);
  return e.attackWithWeapon(a.id, w?.id, b.id);
};

(async () => {
  // --- ATTACCO CON ARMA: solo Parata (o Hanzō con arma) ---
  { const { e, a, b } = await setup(['tomoe', 'tomoe']); attack(e, a, b, c => c.templateId === 'bokken');
    const w = give(e, b, c => c.type === 'weapon');
    ok(e.submitReaction(b.id, w.id) === false, 'Attacco con arma: un personaggio normale NON può parare con un\'arma');
    const p = give(e, b, c => c.actionType === 'parry');
    ok(e.submitReaction(b.id, p.id) === true && b.currentHp === b.maxHp, 'Attacco con arma: la Parata annulla il colpo'); }
  { const { e, a, b } = await setup(['tomoe', 'hanzo']); attack(e, a, b, c => c.templateId === 'bo');
    const w = give(e, b, c => c.type === 'weapon');
    ok(e.submitReaction(b.id, w.id) === true, 'Hanzō: può parare un attacco con un\'arma'); }
  { const { e, a, b } = await setup(['tomoe', 'hanzo']); attack(e, a, b, c => c.templateId === 'bokken');
    e.discardPile.push(...b.hand); b.hand = []; const w = give(e, b, c => c.type === 'weapon');
    ok(e.submitReaction(b.id, w.id) === false, 'Hanzō: NON può usare l\'arma se è la sua ultima carta'); }
  // --- GRIDO DI BATTAGLIA: solo Parata ---
  { const { e, a, b, c, d } = await setup(); const bc = give(e, a, x => x.actionType === 'battle_cry'); e.playAction(a.id, bc.id);
    const first = e.state.pendingReaction.pendingForPlayerId; const t = priv(e).find((p: any) => p.id === first);
    const w = give(e, t, x => x.type === 'weapon');
    ok(e.submitReaction(t.id, w.id) === false, 'Grido di Battaglia: NON si può rispondere con un\'arma');
    const j = give(e, t, x => x.actionType === 'jujutsu');
    ok(e.submitReaction(t.id, j.id) === false, 'Grido di Battaglia: non si può rispondere con altre carte');
    const p = give(e, t, x => x.actionType === 'parry');
    ok(e.submitReaction(t.id, p.id) === true, 'Grido di Battaglia: la Parata funziona'); }
  // --- JIUJITSU: si scarta un'arma, la Parata non vale ---
  { const { e, a } = await setup(); const j = give(e, a, x => x.actionType === 'jujutsu'); e.playAction(a.id, j.id);
    const t = priv(e).find((p: any) => p.id === e.state.pendingReaction.pendingForPlayerId);
    const p = give(e, t, x => x.actionType === 'parry');
    ok(e.submitReaction(t.id, p.id) === false, 'Jiujitsu: la Parata NON vale (serve un\'arma)');
    const w = give(e, t, x => x.type === 'weapon'); const hp = t.currentHp;
    ok(e.submitReaction(t.id, w.id) === true && t.currentHp === hp, 'Jiujitsu: scartando un\'arma non si perde Resistenza'); }
  // --- CHIYOME immune a Grido e Jiujitsu ---
  { const { e, a, b } = await setup(['tomoe', 'chiyome']); const bc = give(e, a, x => x.actionType === 'battle_cry'); e.playAction(a.id, bc.id);
    ok(!e.state.pendingReaction?.targetPlayerIds.includes(b.id), 'Chiyome: immune al Grido di Battaglia'); }
  // --- Inoffensivi esclusi ---
  { const { e, a, b } = await setup(); e.discardPile.push(...b.hand); b.hand = []; e.syncPublicState(); const w = give(e, a, x => x.templateId === 'bokken');
    ok(e.attackWithWeapon(a.id, w.id, b.id) === false, 'Senza carte in mano non si può essere attaccati'); }
  // --- Danni e personaggi ---
  { const { e, a, b } = await setup(['musashi', 'ginchiyo']); attack(e, a, b, c => c.templateId === 'bokken'); e.submitReaction(b.id, null);
    ok(b.maxHp - b.currentHp === 1, 'Musashi +1 e Ginchiyo −1: Bokken fa 1 danno'); }
  { const { e, a, b } = await setup(['tomoe', 'ushiwaka']); const w = give(e, a, c => c.templateId === 'kiseru'); const before = a.hand.length; const hb = b.hand.length;
    e.attackWithWeapon(a.id, w.id, b.id); e.submitReaction(b.id, null);
    ok(a.hand.length === before && b.hand.length === hb + 2, `Tomoe pesca 1 colpendo, Ushiwaka pesca 1 per ferita (Tomoe mano ${a.hand.length}/${before}, Ushiwaka +${b.hand.length - hb})`); }
  { const { e, a, b } = await setup(['tomoe', 'benkei']); e.syncPublicState();
    const w = give(e, a, c => c.templateId === 'bokken');
    ok(e.attackWithWeapon(a.id, w.id, b.id) === false, 'Benkei: un\'arma con gittata 1 non lo raggiunge a distanza 1'); }
  { const { e, a, c } = await setup(['kojiro', 'tomoe', 'benkei']); e.syncPublicState();
    const w = give(e, a, x => x.templateId === 'bokken');
    ok(e.attackWithWeapon(a.id, w.id, c.id) === true, 'Kojirō: colpisce a qualsiasi Difficoltà'); }
  { const { e, a, b } = await setup(['tomoe', 'tomoe']); const ar = give(e, b, x => x.propertyType === 'armor'); b.hand = b.hand.filter((x: any) => x !== ar); b.propertiesInPlay.push(ar); e.syncPublicState();
    const w = give(e, a, x => x.templateId === 'bokken');
    ok(e.attackWithWeapon(a.id, w.id, b.id) === false, 'Armatura: +1 Difficoltà'); }
  { const { e, a, b } = await setup(['tomoe', 'tomoe']); const fd = give(e, a, x => x.propertyType === 'fast_draw'); e.playProperty(a.id, fd.id);
    attack(e, a, b, c => c.templateId === 'bokken'); e.submitReaction(b.id, null);
    ok(b.maxHp - b.currentHp === 2, 'Estrazione Rapida: +1 danno'); }
  { const { e, a, b } = await setup(['tomoe', 'tomoe']); const f = give(e, a, x => x.propertyType === 'focus'); e.playProperty(a.id, f.id);
    attack(e, a, b, c => c.templateId === 'bokken'); e.submitReaction(b.id, null);
    ok(attack(e, a, b, c => c.templateId === 'bokken') === true, 'Concentrazione: seconda arma nello stesso turno'); }
  { const { e, a, b } = await setup(['tomoe', 'tomoe']); attack(e, a, b, c => c.templateId === 'bokken'); e.submitReaction(b.id, null);
    ok(attack(e, a, b, c => c.templateId === 'bokken') === false, 'Senza Concentrazione: una sola arma per turno'); }
  { const { e, a, b } = await setup(['goemon', 'tomoe']); a.maxWeaponsPerTurn = e.baseWeaponsPerTurn(a); attack(e, a, b, c => c.templateId === 'bokken'); e.submitReaction(b.id, null);
    ok(attack(e, a, b, c => c.templateId === 'bokken') === true, 'Goemon: due armi per turno'); }
  // --- Azioni ---
  { const { e, a, b } = await setup(); const g = give(e, a, x => x.actionType === 'geisha'); const ar = give(e, b, x => x.propertyType === 'armor'); b.hand = b.hand.filter((x: any) => x !== ar); b.propertiesInPlay.push(ar);
    ok(e.playAction(a.id, g.id, b.id, ar.id) && b.propertiesInPlay.length === 0, 'Geisha: elimina una Proprietà scelta (lato server)'); }
  { const { e, a, b } = await setup(); const dv = give(e, a, x => x.actionType === 'diversion'); const hb = b.hand.length; const ha = a.hand.length;
    const r = e.playAction(a.id, dv.id, b.id, undefined, 0);
    ok(r && b.hand.length === hb - 1 && a.hand.length === ha, 'Diversione: ruba la carta coperta scelta (senza duplicarla)'); }
  { const { e, a, b } = await setup(); a.currentHp = 1; const r = give(e, a, x => x.actionType === 'breathing'); const hb = b.hand.length;
    ok(e.playAction(a.id, r.id, b.id) && a.currentHp === a.maxHp && b.hand.length === hb + 1, 'Respirazione: cura tutto, un altro pesca 1'); }
  { const { e, a } = await setup(); const t = give(e, a, x => x.actionType === 'tea_ceremony'); const h = a.hand.length; const others = priv(e).filter((p: any) => p !== a).map((p: any) => p.hand.length);
    e.playAction(a.id, t.id);
    ok(a.hand.length === h - 1 + 3 && priv(e).filter((p: any) => p !== a).every((p: any, i: number) => p.hand.length === others[i] + 1), 'Cerimonia del Tè: 3 a te, 1 agli altri'); }
  { const { e, a } = await setup(); const d = give(e, a, x => x.actionType === 'daimyo'); const h = a.hand.length; e.playAction(a.id, d.id);
    ok(a.hand.length === h - 1 + 2, 'Daimyo: pesca 2'); }
  { const { e, a, b } = await setup(); const p = give(e, a, x => x.actionType === 'parry');
    ok(e.playAction(a.id, p.id) === false, 'Parata: non si gioca nel proprio turno'); }
  { const { e, a } = await setup(['nobunaga']); const h = a.hand.length;
    ok(e.useNobunagaAbility(a.id) && a.currentHp === a.maxHp - 1 && a.hand.length === h + 1, 'Nobunaga: −1 Resistenza per pescare'); a.currentHp = 1;
    ok(e.useNobunagaAbility(a.id) === false, 'Nobunaga: non può usare l\'ultima Resistenza'); }
  console.log(fails ? `\n${fails} PROBLEMI` : '\nTutte le carte si comportano secondo le regole');
  process.exit(fails ? 1 : 0);
})();
