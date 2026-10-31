export type RoleId = 'shogun' | 'samurai' | 'ninja' | 'ronin';

export interface RoleDef {
  id: RoleId;
  name: string;
  description: string;
  team: 'shogun' | 'ninja' | 'ronin';
  isRevealed: boolean;
  color: string;
}

export type CharacterId =
  | 'benkei'
  | 'chiyome'
  | 'ginchiyo'
  | 'goemon'
  | 'hanzo'
  | 'hideyoshi'
  | 'ieyasu'
  | 'kojiro'
  | 'musashi'
  | 'nobunaga'
  | 'tomoe'
  | 'ushiwaka';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  maxHp: number;
  abilityDescription: string;
  avatar: string; // emoji or icon reference
}

export type CardType = 'weapon' | 'property' | 'action';

export type WeaponCardName =
  | 'Bokken'
  | 'Bo'
  | 'Kiseru'
  | 'Kusarigama'
  | 'Katana'
  | 'Shuriken'
  | 'Kanabo'
  | 'Nodachi'
  | 'Naginata'
  | 'Nagayari'
  | 'Tanegashima'
  | 'Daikyu'
  | 'Wakizashi';

export type PropertyCardName =
  | 'Armatura'
  | 'Concentrazione'
  | 'Estrazione Rapida'
  | 'Bushido';

export type ActionCardName =
  | 'Parata'
  | 'Cerimonia del Tè'
  | 'Daimyo'
  | 'Diversione'
  | 'Geisha'
  | 'Grido di Battaglia'
  | 'Jiujitsu'
  | 'Respirazione';

export interface CardDef {
  id: string; // unique card instance ID, e.g. "katana_1"
  templateId: string;
  name: WeaponCardName | PropertyCardName | ActionCardName;
  type: CardType;
  description: string;
  // Weapon stats
  difficulty?: number; // reach / range
  damage?: number;
  // Special action/property tag
  actionType?:
    | 'parry'
    | 'tea_ceremony'
    | 'daimyo'
    | 'diversion'
    | 'geisha'
    | 'battle_cry'
    | 'jujutsu'
    | 'breathing';
  propertyType?: 'armor' | 'focus' | 'fast_draw' | 'bushido';
}

export interface PlayerPublicState {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  character: CharacterDef | null;
  role: RoleDef | null; // revealed if shogun or if game ended
  currentHp: number;
  maxHp: number;
  honorPoints: number;
  isHarmless: boolean; // 0 cards in hand
  isDefeatedThisRound: boolean; // at 0 HP waiting for turn recovery
  handCount: number;
  propertiesInPlay: CardDef[];
  weaponsPlayedThisTurn: number;
  maxWeaponsPerTurn: number;
}

export interface PlayerPrivateState extends PlayerPublicState {
  role: RoleDef; // always revealed to self
  hand: CardDef[];
}

export type TurnPhase =
  | 'recover'      // Check 0 hp recovery, bushido check
  | 'draw'         // Draw 2 cards (or Ieyasu choice)
  | 'play'         // Play cards
  | 'discard'      // Discard down to current HP
  | 'response_wait'; // Waiting for Parry or Jujutsu response

export interface PendingReaction {
  type: 'parry_weapon' | 'battle_cry' | 'jujutsu' | 'bushido';
  sourcePlayerId: string;
  targetPlayerIds: string[]; // pending responses
  weaponCard?: CardDef;
  damage?: number;
  pendingForPlayerId: string; // current player asked to respond
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  text: string;
  type: 'info' | 'attack' | 'damage' | 'heal' | 'defeat' | 'end' | 'action';
}

export interface LastPlayedCardAnim {
  card: CardDef;
  sourcePlayerId: string;
  sourcePlayerName: string;
  targetPlayerId?: string;
  targetPlayerName?: string;
  actionText: string;
  timestamp: number;
}

export interface GameState {
  roomCode: string;
  status: 'lobby' | 'playing' | 'game_over';
  turnPlayerId: string;
  turnPhase: TurnPhase;
  players: PlayerPublicState[];
  turnOrder: string[]; // player IDs in clockwise order
  discardPileTop: CardDef | null;
  deckCount: number;
  discardPileCount: number;
  pendingReaction: PendingReaction | null;
  lastPlayedCard: LastPlayedCardAnim | null;
  logs: GameLogEntry[];
  winnerTeam?: 'shogun' | 'ninja' | 'ronin' | 'draw';
  finalScores?: {
    shogunSamurai: number;
    ninja: number;
    ronin: number;
    playerScores: {
      playerId: string;
      name: string;
      role: RoleDef;
      honorPoints: number;
      daimyoBonus: number;
      multiplier: number;
      totalScore: number;
    }[];
  };
}
