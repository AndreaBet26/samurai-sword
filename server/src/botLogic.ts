import { GameEngine } from './gameEngine';
import { CardDef, PlayerPrivateState, PlayerPublicState } from '../../shared/types';
import { calculateAttackDamage, canAttackWithWeapon } from '../../shared/rules';

/**
 * IA dei bot.
 *
 * Il bot conosce solo ciò che saprebbe un giocatore vero: il proprio ruolo, lo Shōgun (palese)
 * e la cronologia pubblica degli attacchi. Da questi indizi stima chi è alleato e chi nemico:
 * - Samurai: lo Shōgun è un alleato certo; chi attacca lo Shōgun è un probabile Ninja.
 * - Ninja: lo Shōgun è il bersaglio principale; chi attacca lo Shōgun è un probabile Ninja (alleato).
 * - Shōgun: chi lo attacca è un nemico; chi colpisce i suoi aggressori è un probabile Samurai.
 * - Ronin: tutti sono avversari, con preferenza per chi ha più Onore.
 */

/** > 0 = nemico (più alto = più ostile), <= 0 = probabile alleato da non colpire. */
type Hostility = Map<string, number>;

function attackCounts(engine: GameEngine): Map<string, Map<string, number>> {
  const counts = new Map<string, Map<string, number>>();
  for (const log of engine.state.logs) {
    if (log.type !== 'attack' || !log.sourcePlayerId || !log.targetPlayerId) continue;
    const row = counts.get(log.sourcePlayerId) ?? new Map<string, number>();
    row.set(log.targetPlayerId, (row.get(log.targetPlayerId) ?? 0) + 1);
    counts.set(log.sourcePlayerId, row);
  }
  return counts;
}

function computeHostility(engine: GameEngine, bot: PlayerPrivateState): Hostility {
  const players = engine.state.players;
  const shogun = players.find(p => p.role?.id === 'shogun');
  const attacks = attackCounts(engine);
  const hits = (from: string, to: string | undefined) => (to ? attacks.get(from)?.get(to) ?? 0 : 0);
  const myRole = bot.role.id;
  const h: Hostility = new Map();

  // Chi ha attaccato chi ha attaccato me (utile allo Shōgun per riconoscere il Samurai)
  const myAttackers = players.filter(p => hits(p.id, bot.id) > 0).map(p => p.id);

  for (const p of players) {
    if (p.id === bot.id) continue;
    const isShogun = shogun?.id === p.id;
    let score = 0;

    switch (myRole) {
      case 'samurai':
        score = isShogun ? -100 : 1 + hits(p.id, shogun?.id) * 2 + hits(p.id, bot.id);
        break;
      case 'ninja':
        // Lo Shōgun è il nemico numero uno; chi lo attacca è probabilmente un altro Ninja
        score = isShogun ? 10 : 1 + hits(p.id, bot.id) - hits(p.id, shogun?.id) * 1.5;
        break;
      case 'shogun': {
        const defendsMe = myAttackers.reduce((n, a) => n + hits(p.id, a), 0);
        score = 1 + hits(p.id, bot.id) * 2 - defendsMe;
        break;
      }
      case 'ronin':
        score = 1 + p.honorPoints * 0.3 + hits(p.id, bot.id) * 0.5;
        break;
    }
    h.set(p.id, score);
  }
  return h;
}

const isEnemy = (h: Hostility, id: string) => (h.get(id) ?? 1) > 0;

/** La partita sta per finire? (serve per decidere se tenere i Daimyo) */
function endgameNear(engine: GameEngine): boolean {
  const minHonor = Math.min(...engine.state.players.map(p => p.honorPoints));
  return minHonor <= 1 || (minHonor <= 2 && engine.state.deckCount <= 10);
}

/** Valore di una carta in mano (più alto = più utile da tenere). */
function cardValue(card: CardDef, bot: PlayerPrivateState, engine: GameEngine): number {
  if (card.actionType === 'daimyo') return bot.role.id === 'ronin' ? 2 : endgameNear(engine) ? 9 : 5;
  if (card.actionType === 'parry') return 8;
  if (card.type === 'weapon') return 3 + (card.damage ?? 1) + (card.difficulty ?? 1) * 0.5;
  if (card.actionType === 'breathing') return bot.currentHp < bot.maxHp ? 7 : 4;
  if (card.type === 'property') return 6;
  return 5;
}

export class BotAI {
  /**
   * Turno del bot in Fase di Gioco: fa UNA mossa per chiamata.
   * Il motore richiama il bot dopo ogni mossa; se nessuna mossa viene accettata, il motore chiude il turno.
   */
  static playTurn(engine: GameEngine, botId: string) {
    const bot = engine.getPlayerPrivate(botId);
    if (!bot || engine.state.status !== 'playing' || engine.state.turnPlayerId !== botId) return;

    const players = engine.state.players;
    const me = players.find(p => p.id === botId);
    if (!me) return;
    const h = computeHostility(engine, bot);
    const others = players.filter(p => p.id !== botId);
    const enemies = others.filter(p => isEnemy(h, p.id));
    const allies = others.filter(p => !isEnemy(h, p.id));
    const byHostility = (a: PlayerPublicState, b: PlayerPublicState) => (h.get(b.id) ?? 0) - (h.get(a.id) ?? 0);
    const find = (pred: (c: CardDef) => boolean) => bot.hand.find(pred);

    // 1. Proprietà personali (Armatura, Concentrazione, Estrazione Rapida)
    const prop = find(c => c.type === 'property' && c.propertyType !== 'bushido');
    if (prop && engine.playProperty(botId, prop.id)) return;

    // 2. Respirazione se ferito seriamente: fa pescare un alleato (o il giocatore meno pericoloso)
    const breathing = find(c => c.actionType === 'breathing');
    if (breathing && (bot.currentHp <= 2 || bot.maxHp - bot.currentHp >= 2)) {
      const beneficiary =
        [...allies].sort((a, b) => (h.get(a.id) ?? 0) - (h.get(b.id) ?? 0))[0] ??
        [...others].sort((a, b) => (h.get(a.id) ?? 0) - (h.get(b.id) ?? 0))[0];
      if (beneficiary && engine.playAction(botId, breathing.id, beneficiary.id)) return;
    }

    // 3. Pesca: Cerimonia del Tè sempre, Daimyo solo se la partita non sta per finire (a fine partita vale 1 Onore)
    const tea = find(c => c.actionType === 'tea_ceremony');
    if (tea && engine.playAction(botId, tea.id)) return;
    const daimyo = find(c => c.actionType === 'daimyo');
    if (daimyo && (bot.role.id === 'ronin' || !endgameNear(engine)) && engine.playAction(botId, daimyo.id)) return;

    // 4. Grido di Battaglia / Jiujitsu: solo se colpiscono più nemici che alleati
    //    e non rischiano di abbattere un alleato con 1 Onore (Colpo Mortale)
    const affected = others.filter(p => !p.isHarmless && p.character?.id !== 'chiyome');
    const enemyHits = affected.filter(p => isEnemy(h, p.id)).length;
    const allyHits = affected.filter(p => !isEnemy(h, p.id)).length;
    const deadlyRisk = affected.some(p => !isEnemy(h, p.id) && p.currentHp <= 1 && p.honorPoints <= 1);
    if (enemyHits > 0 && enemyHits >= allyHits && !deadlyRisk) {
      const mass = find(c => c.actionType === 'battle_cry') ?? find(c => c.actionType === 'jujutsu');
      if (mass && engine.playAction(botId, mass.id)) return;
    }

    // 5. Diversione: ruba al nemico con più carte
    const diversion = find(c => c.actionType === 'diversion');
    if (diversion) {
      const target = enemies.filter(p => p.handCount > 0).sort((a, b) => b.handCount - a.handCount || byHostility(a, b))[0];
      if (target && engine.playAction(botId, diversion.id, target.id)) return;
    }

    // 6. Geisha: toglie una Proprietà utile a un nemico, oppure il Bushido davanti a un alleato
    const geisha = find(c => c.actionType === 'geisha');
    if (geisha) {
      const bushidoOnFriend = allies
        .map(p => ({ p, card: p.propertiesInPlay.find(c => c.propertyType === 'bushido') }))
        .find(x => x.card);
      if (bushidoOnFriend && engine.playAction(botId, geisha.id, bushidoOnFriend.p.id, bushidoOnFriend.card!.id)) return;

      const priority = ['armor', 'fast_draw', 'focus'];
      for (const enemy of [...enemies].sort(byHostility)) {
        const propTarget = [...enemy.propertiesInPlay]
          .filter(c => c.propertyType && priority.includes(c.propertyType))
          .sort((a, b) => priority.indexOf(a.propertyType!) - priority.indexOf(b.propertyType!))[0];
        if (propTarget && engine.playAction(botId, geisha.id, enemy.id, propTarget.id)) return;
      }
      const handTarget = [...enemies].filter(p => p.handCount > 0).sort(byHostility)[0];
      if (handTarget && engine.playAction(botId, geisha.id, handTarget.id)) return;
    }

    // 7. Attacco con Arma
    if (bot.weaponsPlayedThisTurn < bot.maxWeaponsPerTurn) {
      const weapons = bot.hand.filter(c => c.type === 'weapon');
      let best: { weapon: CardDef; target: PlayerPublicState; score: number } | null = null;

      for (const weapon of weapons) {
        for (const target of enemies) {
          if (!canAttackWithWeapon(players, me, target, weapon).canAttack) continue;
          const dmg = calculateAttackDamage(me, target, weapon);
          const lethal = dmg >= target.currentHp;
          // Preferisce: colpi letali (Onore!), bersagli ostili, danni alti; a parità usa l'arma "più economica"
          const score =
            (lethal ? 20 : 0) + (h.get(target.id) ?? 0) * 3 + Math.min(dmg, target.currentHp) * 2 - (lethal ? dmg * 0.5 : 0);
          if (!best || score > best.score) best = { weapon, target, score };
        }
      }

      if (best && engine.attackWithWeapon(botId, best.weapon.id, best.target.id)) return;
    }

    // 8. Bushido davanti al nemico più ostile (se non ce n'è già uno in gioco)
    const bushido = find(c => c.propertyType === 'bushido');
    const bushidoInPlay = players.some(p => p.propertiesInPlay.some(c => c.propertyType === 'bushido'));
    if (bushido && !bushidoInPlay) {
      const target = [...enemies].sort(byHostility)[0];
      if (target && engine.playAction(botId, bushido.id, target.id)) return;
    }

    // 9. Nobunaga: sacrifica 1 Resistenza per pescare se è in salute e ha poche carte
    if (bot.character?.id === 'nobunaga' && bot.currentHp >= 4 && bot.hand.length <= 2) {
      if (engine.useNobunagaAbility(botId)) return;
    }

    engine.endPlayPhase(botId);
  }

  /** Risposta del bot a Parata / Grido di Battaglia / Jiujitsu / Bushido. */
  static respondToReaction(engine: GameEngine, botId: string) {
    const reaction = engine.state.pendingReaction;
    if (!reaction || reaction.pendingForPlayerId !== botId) return;

    const bot = engine.getPlayerPrivate(botId);
    if (!bot) return;

    const parries = bot.hand.filter(c => c.actionType === 'parry');
    const weapons = [...bot.hand.filter(c => c.type === 'weapon')].sort(
      (a, b) => (a.damage ?? 1) - (b.damage ?? 1) || (a.difficulty ?? 1) - (b.difficulty ?? 1)
    );
    const hanzoWeapon = bot.character?.id === 'hanzo' && bot.hand.length > 1 ? weapons[0] : undefined;

    switch (reaction.type) {
      case 'parry_weapon': {
        // Contro un'Arma si para sempre se possibile (Hanzō preferisce sacrificare l'arma più debole)
        const defense = parries[0] ?? hanzoWeapon;
        engine.submitReaction(botId, defense ? defense.id : null);
        return;
      }
      case 'battle_cry': {
        // 1 sola ferita: se in salute e con una sola Parata, la conserva per gli attacchi con Arma
        const healthy = bot.currentHp >= 4;
        const defense = hanzoWeapon ?? (parries.length > 1 || !healthy ? parries[0] : undefined);
        engine.submitReaction(botId, defense ? defense.id : null);
        return;
      }
      case 'jujutsu': {
        // Scarta l'arma più debole, a meno di essere in salute e di avere un'unica arma forte
        const onlyStrongWeapon = weapons.length === 1 && (weapons[0].damage ?? 1) >= 3;
        const discard = onlyStrongWeapon && bot.currentHp >= 4 ? undefined : weapons[0];
        engine.submitReaction(botId, discard ? discard.id : null);
        return;
      }
      case 'bushido': {
        // Meglio sacrificare un'arma debole che perdere Onore
        engine.submitReaction(botId, weapons[0]?.id ?? null);
        return;
      }
    }
  }

  /** Scarta fino a 7 carte tenendo le più utili. */
  static discardDown(engine: GameEngine, botId: string) {
    const bot = engine.getPlayerPrivate(botId);
    if (!bot) return;

    const excess = bot.hand.length - 7;
    if (excess <= 0) {
      engine.finishTurn(botId);
      return;
    }

    const ranked = [...bot.hand].sort((a, b) => cardValue(a, bot, engine) - cardValue(b, bot, engine));
    engine.discardExcessCards(botId, ranked.slice(0, excess).map(c => c.id));
  }
}
