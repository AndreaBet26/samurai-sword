/**
 * Test automatici di Samurai Sword.  Avvio:  npm test
 *
 * 1. Regole di punteggio (moltiplicatori, Daimyo, pareggi, Colpo Mortale)
 * 2. Scenari del motore (variante a 3, Hanzō, Bushido, Colpo Mortale, Maestro di Spada)
 * 3. Timer delle decisioni: una partita con soli umani "addormentati" deve andare avanti da sola
 * 4. Simulazione: centinaia di partite tra bot devono finire tutte, senza perdere carte
 */
import { GameEngine, DECISION_TIME_MS } from '../server/src/gameEngine';
import { calculateFinalScores } from '../shared/rules';
import { ROLES_DATA, buildRoleDeck, getInitialHonorPoints } from '../shared/rolesData';

let failures = 0;
function check(cond: boolean, msg: string) {
  console.log(`${cond ? '  ✔' : '  ✘'} ${msg}`);
  if (!cond) failures++;
}

const realSetTimeout = global.setTimeout;
const wait = (ms: number) => new Promise(r => realSetTimeout(r, ms));
const tick = () => new Promise(r => setImmediate(r));
/** Rende istantanei i ritardi del motore (animazioni, pause dei bot) */
function fastTimers() {
  (global as any).setTimeout = (fn: (...a: any[]) => void) => setImmediate(fn);
}

const priv = (e: any) => [...e.playersPrivate.values()] as any[];
function give(e: any, p: any, c: any) {
  for (const q of priv(e)) q.hand = q.hand.filter((x: any) => x.id !== c.id);
  e.deck = e.deck.filter((x: any) => x.id !== c.id);
  e.discardPile = e.discardPile.filter((x: any) => x.id !== c.id);
  p.hand.push(c);
}
const allCards = (e: any) => [...e.deck, ...e.discardPile, ...priv(e).flatMap((p: any) => p.hand)];

async function setup(n: number, bots = false) {
  const e: any = new GameEngine('TEST');
  for (let i = 0; i < n; i++) e.addPlayer('p' + i, 'P' + i, i === 0, bots);
  e.startGame();
  e.completeInitialDeal();
  for (let i = 0; i < 10; i++) await tick();
  return e;
}

function testScoring() {
  console.log('\n1) Ruoli, Onore e punteggio');
  const mk = (id: string, roleId: keyof typeof ROLES_DATA, honor: number, extra: any = {}, daimyo = 0) =>
    ({ id, name: id, role: { ...ROLES_DATA[roleId], ...extra }, honorPoints: honor, hand: Array(daimyo).fill({ actionType: 'daimyo' }) }) as any;

  const d4 = buildRoleDeck(4);
  check(d4.filter(r => r.id === 'ninja').length === 2 && d4.some(r => r.id === 'samurai') && !d4.some(r => r.id === 'ronin'), '4 giocatori: Shōgun, Samurai, 2 Ninja');
  check(buildRoleDeck(3).map(r => r.id).sort().join() === 'ninja,ninja,shogun', '3 giocatori: Shōgun + 2 Ninja');
  check(getInitialHonorPoints(3, 'shogun') === 6 && getInitialHonorPoints(5, 'shogun') === 5 && getInitialHonorPoints(5, 'ninja') === 3 && getInitialHonorPoints(6, 'ninja') === 4, 'Onore iniziale ufficiale');

  let s = calculateFinalScores([mk('S', 'shogun', 3), mk('Sa', 'samurai', 2), mk('N1', 'ninja', 2, { stars: 3 }), mk('N2', 'ninja', 1, { stars: 1 })]);
  check(s.shogunSamurai === 7 && s.ninja === 5, '4p: Samurai x2 e Ninja con più stelle x2');
  s = calculateFinalScores([mk('S', 'shogun', 4), mk('Sa', 'samurai', 2), mk('N1', 'ninja', 2), mk('N2', 'ninja', 4), mk('R', 'ronin', 2, {}, 2)]);
  check(s.ronin === 4 && s.winnerTeam === 'ninja', '5p: Ronin x2 senza Daimyo; i Ninja vincono il pareggio');
  s = calculateFinalScores([mk('S', 'shogun', 3), mk('Sa', 'samurai', 1), mk('N1', 'ninja', 1), mk('N2', 'ninja', 1), mk('N3', 'ninja', 1), mk('R', 'ronin', 1)]);
  check(s.shogunSamurai === 5 && s.ronin === 3, '6p: Samurai x2, Ronin x3');
  s = calculateFinalScores([mk('S', 'shogun', 2), mk('Sa', 'samurai', 1), mk('N1', 'ninja', 1), mk('N2', 'ninja', 0), mk('R', 'ronin', 1)]);
  check(s.winnerTeam === 'shogun', 'Shōgun & Samurai vincono il pareggio con il Ronin');
  s = calculateFinalScores([mk('S', 'shogun', 3), mk('Sa', 'samurai', 2), mk('N1', 'ninja', 1), mk('N2', 'ninja', 1), mk('R', 'ronin', 1)], { deadlyStrikeTeam: 'shogun' });
  check(s.shogunSamurai === 2, 'Colpo Mortale: -3 alla squadra');
  s = calculateFinalScores([mk('S', 'shogun', 1, {}, 1), mk('N1', 'ninja', 2), mk('N2', 'ninja', 1)]);
  check(s.shogunSamurai === 3 && s.winnerTeam === 'ninja', '3p: Shōgun x2, Daimyo non moltiplicato');
}

async function testScenarios() {
  console.log('\n2) Scenari di gioco');

  {
    const e = await setup(3);
    const sh = priv(e).find(p => p.role.id === 'shogun');
    check(sh.maxWeaponsPerTurn >= 2, 'Variante a 3: lo Shōgun può giocare 2 Armi');
    check(sh.hand.length === 4 + 3 + (sh.character.id === 'hideyoshi' ? 1 : 0), 'Variante a 3: lo Shōgun pesca 3 carte');
    e.dispose();
  }

  {
    const e = await setup(4);
    const cur = priv(e).find(p => p.id === e.state.turnPlayerId);
    const other = priv(e).find(p => p.id !== cur.id);
    other.character = { ...other.character, id: 'hanzo' };
    other.currentHp = 3;
    other.hand = other.hand.filter((c: any) => c.actionType !== 'parry');
    if (!other.hand.some((c: any) => c.type === 'weapon')) give(e, other, allCards(e).find((c: any) => c.type === 'weapon' && !cur.hand.includes(c)));
    if (other.hand.length < 2) give(e, other, allCards(e).find((c: any) => c.actionType === 'daimyo' && !cur.hand.includes(c)));
    const bc = allCards(e).find((c: any) => c.actionType === 'battle_cry');
    give(e, cur, bc);
    for (const q of priv(e)) if (q !== cur && q !== other) q.hand = [];
    e.playAction(cur.id, bc.id);
    const w = other.hand.find((c: any) => c.type === 'weapon');
    check(e.submitReaction(other.id, w.id) && other.currentHp === 3, "Hanzō para il Grido di Battaglia con un'Arma");
    e.dispose();
  }

  {
    const e = await setup(4);
    const cur = priv(e).find(p => p.id === e.state.turnPlayerId);
    const order = e.state.turnOrder;
    const nextId = order[(order.indexOf(cur.id) + 1) % 4];
    const next = priv(e).find(p => p.id === nextId);
    const bus = allCards(e).filter((c: any) => c.propertyType === 'bushido');
    give(e, cur, bus[0]);
    give(e, cur, bus[1]);
    check(e.playAction(cur.id, bus[0].id, nextId) === true, 'Bushido giocato davanti a un avversario');
    check(e.playAction(cur.id, bus[1].id, order[(order.indexOf(cur.id) + 2) % 4]) === false, 'Un solo Bushido in gioco alla volta');
    const wpn = e.deck.find((c: any) => c.type === 'weapon');
    e.deck = e.deck.filter((c: any) => c !== wpn);
    e.deck.push(wpn); // la prossima carta scoperta sarà un'Arma
    if (!next.hand.some((c: any) => c.type === 'weapon')) give(e, next, e.deck.find((c: any) => c.type === 'weapon' && c !== wpn));
    const honor = next.honorPoints;
    e.endPlayPhase(cur.id);
    if (e.state.turnPhase === 'discard') e.discardExcessCards(cur.id, cur.hand.slice(0, cur.hand.length - 7).map((c: any) => c.id));
    for (let i = 0; i < 20 && e.state.pendingReaction?.type !== 'bushido'; i++) await tick();
    check(e.state.pendingReaction?.type === 'bushido', 'Bushido: il giocatore sceglie cosa fare');
    e.submitReaction(nextId, null);
    check(next.honorPoints === honor - 1, 'Bushido: scegliendo di non scartare si perde 1 Onore');
    e.dispose();
  }

  {
    const e = await setup(5);
    const a = priv(e).find(p => p.id === e.state.turnPlayerId);
    const mate = priv(e).find(p => p !== a);
    mate.role = { ...mate.role, team: a.role.team };
    mate.honorPoints = 1;
    mate.currentHp = 1;
    e.inflictDamage(a, mate, 1, false);
    check(e.state.status === 'game_over' && e.state.finalScores.deadlyStrikeTeam === a.role.team, 'Colpo Mortale a fine partita');
  }

  {
    const e = await setup(4);
    const a = priv(e).find(p => p.id === e.state.turnPlayerId);
    const foes = priv(e).filter(p => p !== a);
    foes.forEach(f => {
      f.role = { ...f.role, team: a.role.team === 'ninja' ? 'shogun' : 'ninja' };
      f.honorPoints = 5;
    });
    foes[0].currentHp = 0;
    foes[1].currentHp = 0;
    foes[2].currentHp = 1;
    e.inflictDamage(a, foes[2], 1, false);
    check(e.state.status === 'game_over' && e.state.finalScores.endReason === 'swordmaster', 'Vittoria del Maestro di Spada');
  }
}

async function testDecisionTimers() {
  console.log('\n3) Timer delle decisioni (umani che non rispondono)');
  const saved = { ...DECISION_TIME_MS };
  Object.assign(DECISION_TIME_MS, { play: 300, reaction: 200, discard: 200, draw: 200 });
  const e: any = new GameEngine('TEST');
  for (let i = 0; i < 4; i++) e.addPlayer('h' + i, 'Umano' + i, i === 0, false);
  e.startGame();
  e.completeInitialDeal();
  const start = Date.now();
  while (Date.now() - start < 15000 && e.turnSerial < 6 && e.state.status === 'playing') await wait(100);
  check(e.turnSerial >= 6 || e.state.status === 'game_over', `La partita avanza da sola (${e.turnSerial} turni)`);
  e.dispose();
  Object.assign(DECISION_TIME_MS, saved);
}

async function testLobby() {
  console.log('\n5) Lobby: impostazioni e rivincita');
  const e: any = new GameEngine('TEST');
  for (let i = 0; i < 4; i++) e.addPlayer('p' + i, 'P' + i, i === 0, i > 0);
  e.updateSettings({ turnTimer: 'off', animSpeed: 'fast' });
  check(e.state.settings.turnTimer === 'off' && e.state.settings.animSpeed === 'fast', "L'host cambia le impostazioni");
  e.removePlayer('p3');
  check(e.state.players.length === 3, 'Un giocatore può essere tolto dalla lobby');
  e.startGame();
  e.completeInitialDeal();
  for (let i = 0; i < 10; i++) await tick();
  e.triggerGameOver();
  check(e.resetToLobby() === true && e.state.status === 'lobby' && e.state.players.length === 3, 'Rivincita: tutti tornano nella stessa stanza');
  check(e.state.players.every((p: any) => p.handCount === 0 && !p.character), 'Rivincita: carte e personaggi azzerati');
  check(e.startGame() === true, 'Rivincita: la nuova partita parte');
  e.dispose();
}

async function testSimulation(gamesPerSize: number) {
  console.log(`\n4) Simulazione: ${gamesPerSize} partite tra bot per ogni numero di giocatori`);
  GameEngine.decisionTimersEnabled = false;
  fastTimers();
  for (let n = 3; n <= 7; n++) {
    let finished = 0, cardErrors = 0, bushidoErrors = 0;
    for (let k = 0; k < gamesPerSize; k++) {
      let changes = 0;
      const e: any = new GameEngine('SIM', () => { changes++; });
      for (let i = 0; i < n; i++) e.addPlayer('b' + i, 'Bot' + i, i === 0, true);
      e.startGame();
      e.completeInitialDeal();
      let last = -1, idle = 0;
      while (e.state.status === 'playing') {
        await tick();
        const ps = priv(e);
        const total = e.deck.length + e.discardPile.length + (e.pendingBushidoCard ? 1 : 0) +
          ps.reduce((s: number, p: any) => s + p.hand.length + p.propertiesInPlay.length, 0);
        if (total !== 90) cardErrors++;
        if (ps.reduce((s: number, p: any) => s + p.propertiesInPlay.filter((c: any) => c.propertyType === 'bushido').length, 0) > 1) bushidoErrors++;
        if (changes === last) { if (++idle > 50) break; } else { idle = 0; last = changes; }
      }
      if (e.state.status === 'game_over') finished++;
      e.dispose();
    }
    check(finished === gamesPerSize && cardErrors === 0 && bushidoErrors === 0,
      `${n} giocatori: ${finished}/${gamesPerSize} partite concluse, carte sempre 90`);
  }
}

(async () => {
  testScoring();
  await testDecisionTimers(); // usa i timer reali: va eseguito prima di fastTimers()
  GameEngine.decisionTimersEnabled = false;
  fastTimers();
  await testScenarios();
  await testLobby();
  await testSimulation(Number(process.env.SIM_GAMES) || 40);
  console.log(failures ? `\n✘ ${failures} test falliti` : '\n✔ Tutti i test superati');
  process.exit(failures ? 1 : 0);
})();
