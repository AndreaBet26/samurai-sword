import { RoleDef, RoleId } from './types';

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
    description: 'Guerrieri dell’ombra legati dallo stesso patto. Il loro ruolo è segreto. Cooperano per abbattere lo Shōgun e i suoi alleati, cercando di accumulare più punti Onore di tutti.',
    team: 'ninja',
    isRevealed: false,
    color: '#2563eb' // blue
  },
  ronin: {
    id: 'ronin',
    name: 'Ronin',
    description: 'Samurai senza padrone, lupo solitario. Gioca esclusivamente per se stesso. Vince solo se accumula più punti Onore di qualsiasi altra squadra.',
    team: 'ronin',
    isRevealed: false,
    color: '#dc2626' // red
  }
};

export function getRoleDistribution(playerCount: number): RoleId[] {
  switch (playerCount) {
    case 3:
      // Special 3-player variant: 1 Shogun, 1 Ninja, 1 Ronin
      return ['shogun', 'ninja', 'ronin'];
    case 4:
      return ['shogun', 'ninja', 'ninja', 'ronin'];
    case 5:
      return ['shogun', 'samurai', 'ninja', 'ninja', 'ronin'];
    case 6:
      return ['shogun', 'samurai', 'ninja', 'ninja', 'ninja', 'ronin'];
    case 7:
    default:
      return ['shogun', 'samurai', 'samurai', 'ninja', 'ninja', 'ninja', 'ronin'];
  }
}

export function getInitialHonorPoints(playerCount: number, roleId: RoleId): number {
  if (playerCount <= 5) {
    return roleId === 'shogun' ? 5 : 4;
  } else {
    return roleId === 'shogun' ? 4 : 3;
  }
}
