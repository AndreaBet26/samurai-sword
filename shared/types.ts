export type RoleId = 'shogun' | 'samurai' | 'ninja' | 'ronin';

export interface RoleDef {
  id: RoleId;
  name: string;
  description: string;
  team: 'shogun' | 'ninja' | 'ronin';
  isRevealed: boolean;
  color: string;
  /** Solo Ninja: stelle sulla carta (1-3). In 4 giocatori raddoppia il Ninja con più stelle. */
  stars?: number;
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
  /** Abilità in poche parole, mostrata sul tavolo */
  shortAbility?: string;
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
  isHarmless: boolean; // 0 carte in mano OPPURE 0 Resistenza (regola ufficiale)
  isDefeatedThisRound: boolean; // at 0 HP waiting for turn recovery
  isConnected: boolean; // false se il giocatore umano ha perso la connessione
  isAway: boolean; // true se un bot sta giocando al posto del giocatore disconnesso
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
  | 'dealing'        // Distribuzione iniziale delle carte a tutti i giocatori
  | 'recover'        // Check 0 hp recovery, bushido check
  | 'draw'           // Draw 2 cards (or Ieyasu choice)
  | 'play'           // Play cards
  | 'discard'        // Discard down to current HP
  | 'response_wait'; // Waiting for Parry or Jujutsu response

export interface PendingReaction {
  type: 'parry_weapon' | 'battle_cry' | 'jujutsu' | 'bushido'; // bushido: scegli se scartare un'Arma o perdere 1 Onore
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
  cardTemplateId?: string;
  cardName?: string;
  sourcePlayerId?: string;
  sourcePlayerName?: string;
  targetPlayerId?: string;
  targetPlayerName?: string;
  damage?: number;
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

/**
 * Eventi di gioco per le animazioni del client (danni, parate, onore, carte in volo...).
 * Ogni evento ha un id crescente: il client anima solo quelli che non ha ancora visto.
 */
export type GameEvent = { id: number; at: number } & (
  | { kind: 'damage'; targetId: string; sourceId: string; amount: number; weapon: boolean; hpLeft: number }
  | { kind: 'parry'; playerId: string; sourceId: string; cardTemplateId: string; against: 'weapon' | 'battle_cry' | 'jujutsu' }
  | { kind: 'defeat'; targetId: string; attackerId: string }
  | { kind: 'honor_transfer'; fromId: string; toId: string }
  | { kind: 'honor_loss'; playerIds: string[]; reason: 'reshuffle' | 'bushido' }
  | { kind: 'reshuffle' }
  | { kind: 'draw'; playerId: string; fromDiscard?: boolean; cardTemplateId?: string }
  | { kind: 'steal'; fromId: string; toId: string }
  | { kind: 'discard_from_hand'; playerId: string; cardTemplateId: string }
  | { kind: 'property_removed'; playerId: string; cardTemplateId: string }
  | { kind: 'bushido_reveal'; playerId: string; cardTemplateId: string; isWeapon: boolean }
  | { kind: 'bushido_pass'; fromId: string; toId: string }
  | { kind: 'heal'; playerId: string; amount: number; reason: 'breathing' | 'recover' }
  | { kind: 'game_over'; winnerTeam: 'shogun' | 'ninja' | 'ronin' | 'draw'; endReason: 'honor' | 'swordmaster' }
);

/** Distribuisce Omit sulle varianti dell'unione (per creare eventi senza id/at) */
export type GameEventInput = GameEvent extends infer E ? (E extends any ? Omit<E, 'id' | 'at'> : never) : never;

/** Impostazioni scelte dall'host nella lobby */
export interface RoomSettings {
  /** Tempo massimo per il turno: 1 minuto, 2 minuti o nessun limite */
  turnTimer: 'off' | '60' | '120';
  /** Velocità delle animazioni */
  animSpeed: 'normal' | 'fast';
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
  /** Giocatore umano che deve decidere e quanto tempo gli resta (ms, calcolato all'invio) */
  decisionPlayerId?: string | null;
  decisionMsLeft?: number | null;
  lastPlayedCard: LastPlayedCardAnim | null;
  logs: GameLogEntry[];
  /** Ultimi eventi di gioco da animare (vedi GameEvent) */
  events: GameEvent[];
  /** Impostazioni della stanza (scelte dall'host) */
  settings?: RoomSettings;
  winnerTeam?: 'shogun' | 'ninja' | 'ronin' | 'draw';
  finalScores?: {
    shogunSamurai: number;
    ninja: number;
    ronin: number;
    /** honor = qualcuno ha finito i Punti Onore; swordmaster = Vittoria del Maestro di Spada */
    endReason: 'honor' | 'swordmaster';
    /** Squadra penalizzata di 3 punti dal Colpo Mortale (ha abbattuto un compagno chiudendo la partita) */
    deadlyStrikeTeam?: 'shogun' | 'ninja' | 'ronin';
    /** Spiegazione leggibile di come è finita la partita */
    summary: string;
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
