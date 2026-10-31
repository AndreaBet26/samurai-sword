import { PlayerPublicState, CardDef, GameState, RoleDef } from './types';

/**
 * Calculates the shortest distance between player fromId and targetId around the circle.
 * In Samurai Sword, Harmless players (players with 0 cards in hand) are skipped
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

  // Harmless check
  if (target.isHarmless) {
    return { canAttack: false, reason: 'Il bersaglio è Inoffensivo (non ha carte in mano) e non può essere attaccato.' };
  }

  if (target.currentHp <= 0) {
    return { canAttack: false, reason: 'Il bersaglio è già a 0 punti ferita.' };
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

/**
 * Calculates final scores and determines the winning team.
 */
export function calculateFinalScores(
  players: (PlayerPublicState & { role: RoleDef; hand: CardDef[] })[]
) {
  const playerCount = players.length;
  const roninMultiplier = playerCount >= 6 ? 3 : 2;

  let shogunSamuraiScore = 0;
  let ninjaScore = 0;
  let roninScore = 0;

  const playerScores = players.map(p => {
    // Count Daimyo cards in hand
    // Note: Daimyo in hand gives +1 Honor Point to Shogun, Samurai, and Ninja. Ronin gets 0 from Daimyo.
    const daimyoCount = p.hand.filter(c => c.actionType === 'daimyo').length;
    const daimyoBonus = p.role.id === 'ronin' ? 0 : daimyoCount;

    let multiplier = 1;
    if (p.role.id === 'ronin') {
      multiplier = roninMultiplier;
    }

    const totalScore = (p.honorPoints * multiplier) + daimyoBonus;

    if (p.role.team === 'shogun') {
      shogunSamuraiScore += totalScore;
    } else if (p.role.team === 'ninja') {
      ninjaScore += totalScore;
    } else if (p.role.team === 'ronin') {
      roninScore += totalScore;
    }

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

  let winnerTeam: 'shogun' | 'ninja' | 'ronin' | 'draw' = 'draw';
  if (shogunSamuraiScore > ninjaScore && shogunSamuraiScore > roninScore) {
    winnerTeam = 'shogun';
  } else if (ninjaScore > shogunSamuraiScore && ninjaScore > roninScore) {
    winnerTeam = 'ninja';
  } else if (roninScore > shogunSamuraiScore && roninScore > ninjaScore) {
    winnerTeam = 'ronin';
  } else {
    winnerTeam = 'draw';
  }

  return {
    shogunSamurai: shogunSamuraiScore,
    ninja: ninjaScore,
    ronin: roninScore,
    playerScores,
    winnerTeam
  };
}
