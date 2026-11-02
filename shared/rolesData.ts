import { RoleDef, RoleId } from './types';
import { shuffleArray } from './cardsData';

export const ROLES_DATA: Record<RoleId, RoleDef> = {
  shogun: {
    id: 'shogun',
    name: 'Shōgun',
    description: 'Il supremo capo militare del Giappone. È l’unico giocatore il cui ruolo è palese a tutti fin dall’inizio. Il suo obiettivo è sconfiggere i Ninja e il Ronin assieme al suo fedele Samurai.',
    team: 'shogun',
    isRevealed: true,
    color: '#eab308' // gold / yellow
  },
  samurai: {
    id: 'samurai',
    name: 'Samurai',
    description: 'Fedele servitore dello Shōgun. Il suo ruolo è segreto. Vince la partita insieme allo Shōgun se la loro squadra ottiene il punteggio di Onore più alto alla fine.',
    team: 'shogun',
    isRevealed: false,
    color: '#ca8a04' // dark gold
  },
  ninja: {
    id: 'ninja',
    name: 'Ninja',
    description: 'Guerrieri dell’ombra legati dallo stesso patto. Il loro ruolo è segreto. Cooperano per abbattere lo Shōgun e i suoi alleati, cercando di accumulare più punti Onore di tutti. I Ninja vincono ogni pareggio.',
    team: 'ninja',
    isRevealed: false,
    color: '#2563eb' // blue
  },
  ronin: {
    id: 'ronin',
    name: 'Ronin',
    description: 'Samurai senza padrone, lupo solitario. Gioca esclusivamente per se stesso. I suoi Punti Onore valgono x2 con 5 giocatori e x3 con 6-7 giocatori.',
    team: 'ronin',
    isRevealed: false,
    color: '#dc2626' // red
  }
};

/**
 * Distribuzione ufficiale dei ruoli:
 * - 3 giocatori (variante): Shōgun, 2 Ninja
 * - 4 giocatori: Shōgun, Samurai, 2 Ninja (si mescolano 3 Ninja e se ne scarta uno a caso)
 * - 5 giocatori: Shōgun, Samurai, 2 Ninja, Ronin
 * - 6 giocatori: Shōgun, Samurai, 3 Ninja, Ronin
 * - 7 giocatori: Shōgun, 2 Samurai, 3 Ninja, Ronin
 */
export function getRoleDistribution(playerCount: number): RoleId[] {
  switch (playerCount) {
    case 3:
      return ['shogun', 'ninja', 'ninja'];
    case 4:
      return ['shogun', 'samurai', 'ninja', 'ninja'];
    case 5:
      return ['shogun', 'samurai', 'ninja', 'ninja', 'ronin'];
    case 6:
      return ['shogun', 'samurai', 'ninja', 'ninja', 'ninja', 'ronin'];
    case 7:
    default:
      return ['shogun', 'samurai', 'samurai', 'ninja', 'ninja', 'ninja', 'ronin'];
  }
}

/**
 * Crea le carte Ruolo della partita (già mescolate). Le 3 carte Ninja hanno 1, 2 e 3 stelle:
 * se servono meno di 3 Ninja, le carte in eccesso vengono scartate a caso senza guardarle.
 */
export function buildRoleDeck(playerCount: number): RoleDef[] {
  const ids = getRoleDistribution(playerCount);
  const ninjaStars = shuffleArray([1, 2, 3]);
  let ninjaIdx = 0;
  const roles = ids.map(id => {
    const role: RoleDef = { ...ROLES_DATA[id] };
    if (id === 'ninja') role.stars = ninjaStars[ninjaIdx++];
    return role;
  });
  return shuffleArray(roles);
}

/**
 * Punti Onore iniziali (regola ufficiale):
 * - Shōgun: 5 (6 nella variante a 3 giocatori)
 * - Altri: 3 con 3-5 giocatori, 4 con 6-7 giocatori
 */
export function getInitialHonorPoints(playerCount: number, roleId: RoleId): number {
  if (roleId === 'shogun') return playerCount === 3 ? 6 : 5;
  return playerCount >= 6 ? 4 : 3;
}

/** Moltiplicatore di fine partita per un ruolo (tabella ufficiale). */
export function getScoreMultiplier(playerCount: number, role: RoleDef, maxNinjaStars: number): number {
  switch (role.id) {
    case 'shogun':
      return playerCount === 3 ? 2 : 1;
    case 'samurai':
      return playerCount === 4 || playerCount === 6 ? 2 : 1;
    case 'ninja':
      return playerCount === 4 && (role.stars ?? 0) === maxNinjaStars ? 2 : 1;
    case 'ronin':
      return playerCount >= 6 ? 3 : 2;
    default:
      return 1;
  }
}
