import { PlayerPublicState, CardDef, GameState, RoleDef } from './types';
import { getScoreMultiplier } from './rolesData';

/**
 * Regola ufficiale: un giocatore è Inoffensivo se non ha carte in mano
 * OPPURE se non ha più punti Resistenza (abbattuto, fino al suo prossimo turno).
 * Un Inoffensivo non può essere bersaglio di Armi, non subisce Grido di Battaglia
 * e Jiujitsu e viene saltato nel calcolo delle distanze.
 */
export function isPlayerHarmless(handCount: number, currentHp: number): boolean {
  return handCount <= 0 || currentHp <= 0;
}

/**
 * Calculates the shortest distance between player fromId and targetId around the circle.
 * In Samurai Sword, Harmless players (0 cards in hand OR 0 resistance) are skipped
 * when counting distances between players.
 */
export function calculateDistance(
  allPlayers: PlayerPublicState[],
  fromId: string,
  targetId: string
): number {
  if (fromId === targetId) return 0;

  // Filter players or count active circle
  // When counting steps between A and B, players who are harmless (0 cards in hand)
  // are ignored (stepped over).
  // First, find the indices of all players in current clockwise order
  const count = allPlayers.length;
  const fromIndex = allPlayers.findIndex(p => p.id === fromId);
  const targetIndex = allPlayers.findIndex(p => p.id === targetId);

  if (fromIndex === -1 || targetIndex === -1) return 999;

  // Count clockwise active steps
  let clockwiseSteps = 0;
  let curr = (fromIndex + 1) % count;
  while (curr !== targetIndex) {
    const p = allPlayers[curr];
    // Harmless players are skipped when measuring distance to others
    if (!p.isHarmless) {
      clockwiseSteps++;
    }
    curr = (curr + 1) % count;
  }
  // Step into the target
  clockwiseSteps++;

  // Count counter-clockwise active steps
  let counterSteps = 0;
  curr = (fromIndex - 1 + count) % count;
  while (curr !== targetIndex) {
    const p = allPlayers[curr];
    if (!p.isHarmless) {
      counterSteps++;
    }
    curr = (curr - 1 + count) % count;
  }
  counterSteps++;

  return Math.min(clockwiseSteps, counterSteps);
}

/**
 * Calculates the total difficulty required to attack target from attacker.
 * Difficulty = Base Distance + Target Armors (+1 if Target is Benkei).
 */
export function calculateTargetDifficulty(
  allPlayers: PlayerPublicState[],
  attacker: PlayerPublicState,
  target: PlayerPublicState
): number {
  const baseDist = calculateDistance(allPlayers, attacker.id, target.id);
  
  // Count armor properties on target
  const armors = target.propertiesInPlay.filter(p => p.propertyType === 'armor').length;
  
  // Benkei ability: others have +1 difficulty to hit him
  const benkeiBonus = target.character?.id === 'benkei' ? 1 : 0;

  return baseDist + armors + benkeiBonus;
}

/**
 * Checks if attacker can target defender with a specific weapon.
 */
export function canAttackWithWeapon(
  allPlayers: PlayerPublicState[],
  attacker: PlayerPublicState,
  target: PlayerPublicState,
  weapon: CardDef
): { canAttack: boolean; reason?: string } {
  if (attacker.id === target.id) {
    return { canAttack: false, reason: 'Non puoi attaccare te stesso.' };
  }

  // Harmless check (0 carte in mano oppure 0 Resistenza)
  if (target.currentHp <= 0) {
    return { canAttack: false, reason: 'Il bersaglio è stato abbattuto ed è Inoffensivo fino al suo prossimo turno.' };
  }

  if (target.isHarmless) {
    return { canAttack: false, reason: 'Il bersaglio è Inoffensivo (non ha carte in mano) e non può essere attaccato.' };
  }

  // Kojiro ignores weapon difficulty!
  if (attacker.character?.id === 'kojiro') {
    return { canAttack: true };
  }

  const difficulty = calculateTargetDifficulty(allPlayers, attacker, target);
  const weaponReach = weapon.difficulty ?? 1;

  if (weaponReach < difficulty) {
    return {
      canAttack: false,
      reason: `Gittata dell’arma insufficiente! Gittata: ${weaponReach}, Difficoltà richiesta: ${difficulty}.`
    };
  }

  return { canAttack: true };
}

/**
 * Calculates the damage a weapon attack will deal to a target.
 */
export function calculateAttackDamage(
  attacker: PlayerPublicState,
  target: PlayerPublicState,
  weapon: CardDef
): number {
  let baseDamage = weapon.damage ?? 1;

  // Attacker modifiers:
  // Musashi ability: +1 damage on weapon attacks
  if (attacker.character?.id === 'musashi') {
    baseDamage += 1;
  }

  // Fast draw properties in play: +1 damage each
  const fastDraws = attacker.propertiesInPlay.filter(p => p.propertyType === 'fast_draw').length;
  baseDamage += fastDraws;

  // Target modifiers:
  // Ginchiyo ability: suffers 1 less damage from weapons, minimum 1
  if (target.character?.id === 'ginchiyo') {
    baseDamage = Math.max(1, baseDamage - 1);
  }

  return baseDamage;
}

type Team = 'shogun' | 'ninja' | 'ronin';

export interface FinalScoreOptions {
  /** Squadra che ha chiuso la partita abbattendo un proprio compagno: -3 punti (Colpo Mortale) */
  deadlyStrikeTeam?: Team;
  /** Vittoria del Maestro di Spada: vince subito la squadra dell'unico giocatore con Resistenza */
  swordmasterTeam?: Team;
}

/**
 * Calcola i punteggi finali e la squadra vincitrice secondo le regole ufficiali:
 * - Onore x moltiplicatore del ruolo (vedi getScoreMultiplier) + 1 per ogni Daimyo in mano (0 per il Ronin, mai moltiplicato)
 * - Colpo Mortale: -3 alla squadra che ha chiuso la partita abbattendo un compagno
 * - Pareggi: i Ninja vincono ogni pareggio; Shōgun & Samurai vincono il pareggio con il Ronin
 */
export function calculateFinalScores(
  players: (PlayerPublicState & { role: RoleDef; hand: CardDef[] })[],
  options: FinalScoreOptions = {}
) {
  const playerCount = players.length;
  const maxNinjaStars = Math.max(0, ...players.filter(p => p.role.id === 'ninja').map(p => p.role.stars ?? 0));

  const teamTotals: Record<Team, number> = { shogun: 0, ninja: 0, ronin: 0 };

  const playerScores = players.map(p => {
    const daimyoCount = p.hand.filter(c => c.actionType === 'daimyo').length;
    const daimyoBonus = p.role.id === 'ronin' ? 0 : daimyoCount;
    const multiplier = getScoreMultiplier(playerCount, p.role, maxNinjaStars);
    const totalScore = p.honorPoints * multiplier + daimyoBonus;

    teamTotals[p.role.team] += totalScore;

    return {
      playerId: p.id,
      name: p.name,
      role: p.role,
      honorPoints: p.honorPoints,
      daimyoBonus,
      multiplier,
      totalScore
    };
  });

  if (options.deadlyStrikeTeam) {
    teamTotals[options.deadlyStrikeTeam] -= 3;
  }

  // Squadre effettivamente presenti al tavolo, in ordine di priorità negli spareggi
  const presentTeams = (['ninja', 'shogun', 'ronin'] as Team[]).filter(t => players.some(p => p.role.team === t));

  let winnerTeam: Team | 'draw' = 'draw';
  if (options.swordmasterTeam) {
    winnerTeam = options.swordmasterTeam;
  } else if (presentTeams.length > 0) {
    const best = Math.max(...presentTeams.map(t => teamTotals[t]));
    // il primo team (per priorità) con il punteggio massimo vince lo spareggio
    winnerTeam = presentTeams.find(t => teamTotals[t] === best)!;
  }

  return {
    shogunSamurai: teamTotals.shogun,
    ninja: teamTotals.ninja,
    ronin: teamTotals.ronin,
    playerScores,
    winnerTeam
  };
}
