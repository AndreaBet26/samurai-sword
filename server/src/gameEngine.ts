import { v4 as uuidv4 } from 'uuid';
import {
  CardDef,
  CharacterDef,
  GameEvent,
  GameEventInput,
  GameLogEntry,
  GameState,
  RoomSettings,
  PendingReaction,
  PlayerPrivateState,
  PlayerPublicState,
  RoleDef,
  RoleId,
  TurnPhase
} from '../../shared/types';
import { ALL_CHARACTERS } from '../../shared/charactersData';
import { CARD_TEMPLATES, buildDeck, shuffleArray } from '../../shared/cardsData';
import { buildRoleDeck, getInitialHonorPoints, ROLES_DATA } from '../../shared/rolesData';
import {
  calculateAttackDamage,
  calculateDistance,
  calculateFinalScores,
  calculateTargetDifficulty,
  canAttackWithWeapon,
  isPlayerHarmless
} from '../../shared/rules';
import { BotAI } from './botLogic';

/** Tempo massimo per ogni decisione di un giocatore umano, poi decide l'IA al suo posto. */
export const DECISION_TIME_MS = {
  play: 120_000,
  reaction: 25_000,
  discard: 30_000,
  draw: 30_000
};

export class GameEngine {
  /** Disattivabile nei test automatici */
  public static decisionTimersEnabled = true;
  public state: GameState;
  private playersPrivate: Map<string, PlayerPrivateState> = new Map();
  private deck: CardDef[] = [];
  private discardPile: CardDef[] = [];
  private onStateChangeCallback?: () => void;
  /** Incrementato a ogni cambio di stato: serve a capire se un bot ha davvero fatto una mossa. */
  private actionCounter = 0;
  /** true quando la stanza è stata chiusa: ferma bot e timer ancora in coda. */
  private disposed = false;
  /** Timer della decisione corrente di un umano (turno, reazione, scarto...) */
  private decisionTimer: ReturnType<typeof setTimeout> | null = null;
  private decisionKey = '';
  private decisionDeadline = 0;
  /** Numero progressivo dei turni (distingue due turni consecutivi dello stesso giocatore) */
  private turnSerial = 0;

  constructor(roomCode: string, onStateChange?: () => void) {
    this.onStateChangeCallback = onStateChange;
    this.state = {
      roomCode,
      status: 'lobby',
      turnPlayerId: '',
      turnPhase: 'recover',
      players: [],
      turnOrder: [],
      discardPileTop: null,
      deckCount: 0,
      discardPileCount: 0,
      pendingReaction: null,
      lastPlayedCard: null,
      logs: [],
      events: [],
      settings: { turnTimer: '120', animSpeed: 'normal' }
    };
  }

  public setOnStateChange(cb: () => void) {
    this.onStateChangeCallback = cb;
  }

  private notifyStateChange() {
    if (this.disposed) return;
    this.actionCounter++;
    this.syncPublicState();
    this.updateDecisionTimer();
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback();
    }
  }

  private addLog(text: string, type: GameLogEntry['type'] = 'info', meta?: Partial<Omit<GameLogEntry, 'id' | 'timestamp' | 'text' | 'type'>>) {
    this.state.logs.push({
      id: uuidv4(),
      timestamp: Date.now(),
      text,
      type,
      ...meta
    });
    // Keep last 100 logs
    if (this.state.logs.length > 100) {
      this.state.logs.shift();
    }
  }

  private eventSeq = 0;

  /** Registra un evento da animare sui client (si tengono gli ultimi 60). */
  private emit(ev: GameEventInput) {
    this.state.events.push({ ...(ev as any), id: ++this.eventSeq, at: Date.now() } as GameEvent);
    if (this.state.events.length > 60) this.state.events.shift();
  }

  /** Mette una carta pescata nella mano del giocatore e lo segnala alle animazioni. */
  private receive(player: PlayerPrivateState, card: CardDef) {
    player.hand.push(card);
    if (this.state.status === 'playing' && this.state.turnPhase !== 'dealing') {
      this.emit({ kind: 'draw', playerId: player.id });
    }
  }

  public triggerCardPlayed(
    card: CardDef,
    sourcePlayer: PlayerPrivateState,
    actionText: string,
    targetPlayer?: PlayerPrivateState
  ) {
    this.state.lastPlayedCard = {
      card,
      sourcePlayerId: sourcePlayer.id,
      sourcePlayerName: sourcePlayer.name,
      targetPlayerId: targetPlayer?.id,
      targetPlayerName: targetPlayer?.name,
      actionText,
      timestamp: Date.now()
    };
  }

  public getPlayerPrivate(id: string): PlayerPrivateState | undefined {
    return this.playersPrivate.get(id);
  }

  /** Regola ufficiale: Inoffensivo = 0 carte in mano oppure 0 Resistenza. */
  private harmless(p: PlayerPrivateState): boolean {
    return isPlayerHarmless(p.hand.length, p.currentHp);
  }

  /** Un giocatore è guidato dall'IA se è un bot oppure un umano disconnesso da troppo tempo. */
  private isBotControlled(p: PlayerPrivateState): boolean {
    return p.isBot || p.isAway;
  }

  /** Segnala che un giocatore umano ha perso (o ritrovato) la connessione. */
  public setPlayerConnected(id: string, connected: boolean) {
    const p = this.playersPrivate.get(id);
    if (!p || p.isBot || p.isConnected === connected) return;
    p.isConnected = connected;
    if (connected) {
      const wasAway = p.isAway;
      p.isAway = false;
      if (this.state.status === 'playing') {
        this.addLog(
          wasAway ? `${p.name} si è riconnesso e riprende il controllo dal bot.` : `${p.name} si è riconnesso.`,
          'info'
        );
      }
    } else if (this.state.status === 'playing') {
      this.addLog(`${p.name} ha perso la connessione...`, 'info');
    }
    this.notifyStateChange();
  }

  /** Dopo il periodo di attesa, un bot gioca al posto del giocatore disconnesso. */
  public setPlayerAway(id: string) {
    const p = this.playersPrivate.get(id);
    if (!p || p.isBot || p.isAway || this.state.status !== 'playing') return;
    p.isAway = true;
    this.addLog(`${p.name} non è rientrato: un bot gioca al suo posto finché non torna.`, 'info');
    this.notifyStateChange();
    this.checkBotAction();
  }

  /** Chiude definitivamente la partita: nessun timer o bot farà altre mosse. */
  public dispose() {
    this.disposed = true;
    if (this.decisionTimer) clearTimeout(this.decisionTimer);
    this.decisionTimer = null;
    this.onStateChangeCallback = undefined;
    if (this.state.status === 'playing') this.state.status = 'game_over';
  }

  public addPlayer(id: string, name: string, isHost = false, isBot = false): boolean {
    if (this.state.status !== 'lobby') return false;
    if (this.playersPrivate.has(id)) return false;
    if (this.playersPrivate.size >= 7) return false;

    const privateState: PlayerPrivateState = {
      id,
      name,
      isHost,
      isBot,
      character: null,
      role: ROLES_DATA.samurai, // placeholder until game start
      currentHp: 4,
      maxHp: 4,
      honorPoints: 4,
      isHarmless: false,
      isDefeatedThisRound: false,
      isConnected: true,
      isAway: false,
      handCount: 0,
      propertiesInPlay: [],
      weaponsPlayedThisTurn: 0,
      maxWeaponsPerTurn: 1,
      hand: []
    };

    this.playersPrivate.set(id, privateState);
    this.addLog(`${name} è entrato nella stanza.`, 'info');
    this.notifyStateChange();
    return true;
  }

  public removePlayer(id: string) {
    if (this.state.status === 'lobby') {
      const p = this.playersPrivate.get(id);
      if (p) {
        this.playersPrivate.delete(id);
        this.addLog(`${p.name} ha lasciato la stanza.`, 'info');
        // Reassign host if host left
        if (p.isHost && this.playersPrivate.size > 0) {
          // Il nuovo host deve essere un umano (un bot non può avviare la partita)
          const remaining = Array.from(this.playersPrivate.values());
          const first = remaining.find(x => !x.isBot) ?? remaining[0];
          first.isHost = true;
        }
        this.notifyStateChange();
      }
    }
  }

  /** L'host cambia le impostazioni (solo in lobby) */
  public updateSettings(patch: Partial<RoomSettings>) {
    if (this.state.status !== 'lobby') return;
    const cur = this.state.settings ?? { turnTimer: '120', animSpeed: 'normal' };
    const next: RoomSettings = { ...cur };
    if (patch.turnTimer === 'off' || patch.turnTimer === '60' || patch.turnTimer === '120') next.turnTimer = patch.turnTimer;
    if (patch.animSpeed === 'normal' || patch.animSpeed === 'fast') next.animSpeed = patch.animSpeed;
    this.state.settings = next;
    this.notifyStateChange();
  }

  /**
   * Rivincita: riporta la stanza in lobby con gli stessi giocatori (bot compresi).
   * Chi si è disconnesso viene tolto; ruoli, personaggi e carte verranno riassegnati alla partenza.
   */
  public resetToLobby(): boolean {
    if (this.state.status !== 'game_over') return false;
    if (this.decisionTimer) clearTimeout(this.decisionTimer);
    this.decisionTimer = null;
    this.decisionKey = '';
    for (const [id, p] of Array.from(this.playersPrivate.entries())) {
      if (!p.isBot && (!p.isConnected || p.isAway)) {
        this.playersPrivate.delete(id);
        continue;
      }
      Object.assign(p, {
        character: null,
        role: ROLES_DATA.samurai,
        currentHp: 4,
        maxHp: 4,
        honorPoints: 4,
        isHarmless: false,
        isDefeatedThisRound: false,
        handCount: 0,
        propertiesInPlay: [],
        weaponsPlayedThisTurn: 0,
        maxWeaponsPerTurn: 1,
        hand: []
      });
    }
    // Se l'host se n'è andato, il ruolo passa a un altro umano
    const all = Array.from(this.playersPrivate.values());
    if (all.length && !all.some(p => p.isHost)) (all.find(p => !p.isBot) ?? all[0]).isHost = true;

    this.deck = [];
    this.discardPile = [];
    this.pendingBushidoCard = null;
    Object.assign(this.state, {
      status: 'lobby',
      turnPlayerId: '',
      turnPhase: 'recover',
      turnOrder: [],
      pendingReaction: null,
      lastPlayedCard: null,
      logs: [],
      events: [],
      winnerTeam: undefined,
      finalScores: undefined
    });
    this.addLog('Rivincita! Si torna nella stanza.', 'info');
    this.notifyStateChange();
    return true;
  }

  public startGame(): boolean {
    const playerCount = this.playersPrivate.size;
    if (playerCount < 3 || playerCount > 7) {
      return false;
    }

    this.deck = buildDeck();
    this.discardPile = [];
    this.state.logs = [];
    this.state.events = [];

    // Assign roles
    const roleDeck = buildRoleDeck(playerCount); // già mescolato, Ninja con le loro stelle
    const characters = shuffleArray([...ALL_CHARACTERS]);

    const playerList = Array.from(this.playersPrivate.values());
    let shogunPlayerId = '';

    // Assign roles & characters
    playerList.forEach((player, idx) => {
      const role = roleDeck[idx];
      const roleId = role.id;
      const character = characters[idx];

      player.role = role;
      player.character = character;
      player.maxHp = character.maxHp;
      player.currentHp = character.maxHp;
      player.honorPoints = getInitialHonorPoints(playerCount, roleId);
      player.propertiesInPlay = [];
      player.weaponsPlayedThisTurn = 0;
      player.maxWeaponsPerTurn = 1; // ricalcolato all'inizio di ogni turno
      player.isDefeatedThisRound = false;
      player.hand = [];

      if (roleId === 'shogun') {
        shogunPlayerId = player.id;
      }
    });

    // Seating order: start with Shogun, then clockwise order of other players
    const otherPlayers = playerList.filter(p => p.id !== shogunPlayerId);
    const sortedPlayers = [
      this.playersPrivate.get(shogunPlayerId)!,
      ...shuffleArray(otherPlayers)
    ];

    this.state.turnOrder = sortedPlayers.map(p => p.id);

    // Initial hand distribution based on official rules:
    // Shogun: 4 cards; 2nd & 3rd: 5 cards; 4th & 5th: 6 cards; 6th & 7th: 7 cards
    sortedPlayers.forEach((p, turnPos) => {
      let cardsToDeal = 4;
      if (turnPos === 1 || turnPos === 2) cardsToDeal = 5;
      else if (turnPos === 3 || turnPos === 4) cardsToDeal = 6;
      else if (turnPos >= 5) cardsToDeal = 7;

      for (let i = 0; i < cardsToDeal; i++) {
        const card = this.drawOneCard();
        if (card) this.receive(p, card);
      }
      p.handCount = p.hand.length;
      p.isHarmless = p.hand.length === 0;
    });

    this.state.status = 'playing';
    this.state.turnPlayerId = shogunPlayerId;
    this.state.turnPhase = 'dealing';
    this.addLog(`La partita è iniziata! Distribuzione iniziale delle carte a tutti i guerrieri...`, 'info');
    this.notifyStateChange();

    // Fallback safety timeout: if client doesn't signal, automatically proceed after 25s
    setTimeout(() => {
      if (this.state.status === 'playing' && this.state.turnPhase === 'dealing') {
        this.completeInitialDeal();
      }
    }, 25000);

    return true;
  }

  public completeInitialDeal() {
    if (this.state.status !== 'playing' || this.state.turnPhase !== 'dealing') return;
    const shogunPlayerId = this.state.turnOrder[0];
    const shogunName = this.playersPrivate.get(shogunPlayerId)?.name || 'Lo Shōgun';
    this.addLog(`Tutte le carte sono state distribuite a tutti i guerrieri! Lo Shōgun ${shogunName} dà inizio alla battaglia!`, 'info');
    this.startTurn(shogunPlayerId);
  }

  private drawOneCard(): CardDef | null {
    if (this.deck.length === 0) {
      if (this.discardPile.length === 0) return null;
      this.addLog('Il mazzo è esaurito: gli scarti vengono rimescolati. Tutti i giocatori perdono 1 Punto Onore!', 'damage');
      this.emit({ kind: 'reshuffle' });
      this.emit({ kind: 'honor_loss', playerIds: Array.from(this.playersPrivate.keys()), reason: 'reshuffle' });
      this.deck = shuffleArray(this.discardPile);
      this.discardPile = [];

      // Regola ufficiale Samurai Sword: Tutti i giocatori perdono 1 Punto Onore
      this.playersPrivate.forEach(p => {
        p.honorPoints = Math.max(0, p.honorPoints - 1);
      });

      if (this.checkGameOver()) {
        return null;
      }
    }
    return this.deck.pop() ?? null;
  }

  private startTurn(playerId: string) {
    this.turnSerial++;
    this.state.turnPlayerId = playerId;
    this.state.turnPhase = 'recover';
    const player = this.playersPrivate.get(playerId);
    if (!player) return;

    this.addLog(`È il turno di ${player.name}.`, 'info');

    // 1. Recover Phase
    if (player.isDefeatedThisRound) {
      this.emit({ kind: 'heal', playerId: player.id, amount: player.maxHp - player.currentHp, reason: 'recover' });
      player.currentHp = player.maxHp;
      player.isDefeatedThisRound = false;
      this.addLog(`${player.name} si riprende e ripristina la propria Resistenza al massimo (${player.maxHp} PV)!`, 'heal');
    }

    // Reset turn counters
    player.weaponsPlayedThisTurn = 0;
    player.maxWeaponsPerTurn = this.baseWeaponsPerTurn(player);

    // Check Bushido in front of player
    const bushidoIndex = player.propertiesInPlay.findIndex(p => p.propertyType === 'bushido');
    if (bushidoIndex !== -1) {
      this.handleBushidoCheck(player, bushidoIndex);
      return;
    }

    this.notifyStateChange();

    setTimeout(() => {
      if (this.state.status !== 'playing' || this.state.turnPlayerId !== playerId) return;
      this.proceedToDrawPhase(player);
    }, 1600);
  }

  /** Variante a 3 giocatori: lo Shōgun ha regole speciali. */
  private isThreePlayerShogun(p: PlayerPrivateState): boolean {
    return this.playersPrivate.size === 3 && p.role.id === 'shogun';
  }

  /** Armi giocabili per turno: 1 (+1 Goemon, +1 Shōgun nella variante a 3, +1 per ogni Concentrazione). */
  private baseWeaponsPerTurn(p: PlayerPrivateState): number {
    const focus = p.propertiesInPlay.filter(c => c.propertyType === 'focus').length;
    return 1 + (p.character?.id === 'goemon' ? 1 : 0) + (this.isThreePlayerShogun(p) ? 1 : 0) + focus;
  }

  /** Carte da pescare nella Fase di Pesca: 2 (+1 Hideyoshi, +1 Shōgun nella variante a 3). */
  private drawCountFor(p: PlayerPrivateState): number {
    return 2 + (p.character?.id === 'hideyoshi' ? 1 : 0) + (this.isThreePlayerShogun(p) ? 1 : 0);
  }

  /** Carta Bushido in attesa della scelta del giocatore (scartare un'Arma o perdere 1 Onore). */
  private pendingBushidoCard: CardDef | null = null;

  private handleBushidoCheck(player: PlayerPrivateState, bushidoIndex: number) {
    const revealedCard = this.drawOneCard();
    if (this.state.status !== 'playing') return; // il rimescolamento del mazzo ha chiuso la partita
    if (!revealedCard) {
      this.proceedToDrawPhase(player);
      return;
    }

    this.discardPile.push(revealedCard);
    this.emit({ kind: 'bushido_reveal', playerId: player.id, cardTemplateId: revealedCard.templateId, isWeapon: revealedCard.type === 'weapon' });
    this.addLog(`${player.name} scopre per il Bushido: ${revealedCard.name}${revealedCard.type === 'weapon' ? ' (Arma!)' : ''}.`, 'info');

    const bushidoCard = player.propertiesInPlay.splice(bushidoIndex, 1)[0];

    if (revealedCard.type !== 'weapon') {
      // Non è un'Arma: il Bushido passa al giocatore a sinistra senza penalità
      this.passBushidoToLeft(player.id, bushidoCard);
      this.addLog(`Il Bushido non è stato innescato e passa al giocatore a sinistra.`, 'info');
      this.proceedToDrawPhase(player);
      return;
    }

    // Variante a 3 giocatori: lo Shōgun non perde mai Onore per il Bushido, lo scarta e basta
    if (this.isThreePlayerShogun(player)) {
      this.discardPile.push(bushidoCard);
      this.addLog(`${player.name} (Shōgun, variante a 3) è immune al Bushido e lo scarta.`, 'info');
      this.proceedToDrawPhase(player);
      return;
    }

    const hasWeapon = player.hand.some(c => c.type === 'weapon');
    if (!hasWeapon) {
      this.resolveBushido(player, bushidoCard, null);
      return;
    }

    // Il giocatore sceglie: scartare un'Arma (Bushido passa a sinistra) o perdere 1 Onore (Bushido scartato)
    this.pendingBushidoCard = bushidoCard;
    this.state.pendingReaction = {
      type: 'bushido',
      sourcePlayerId: player.id,
      targetPlayerIds: [player.id],
      pendingForPlayerId: player.id
    };
    this.state.turnPhase = 'response_wait';
    this.addLog(`${player.name} deve scegliere: scartare un'Arma o perdere 1 Punto Onore.`, 'info');
    this.notifyStateChange();
    this.checkBotAction();
  }

  /** Applica la scelta del Bushido. weaponCardId = null significa perdere 1 Onore. */
  private resolveBushido(player: PlayerPrivateState, bushidoCard: CardDef, weaponCardId: string | null) {
    const weapon = weaponCardId ? player.hand.find(c => c.id === weaponCardId && c.type === 'weapon') : undefined;
    if (weapon) {
      this.removeCardFromHand(player, weapon.id);
      this.discardPile.push(weapon);
      this.passBushidoToLeft(player.id, bushidoCard);
      this.addLog(`${player.name} scarta un'arma (${weapon.name}) per onorare il Bushido, che passa a sinistra.`, 'action');
    } else {
      this.discardPile.push(bushidoCard);
      player.honorPoints -= 1;
      this.emit({ kind: 'honor_loss', playerIds: [player.id], reason: 'bushido' });
      this.addLog(`${player.name} perde 1 Punto Onore per il Bushido! Il Bushido viene scartato.`, 'damage');
      if (this.checkGameOver()) return;
    }
    this.proceedToDrawPhase(player);
  }

  private passBushidoToLeft(fromPlayerId: string, bushidoCard: CardDef) {
    const order = this.state.turnOrder;
    const idx = order.indexOf(fromPlayerId);
    const leftPlayerId = order[(idx + 1) % order.length];
    const leftPlayer = this.playersPrivate.get(leftPlayerId);
    if (leftPlayer) {
      leftPlayer.propertiesInPlay.push(bushidoCard);
      this.emit({ kind: 'bushido_pass', fromId: fromPlayerId, toId: leftPlayer.id });
    }
  }

  private proceedToDrawPhase(player: PlayerPrivateState) {
    this.state.turnPhase = 'draw';

    // If character is Ieyasu and discard pile has cards, ask if want to draw from discard
    // If bot, decide automatically
    if (player.character?.id === 'ieyasu' && this.discardPile.length > 0) {
      if (this.isBotControlled(player)) {
        // Simple bot logic: draw from discard if top is weapon or daimyo
        const top = this.discardPile[this.discardPile.length - 1];
        if (top.type === 'weapon' || top.actionType === 'daimyo') {
          this.drawForIeyasu(player.id, true);
        } else {
          this.drawForIeyasu(player.id, false);
        }
        return;
      }
      this.notifyStateChange();
      return;
    }

    this.executeStandardDraw(player);
  }

  public drawForIeyasu(playerId: string, fromDiscard: boolean) {
    const player = this.playersPrivate.get(playerId);
    if (!player || this.state.turnPlayerId !== playerId || this.state.turnPhase !== 'draw') return;

    if (fromDiscard && this.discardPile.length > 0) {
      const top = this.discardPile.pop()!;
      player.hand.push(top);
      this.emit({ kind: 'draw', playerId: player.id, fromDiscard: true, cardTemplateId: top.templateId });
      this.addLog(`${player.name} (Ieyasu) pesca ${top.name} dagli scarti!`, 'action');
    } else {
      const c1 = this.drawOneCard();
      if (c1) this.receive(player, c1);
    }

    // Le altre carte arrivano sempre dal mazzo
    for (let i = 1; i < this.drawCountFor(player); i++) {
      const c = this.drawOneCard();
      if (c) this.receive(player, c);
    }

    this.notifyStateChange();

    setTimeout(() => {
      if (this.state.status !== 'playing' || this.state.turnPlayerId !== player.id) return;
      this.finishDrawPhase(player);
    }, 1400);
  }

  private executeStandardDraw(player: PlayerPrivateState) {
    // 2 carte; +1 Hideyoshi; +1 Shōgun nella variante a 3 giocatori
    const drawCount = this.drawCountFor(player);
    for (let i = 0; i < drawCount; i++) {
      const c = this.drawOneCard();
      if (c) this.receive(player, c);
    }

    const who = player.character?.id === 'hideyoshi' ? `${player.name} (Hideyoshi)` : player.name;
    this.addLog(`${who} pesca ${drawCount} carte dal mazzo.`, 'info');

    this.notifyStateChange();

    setTimeout(() => {
      if (this.state.status !== 'playing' || this.state.turnPlayerId !== player.id) return;
      this.finishDrawPhase(player);
    }, 1400);
  }

  private finishDrawPhase(player: PlayerPrivateState) {
    player.handCount = player.hand.length;
    player.isHarmless = player.hand.length === 0;
    this.state.turnPhase = 'play';
    this.notifyStateChange();
    this.checkBotAction();
  }

  // --- PLAY PHASE ACTIONS ---

  public attackWithWeapon(attackerId: string, weaponCardId: string, targetId: string): boolean {
    if (this.state.status !== 'playing' || this.state.turnPlayerId !== attackerId) return false;
    if (this.state.turnPhase !== 'play') return false;

    const attacker = this.playersPrivate.get(attackerId);
    const target = this.playersPrivate.get(targetId);
    if (!attacker || !target) return false;

    if (attacker.weaponsPlayedThisTurn >= attacker.maxWeaponsPerTurn) {
      return false;
    }

    const weaponCard = attacker.hand.find(c => c.id === weaponCardId);
    if (!weaponCard || weaponCard.type !== 'weapon') return false;

    // Allinea lo stato pubblico (posti, carte, Resistenza) prima di calcolare distanze e Difficoltà
    this.syncPublicState();
    const validation = canAttackWithWeapon(this.state.players, attacker, target, weaponCard);
    if (!validation.canAttack) {
      return false;
    }

    // Play weapon card from hand
    this.removeCardFromHand(attacker, weaponCardId);
    this.discardPile.push(weaponCard);
    attacker.weaponsPlayedThisTurn++;

    const damage = calculateAttackDamage(attacker, target, weaponCard);

    this.triggerCardPlayed(
      weaponCard,
      attacker,
      `${attacker.name} attacca ${target.name} con ${weaponCard.name}! (Danno: ${damage})`,
      target
    );

    this.addLog(
      `${attacker.name} attacca ${target.name} con ${weaponCard.name} (Gittata ${weaponCard.difficulty}, Danno: ${damage} PV)!`,
      'attack',
      {
        cardTemplateId: weaponCard.templateId,
        cardName: weaponCard.name,
        sourcePlayerId: attacker.id,
        sourcePlayerName: attacker.name,
        targetPlayerId: target.id,
        targetPlayerName: target.name,
        damage
      }
    );

    // Create pending reaction for target
    this.state.pendingReaction = {
      type: 'parry_weapon',
      sourcePlayerId: attackerId,
      targetPlayerIds: [targetId],
      weaponCard,
      damage,
      pendingForPlayerId: targetId
    };
    this.state.turnPhase = 'response_wait';

    this.notifyStateChange();
    this.checkBotAction();
    return true;
  }

  public playProperty(playerId: string, cardId: string): boolean {
    if (this.state.status !== 'playing' || this.state.turnPlayerId !== playerId) return false;
    if (this.state.turnPhase !== 'play') return false;

    const player = this.playersPrivate.get(playerId);
    if (!player) return false;

    const card = player.hand.find(c => c.id === cardId);
    if (!card || card.type !== 'property' || card.propertyType === 'bushido') return false;

    this.removeCardFromHand(player, cardId);
    player.propertiesInPlay.push(card);

    if (card.propertyType === 'focus') {
      player.maxWeaponsPerTurn++;
    }

    this.triggerCardPlayed(card, player, `${player.name} equipaggia ${card.name}!`);

    this.addLog(`${player.name} equipaggia ${card.name}.`, 'action', {
      cardTemplateId: card.templateId,
      cardName: card.name,
      sourcePlayerId: player.id,
      sourcePlayerName: player.name
    });
    this.notifyStateChange();
    this.checkBotAction();
    return true;
  }

  public playAction(
    playerId: string,
    cardId: string,
    targetPlayerId?: string,
    targetPropertyId?: string,
    /** Diversione/Geisha: posizione della carta coperta scelta dal giocatore nella mano del bersaglio */
    targetHandIndex?: number
  ): boolean {
    if (this.state.status !== 'playing' || this.state.turnPlayerId !== playerId) return false;
    if (this.state.turnPhase !== 'play') return false;

    const player = this.playersPrivate.get(playerId);
    if (!player) return false;

    const card = player.hand.find(c => c.id === cardId);
    if (!card || (card.type !== 'action' && card.propertyType !== 'bushido')) return false;

    // Handle Bushido (Property card played on other players)
    if (card.propertyType === 'bushido') {
      if (!targetPlayerId || targetPlayerId === playerId) return false;
      // Regola ufficiale: il Bushido si può giocare davanti a chiunque, anche a un Inoffensivo,
      // ma può esserci un solo Bushido in gioco alla volta
      const target = this.playersPrivate.get(targetPlayerId);
      if (!target || this.isBushidoInPlay()) return false;

      this.removeCardFromHand(player, cardId);
      target.propertiesInPlay.push(card);
      this.triggerCardPlayed(card, player, `${player.name} gioca Bushido davanti a ${target.name}!`, target);
      this.addLog(`${player.name} gioca Bushido davanti a ${target.name}!`, 'action');
      this.notifyStateChange();
      this.checkBotAction();
      return true;
    }

    // Action cards
    switch (card.actionType) {
      case 'tea_ceremony': {
        this.removeCardFromHand(player, cardId);
        this.discardPile.push(card);
        this.triggerCardPlayed(card, player, `${player.name} indice la Cerimonia del Tè!`);
        this.addLog(`${player.name} indice la Cerimonia del Tè!`, 'action');

        // Drawer draws 3 cards
        for (let i = 0; i < 3; i++) {
          const c = this.drawOneCard();
          if (c) this.receive(player, c);
        }
        // Everyone else draws 1 card
        this.playersPrivate.forEach(p => {
          if (p.id !== playerId) {
            const c = this.drawOneCard();
            if (c) {
              this.receive(p, c);
              this.addLog(`${p.name} pesca 1 carta per la Cerimonia del Tè.`, 'info');
            }
          }
        });
        break;
      }

      case 'daimyo': {
        this.removeCardFromHand(player, cardId);
        this.discardPile.push(card);
        this.triggerCardPlayed(card, player, `${player.name} gioca Daimyo e pesca 2 carte!`);
        this.addLog(`${player.name} gioca Daimyo e pesca 2 carte.`, 'action', {
          cardTemplateId: 'daimyo',
          cardName: 'Daimyo',
          sourcePlayerId: player.id,
          sourcePlayerName: player.name
        });
        for (let i = 0; i < 2; i++) {
          const c = this.drawOneCard();
          if (c) this.receive(player, c);
        }
        break;
      }

      case 'breathing': {
        if (!targetPlayerId || targetPlayerId === playerId) return false;
        const otherPlayer = this.playersPrivate.get(targetPlayerId);
        if (!otherPlayer) return false;

        this.removeCardFromHand(player, cardId);
        this.discardPile.push(card);

        // Player heals to full
        const healed = player.maxHp - player.currentHp;
        player.currentHp = player.maxHp;
        this.emit({ kind: 'heal', playerId: player.id, amount: healed, reason: 'breathing' });
        this.triggerCardPlayed(card, player, `${player.name} usa Respirazione e recupera tutte le ferite!`, otherPlayer);
        this.addLog(`${player.name} usa Respirazione e recupera tutte le ferite (${healed} PV recuperati)!`, 'heal');

        // Other player draws 1 card
        const cardDrawn = this.drawOneCard();
        if (cardDrawn) {
          this.receive(otherPlayer, cardDrawn);
          this.addLog(`${otherPlayer.name} pesca 1 carta grazie alla Respirazione di ${player.name}.`, 'info');
        }
        break;
      }

      case 'diversion': {
        if (!targetPlayerId || targetPlayerId === playerId) return false;
        const target = this.playersPrivate.get(targetPlayerId);
        if (!target || target.hand.length === 0) return false;

        this.removeCardFromHand(player, cardId);
        this.discardPile.push(card);

        // Il giocatore sceglie una carta coperta: resta comunque casuale (non può sapere cosa c'è sotto)
        // (l'indice va calcolato prima: pickHiddenCardIndex rimescola e sostituisce l'array della mano)
        const stealIndex = this.pickHiddenCardIndex(target, targetHandIndex);
        const stolenCard = target.hand.splice(stealIndex, 1)[0];
        player.hand.push(stolenCard);
        this.emit({ kind: 'steal', fromId: target.id, toId: player.id });

        this.triggerCardPlayed(card, player, `${player.name} usa Diversione su ${target.name}!`, target);
        this.addLog(`${player.name} usa Diversione e ruba 1 carta segreta dalla mano di ${target.name}!`, 'action');
        break;
      }

      case 'geisha': {
        if (!targetPlayerId || targetPlayerId === playerId) return false;
        const target = this.playersPrivate.get(targetPlayerId);
        if (!target) return false;

        this.removeCardFromHand(player, cardId);
        this.discardPile.push(card);

        this.triggerCardPlayed(card, player, `${player.name} usa Geisha su ${target.name}!`, target);

        if (targetPropertyId) {
          // Discard specific property in play
          const pIdx = target.propertiesInPlay.findIndex(p => p.id === targetPropertyId);
          if (pIdx !== -1) {
            const discardedProp = target.propertiesInPlay.splice(pIdx, 1)[0];
            this.discardPile.push(discardedProp);
            this.emit({ kind: 'property_removed', playerId: target.id, cardTemplateId: discardedProp.templateId });
            this.addLog(`${player.name} usa Geisha e fa scartare ${discardedProp.name} di ${target.name}!`, 'action');
          }
        } else if (target.hand.length > 0) {
          // Carta coperta scelta dal giocatore (casuale: non si vede cosa c'è sotto)
          const discardIndex = this.pickHiddenCardIndex(target, targetHandIndex);
          const discardedHand = target.hand.splice(discardIndex, 1)[0];
          this.discardPile.push(discardedHand);
          this.emit({ kind: 'discard_from_hand', playerId: target.id, cardTemplateId: discardedHand.templateId });
          this.addLog(`${player.name} usa Geisha e fa scartare una carta dalla mano di ${target.name}!`, 'action');
        }
        break;
      }

      case 'battle_cry': {
        this.removeCardFromHand(player, cardId);
        this.discardPile.push(card);
        this.triggerCardPlayed(card, player, `${player.name} lancia il Grido di Battaglia!`);
        this.addLog(`${player.name} lancia un Grido di Battaglia!`, 'attack');

        // All other players who are not harmless and not Chiyome must respond
        const targets = this.state.turnOrder.filter(id => {
          if (id === playerId) return false;
          const p = this.playersPrivate.get(id);
          if (!p || this.harmless(p)) return false;
          if (p.character?.id === 'chiyome') {
            this.addLog(`${p.name} (Chiyome) è immune al Grido di Battaglia!`, 'info');
            return false;
          }
          return true;
        });

        if (targets.length === 0) {
          break;
        }

        this.state.pendingReaction = {
          type: 'battle_cry',
          sourcePlayerId: playerId,
          targetPlayerIds: targets,
          pendingForPlayerId: targets[0]
        };
        this.state.turnPhase = 'response_wait';
        break;
      }

      case 'jujutsu': {
        this.removeCardFromHand(player, cardId);
        this.discardPile.push(card);
        this.triggerCardPlayed(card, player, `${player.name} usa il Jiujitsu!`);
        this.addLog(`${player.name} esegue una tecnica di Jiujitsu!`, 'attack');

        const targets = this.state.turnOrder.filter(id => {
          if (id === playerId) return false;
          const p = this.playersPrivate.get(id);
          if (!p || this.harmless(p)) return false;
          if (p.character?.id === 'chiyome') {
            this.addLog(`${p.name} (Chiyome) è immune al Jiujitsu!`, 'info');
            return false;
          }
          return true;
        });

        if (targets.length === 0) {
          break;
        }

        this.state.pendingReaction = {
          type: 'jujutsu',
          sourcePlayerId: playerId,
          targetPlayerIds: targets,
          pendingForPlayerId: targets[0]
        };
        this.state.turnPhase = 'response_wait';
        break;
      }

      default:
        return false;
    }

    this.notifyStateChange();
    this.checkBotAction();
    return true;
  }

  // --- REACTION RESPONSES (PARRY / JUJUTSU / BATTLE CRY) ---

  public submitReaction(playerId: string, responseCardId: string | null): boolean {
    const reaction = this.state.pendingReaction;
    if (!reaction || reaction.pendingForPlayerId !== playerId) return false;

    const player = this.playersPrivate.get(playerId);
    const sourcePlayer = this.playersPrivate.get(reaction.sourcePlayerId);
    if (!player || !sourcePlayer) return false;

    if (reaction.type === 'parry_weapon') {
      if (responseCardId) {
        // Deve essere una Parata (o arma se Hanzo con >1 carta)
        const card = player.hand.find(c => c.id === responseCardId);
        const isParry = card?.actionType === 'parry';
        const isHanzoWeapon = player.character?.id === 'hanzo' && card?.type === 'weapon' && player.hand.length > 1;

        if (isParry || isHanzoWeapon) {
          this.removeCardFromHand(player, responseCardId);
          this.discardPile.push(card!);
          this.triggerCardPlayed(
            card!,
            player,
            `${player.name} para l'attacco con ${card!.name}!`,
            sourcePlayer
          );
          this.addLog(
            `${player.name} para l'attacco con ${card!.name}! Nessun danno subito.`,
            'action'
          );
          this.emit({ kind: 'parry', playerId: player.id, sourceId: sourcePlayer.id, cardTemplateId: card!.templateId, against: 'weapon' });
          this.state.pendingReaction = null;
          this.state.turnPhase = 'play';
          this.notifyStateChange();
          this.checkBotAction();
          return true;
        } else {
          return false; // Carta non valida per parare
        }
      } else {
        // Nessuna Parata giocata -> Subisce danno
        const damage = reaction.damage ?? 1;
        this.inflictDamage(sourcePlayer, player, damage, true);
        this.state.pendingReaction = null;
        this.state.turnPhase = 'play';
        this.notifyStateChange();
        this.checkBotAction();
        return true;
      }
    }

    if (reaction.type === 'bushido') {
      const bushidoCard = this.pendingBushidoCard;
      if (responseCardId) {
        const card = player.hand.find(c => c.id === responseCardId);
        if (card?.type !== 'weapon') return false; // per il Bushido serve un'Arma
      }
      this.state.pendingReaction = null;
      this.pendingBushidoCard = null;
      if (bushidoCard) {
        this.resolveBushido(player, bushidoCard, responseCardId);
      } else {
        this.proceedToDrawPhase(player);
      }
      return true;
    }

    if (reaction.type === 'battle_cry') {
      if (responseCardId) {
        const card = player.hand.find(c => c.id === responseCardId);
        // Serve una Parata; Hanzō può usare un'Arma come Parata (se non è la sua unica carta)
        const isParry = card?.actionType === 'parry';
        const isHanzoWeapon = player.character?.id === 'hanzo' && card?.type === 'weapon' && player.hand.length > 1;

        if (isParry || isHanzoWeapon) {
          this.removeCardFromHand(player, responseCardId);
          this.discardPile.push(card!);
          this.triggerCardPlayed(card!, player, `${player.name} scarta ${card!.name} contro il Grido di Battaglia!`, sourcePlayer);
          this.emit({ kind: 'parry', playerId: player.id, sourceId: sourcePlayer.id, cardTemplateId: card!.templateId, against: 'battle_cry' });
          this.addLog(
            isParry
              ? `${player.name} scarta una Parata per evitare il danno del Grido di Battaglia.`
              : `${player.name} (Hanzō) usa ${card!.name} come Parata contro il Grido di Battaglia.`,
            'action'
          );
        } else {
          return false; // Carta non valida contro il Grido di Battaglia
        }
      } else {
        this.inflictDamage(sourcePlayer, player, 1, false);
      }

      this.advanceReactionQueue();
      return true;
    }

    if (reaction.type === 'jujutsu') {
      if (responseCardId) {
        const card = player.hand.find(c => c.id === responseCardId);
        if (card?.type === 'weapon') {
          this.removeCardFromHand(player, responseCardId);
          this.discardPile.push(card);
          this.triggerCardPlayed(card, player, `${player.name} scarta ${card.name} per il Jiujitsu!`, sourcePlayer);
          this.addLog(`${player.name} scarta l'arma ${card.name} per evitare il Jiujitsu.`, 'action');
          this.emit({ kind: 'parry', playerId: player.id, sourceId: sourcePlayer.id, cardTemplateId: card.templateId, against: 'jujutsu' });
        } else {
          return false; // Carta non valida: per Jiujitsu serve una carta Arma
        }
      } else {
        this.inflictDamage(sourcePlayer, player, 1, false);
      }

      this.advanceReactionQueue();
      return true;
    }

    return false;
  }

  private advanceReactionQueue() {
    const reaction = this.state.pendingReaction;
    if (!reaction) return;

    const remaining = reaction.targetPlayerIds.filter(id => id !== reaction.pendingForPlayerId);
    if (remaining.length === 0) {
      this.state.pendingReaction = null;
      this.state.turnPhase = 'play';
    } else {
      reaction.targetPlayerIds = remaining;
      reaction.pendingForPlayerId = remaining[0];
    }

    this.notifyStateChange();
    this.checkBotAction();
  }

  // --- DAMAGE & HONOR LOGIC ---

  private inflictDamage(
    attacker: PlayerPrivateState,
    target: PlayerPrivateState,
    wounds: number,
    isWeaponDamage: boolean
  ) {
    target.currentHp = Math.max(0, target.currentHp - wounds);
    this.emit({ kind: 'damage', targetId: target.id, sourceId: attacker.id, amount: wounds, weapon: isWeaponDamage, hpLeft: target.currentHp });
    this.addLog(`${target.name} subisce ${wounds} ferite! (Resistenza rimasta: ${target.currentHp}/${target.maxHp})`, 'damage');

    // Attacker character triggers:
    // Tomoe: if wounds dealt with weapon, draws 1 card
    if (isWeaponDamage && wounds > 0 && attacker.character?.id === 'tomoe') {
      const bonusCard = this.drawOneCard();
      if (bonusCard) {
        this.receive(attacker, bonusCard);
        this.addLog(`${attacker.name} (Tomoe) pesca 1 carta per aver ferito un avversario!`, 'info');
      }
    }

    // Target character triggers:
    // Ushiwaka: draws 1 card per wound taken from weapon
    if (isWeaponDamage && target.character?.id === 'ushiwaka') {
      for (let i = 0; i < wounds; i++) {
        const c = this.drawOneCard();
        if (c) this.receive(target, c);
      }
      this.addLog(`${target.name} (Ushiwaka) pesca ${wounds} carte per le ferite subite!`, 'info');
    }

    // Check if target is defeated (0 HP)
    if (target.currentHp <= 0) {
      this.handlePlayerDefeated(attacker, target);
    }
  }

  private handlePlayerDefeated(attacker: PlayerPrivateState, target: PlayerPrivateState) {
    this.addLog(`⚔️ ${target.name} è stato abbattuto da ${attacker.name}!`, 'defeat');
    this.emit({ kind: 'defeat', targetId: target.id, attackerId: attacker.id });
    this.emit({ kind: 'honor_transfer', fromId: target.id, toId: attacker.id });

    // Il giocatore abbattuto cede 1 Punto Onore a chi l'ha abbattuto
    target.honorPoints = Math.max(0, target.honorPoints - 1);
    attacker.honorPoints += 1;
    this.addLog(`${attacker.name} conquista 1 Punto Onore da ${target.name}!`, 'defeat');

    // Target becomes defeated/harmless until their next turn
    target.isDefeatedThisRound = true;
    target.isHarmless = true;

    // Fine partita per Onore esaurito. Colpo Mortale: se a chiudere la partita è l'abbattimento
    // di un compagno di squadra, quella squadra perde 3 punti.
    if (target.honorPoints <= 0) {
      const teammate = attacker.id !== target.id && attacker.role.team === target.role.team;
      if (teammate) {
        this.addLog(`💀 Colpo Mortale! ${attacker.name} ha abbattuto un compagno di squadra: la sua squadra perde 3 punti.`, 'end');
        this.triggerGameOver({ deadlyStrikeTeam: attacker.role.team });
      } else {
        this.triggerGameOver();
      }
      return;
    }
    if (this.checkGameOver()) return;

    // Vittoria del Maestro di Spada: se un solo giocatore ha ancora Resistenza, la sua squadra vince subito
    // (non vale nella variante a 3 giocatori)
    if (this.playersPrivate.size > 3) {
      const standing = Array.from(this.playersPrivate.values()).filter(p => p.currentHp > 0);
      if (standing.length === 1) {
        const master = standing[0];
        this.addLog(`🗡️ ${master.name} è l'unico guerriero ancora in piedi: Vittoria del Maestro di Spada!`, 'end');
        this.triggerGameOver({ swordmasterTeam: master.role.team, swordmasterName: master.name });
        return;
      }
    }

    // REGOLA UFFICIALE SAMURAI SWORD: Il giocatore abbattuto NON scarta la mano né le proprietà!
    // Rimane semplicemente Inoffensivo fino al suo prossimo turno, quando recupererà tutta la Resistenza al massimo.
    this.addLog(`${target.name} è Inoffensivo fino al suo prossimo turno (recupererà tutti i punti ferita e mantiene le sue carte).`, 'info');
  }

  /**
   * Indice reale della carta "scelta" tra quelle coperte di un avversario.
   * La mano viene prima mescolata: la posizione scelta non può rivelare quale carta sia
   * (es. l'ultima pescata), quindi la scelta resta alla cieca come al tavolo vero.
   */
  private pickHiddenCardIndex(target: PlayerPrivateState, chosen?: number): number {
    target.hand = shuffleArray(target.hand);
    if (typeof chosen === 'number' && Number.isInteger(chosen) && chosen >= 0 && chosen < target.hand.length) return chosen;
    return Math.floor(Math.random() * target.hand.length);
  }

  private isBushidoInPlay(): boolean {
    return Array.from(this.playersPrivate.values()).some(p => p.propertiesInPlay.some(c => c.propertyType === 'bushido'));
  }

  public useNobunagaAbility(playerId: string): boolean {
    if (this.state.status !== 'playing' || this.state.turnPlayerId !== playerId) return false;
    if (this.state.turnPhase !== 'play') return false;

    const player = this.playersPrivate.get(playerId);
    if (!player || player.character?.id !== 'nobunaga') return false;
    if (player.currentHp <= 1) return false; // cannot sacrifice last HP

    player.currentHp -= 1;
    this.emit({ kind: 'damage', targetId: player.id, sourceId: player.id, amount: 1, weapon: false, hpLeft: player.currentHp });
    const card = this.drawOneCard();
    if (card) this.receive(player, card);

    this.addLog(`${player.name} (Nobunaga) sacrifica 1 punto Resistenza per pescare una carta!`, 'action');
    this.notifyStateChange();
    this.checkBotAction();
    return true;
  }

  // --- END TURN & DISCARD PHASE ---

  public endPlayPhase(playerId: string): boolean {
    if (this.state.status !== 'playing' || this.state.turnPlayerId !== playerId) return false;
    if (this.state.turnPhase !== 'play') return false;

    const player = this.playersPrivate.get(playerId);
    if (!player) return false;

    // Regola ufficiale Samurai Sword: limite massimo di 7 carte in mano alla fine del proprio turno
    const maxHandLimit = 7;
    const excess = player.hand.length - maxHandLimit;
    if (excess > 0) {
      this.state.turnPhase = 'discard';
      this.addLog(`${player.name} deve scartare ${excess} carte per rispettare il limite massimo di 7 carte in mano.`, 'info');
      this.notifyStateChange();
      this.checkBotAction();
      return true;
    }

    this.finishTurn(playerId);
    return true;
  }

  public discardExcessCards(playerId: string, cardIds: string[]): boolean {
    if (this.state.status !== 'playing' || this.state.turnPlayerId !== playerId) return false;
    if (this.state.turnPhase !== 'discard') return false;

    const player = this.playersPrivate.get(playerId);
    if (!player) return false;

    const maxHandLimit = 7;
    const excess = player.hand.length - maxHandLimit;
    if (cardIds.length !== excess) return false;

    for (const cardId of cardIds) {
      const idx = player.hand.findIndex(c => c.id === cardId);
      if (idx !== -1) {
        const discarded = player.hand.splice(idx, 1)[0];
        this.discardPile.push(discarded);
      }
    }

    this.addLog(`${player.name} ha scartato ${cardIds.length} carte in eccesso.`, 'info');
    this.finishTurn(playerId);
    return true;
  }

  public finishTurn(playerId: string) {
    const order = this.state.turnOrder;
    const currentIdx = order.indexOf(playerId);
    const nextIdx = (currentIdx + 1) % order.length;
    const nextPlayerId = order[nextIdx];

    this.notifyStateChange();
    // 1.5s delay between turns so player transition is natural and readable
    setTimeout(() => {
      if (this.state.status !== 'playing') return;
      this.startTurn(nextPlayerId);
    }, 1500);
  }

  // --- GAME OVER & SCORING ---

  private checkGameOver(): boolean {
    const anyZeroHonor = Array.from(this.playersPrivate.values()).some(p => p.honorPoints <= 0);
    if (anyZeroHonor) {
      this.triggerGameOver();
      return true;
    }
    return false;
  }

  private triggerGameOver(
    opts: { deadlyStrikeTeam?: 'shogun' | 'ninja' | 'ronin'; swordmasterTeam?: 'shogun' | 'ninja' | 'ronin'; swordmasterName?: string } = {}
  ) {
    if (this.state.status === 'game_over') return;
    this.state.status = 'game_over';
    this.state.pendingReaction = null;
    this.pendingBushidoCard = null;

    // Reveal all roles
    this.playersPrivate.forEach(p => {
      p.role = { ...p.role, isRevealed: true };
    });

    const scores = calculateFinalScores(Array.from(this.playersPrivate.values()), {
      deadlyStrikeTeam: opts.deadlyStrikeTeam,
      swordmasterTeam: opts.swordmasterTeam
    });

    const teamNames = {
      shogun: 'Squadra Shōgun & Samurai',
      ninja: 'Squadra Ninja',
      ronin: 'Il Ronin',
      draw: 'Pareggio'
    };

    let summary: string;
    if (opts.swordmasterTeam) {
      summary = `${opts.swordmasterName ?? 'Un guerriero'} è rimasto l'unico in piedi: Vittoria del Maestro di Spada per ${teamNames[opts.swordmasterTeam]}.`;
    } else {
      const zero = Array.from(this.playersPrivate.values()).filter(p => p.honorPoints <= 0).map(p => p.name);
      summary = `${zero.join(', ') || 'Un giocatore'} ha esaurito i Punti Onore.`;
      if (opts.deadlyStrikeTeam) summary += ` Colpo Mortale: ${teamNames[opts.deadlyStrikeTeam]} perde 3 punti.`;
      const present = new Set(Array.from(this.playersPrivate.values()).map(p => p.role.team));
      const totals = [
        present.has('shogun') ? scores.shogunSamurai : null,
        present.has('ninja') ? scores.ninja : null,
        present.has('ronin') ? scores.ronin : null
      ].filter((t): t is number => t !== null);
      const best = Math.max(...totals);
      if (totals.filter(t => t === best).length > 1) {
        summary += ' Pareggio risolto dalle regole: i Ninja vincono ogni pareggio, Shōgun & Samurai battono il Ronin.';
      }
    }

    this.addLog(`🏆 Partita terminata! ${summary}`, 'end');

    this.state.winnerTeam = scores.winnerTeam;
    this.emit({ kind: 'game_over', winnerTeam: scores.winnerTeam, endReason: opts.swordmasterTeam ? 'swordmaster' : 'honor' });
    this.state.finalScores = {
      ...scores,
      endReason: opts.swordmasterTeam ? 'swordmaster' : 'honor',
      deadlyStrikeTeam: opts.deadlyStrikeTeam,
      summary
    };

    this.addLog(`Vittoria per: ${teamNames[scores.winnerTeam]}!`, 'end');
    this.notifyStateChange();
  }

  // --- BOT EXECUTION ---

  private checkBotAction() {
    if (this.disposed || this.state.status !== 'playing' || this.state.turnPhase === 'dealing') return;

    // 1. Reazione in sospeso (Parata / Grido di Battaglia / Jiujitsu)
    if (this.state.pendingReaction) {
      const reactionRef = this.state.pendingReaction;
      const targetId = reactionRef.pendingForPlayerId;
      const target = this.playersPrivate.get(targetId);
      if (target && this.isBotControlled(target)) {
        // 2.4s così tutti vedono la carta d'attacco prima della risposta del bot
        setTimeout(() => {
          if (this.state.status !== 'playing') return;
          if (this.state.pendingReaction !== reactionRef || reactionRef.pendingForPlayerId !== targetId) return;
          if (!this.isBotControlled(target)) return;
          const before = this.actionCounter;
          try {
            BotAI.respondToReaction(this, targetId);
          } catch (err) {
            console.error('[BotAI] errore durante la reazione:', err);
          }
          // Paracadute: se il bot non è riuscito a rispondere, incassa il colpo invece di bloccare la partita
          if (
            this.actionCounter === before &&
            this.state.pendingReaction === reactionRef &&
            reactionRef.pendingForPlayerId === targetId
          ) {
            this.submitReaction(targetId, null);
          }
        }, 2400);
      }
      return;
    }

    // 2. Turno del giocatore attivo
    const curr = this.playersPrivate.get(this.state.turnPlayerId);
    if (!curr || !this.isBotControlled(curr)) return;
    const phase = this.state.turnPhase;
    const stillMyMove = () =>
      this.state.status === 'playing' &&
      this.state.turnPlayerId === curr.id &&
      this.state.turnPhase === phase &&
      !this.state.pendingReaction &&
      this.isBotControlled(curr);

    if (phase === 'play') {
      // Pausa "umana" mentre il bot valuta la situazione: 2.2s
      setTimeout(() => {
        if (!stillMyMove()) return;
        const before = this.actionCounter;
        try {
          BotAI.playTurn(this, curr.id);
        } catch (err) {
          console.error('[BotAI] errore durante il turno:', err);
        }
        // Paracadute: se nessuna mossa è stata accettata dal motore, il bot chiude il turno
        if (this.actionCounter === before && stillMyMove()) {
          this.endPlayPhase(curr.id);
        }
      }, 2200);
    } else if (phase === 'discard') {
      setTimeout(() => {
        if (!stillMyMove()) return;
        try {
          BotAI.discardDown(this, curr.id);
        } catch (err) {
          console.error('[BotAI] errore durante lo scarto:', err);
        }
        if (stillMyMove()) {
          const excess = curr.hand.length - 7;
          if (excess > 0) this.discardExcessCards(curr.id, curr.hand.slice(0, excess).map(c => c.id));
          else this.finishTurn(curr.id);
        }
      }, 1600);
    } else if (phase === 'draw' && curr.character?.id === 'ieyasu') {
      // Ieyasu umano andato offline mentre doveva scegliere da dove pescare
      setTimeout(() => {
        if (!stillMyMove()) return;
        this.drawForIeyasu(curr.id, false);
      }, 1200);
    }
  }

  // --- UTILS & STATE SYNC ---

  private removeCardFromHand(player: PlayerPrivateState, cardId: string) {
    const index = player.hand.findIndex(c => c.id === cardId);
    if (index !== -1) {
      player.hand.splice(index, 1);
    }
  }

  private syncPublicState() {
    // IMPORTANTE: l'array dei giocatori segue l'ordine dei posti al tavolo (turnOrder),
    // perché distanze e Difficoltà vengono calcolate sulla posizione nell'array.
    const all = Array.from(this.playersPrivate.values());
    const seated =
      this.state.turnOrder.length === all.length
        ? this.state.turnOrder.map(id => this.playersPrivate.get(id)).filter((p): p is PlayerPrivateState => !!p)
        : all;

    seated.forEach(p => {
      p.handCount = p.hand.length;
      p.isHarmless = this.harmless(p);
    });

    this.state.players = seated.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isBot: p.isBot,
      character: p.character,
      // Reveal role only if Shogun or if game is over
      role: (p.role.isRevealed || this.state.status === 'game_over') ? p.role : null,
      currentHp: p.currentHp,
      maxHp: p.maxHp,
      honorPoints: p.honorPoints,
      isHarmless: p.isHarmless,
      isDefeatedThisRound: p.isDefeatedThisRound,
      isConnected: p.isConnected,
      isAway: p.isAway,
      handCount: p.hand.length,
      propertiesInPlay: p.propertiesInPlay,
      weaponsPlayedThisTurn: p.weaponsPlayedThisTurn,
      maxWeaponsPerTurn: p.maxWeaponsPerTurn
    }));

    this.state.deckCount = this.deck.length;
    this.state.discardPileCount = this.discardPile.length;
    this.state.discardPileTop = this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null;
  }

  /**
   * Returns tailored GameState for a specific client (with their private hand and private role).
   */
  public getStateForPlayer(playerId: string): GameState & { myPrivateState?: PlayerPrivateState } {
    const privateState = this.playersPrivate.get(playerId);
    const hasDecision = !!this.decisionTimer && this.decisionDeadline > 0;
    return {
      ...this.state,
      decisionPlayerId: hasDecision ? this.decisionKey.split('|')[0] : null,
      decisionMsLeft: hasDecision ? Math.max(0, this.decisionDeadline - Date.now()) : null,
      myPrivateState: privateState
    };
  }

  // --- TIMER DELLE DECISIONI (evita partite bloccate da chi si allontana) ---

  /** Chi deve decidere adesso e che tipo di decisione è. */
  private currentDecision(): { playerId: string; kind: keyof typeof DECISION_TIME_MS } | null {
    if (this.state.status !== 'playing') return null;
    if (this.state.pendingReaction) {
      return { playerId: this.state.pendingReaction.pendingForPlayerId, kind: 'reaction' };
    }
    const phase = this.state.turnPhase;
    const id = this.state.turnPlayerId;
    if (phase === 'play') return { playerId: id, kind: 'play' };
    if (phase === 'discard') return { playerId: id, kind: 'discard' };
    if (phase === 'draw' && this.playersPrivate.get(id)?.character?.id === 'ieyasu') return { playerId: id, kind: 'draw' };
    return null;
  }

  private updateDecisionTimer() {
    const d = this.currentDecision();
    const player = d ? this.playersPrivate.get(d.playerId) : undefined;
    const timerOn = this.state.settings?.turnTimer !== 'off';
    const needsTimer = GameEngine.decisionTimersEnabled && timerOn && !!d && !!player && !this.isBotControlled(player);
    const r = this.state.pendingReaction;
    const key = needsTimer
      ? `${d!.playerId}|${d!.kind}|${this.turnSerial}|${r ? `${r.type}:${r.sourcePlayerId}:${r.weaponCard?.id ?? ''}:${r.targetPlayerIds.length}` : ''}`
      : '';

    if (key === this.decisionKey) return; // stessa decisione: il timer continua
    if (this.decisionTimer) clearTimeout(this.decisionTimer);
    this.decisionTimer = null;
    this.decisionKey = key;
    this.decisionDeadline = 0;
    if (!needsTimer) return;

    // Turno da 1 minuto se scelto dall'host, altrimenti la durata standard
    const ms = d!.kind === 'play' && this.state.settings?.turnTimer === '60' ? 60_000 : DECISION_TIME_MS[d!.kind];
    this.decisionDeadline = Date.now() + ms;
    this.decisionTimer = setTimeout(() => {
      this.decisionTimer = null;
      if (this.disposed || this.decisionKey !== key || this.state.status !== 'playing') return;
      this.onDecisionTimeout(d!.playerId, d!.kind);
    }, ms);
  }

  /** Tempo scaduto: l'IA prende la decisione al posto del giocatore (solo per questa volta). */
  private onDecisionTimeout(playerId: string, kind: keyof typeof DECISION_TIME_MS) {
    const p = this.playersPrivate.get(playerId);
    if (!p) return;
    this.decisionKey = '';
    this.addLog(`⏳ Tempo scaduto per ${p.name}: si procede automaticamente.`, 'info');
    const before = this.actionCounter;
    try {
      if (kind === 'reaction') BotAI.respondToReaction(this, playerId);
      else if (kind === 'play') {
        this.endPlayPhase(playerId);
        // Se deve scartare oltre le 7 carte, scarta subito l'IA invece di far partire un altro timer
        if (this.state.turnPhase === 'discard' && this.state.turnPlayerId === playerId) BotAI.discardDown(this, playerId);
      } else if (kind === 'discard') BotAI.discardDown(this, playerId);
      else if (kind === 'draw') this.drawForIeyasu(playerId, false);
    } catch (err) {
      console.error('[GameEngine] errore nella decisione automatica:', err);
    }
    // Paracadute finale
    if (this.actionCounter === before && this.state.status === 'playing') {
      if (kind === 'reaction' && this.state.pendingReaction?.pendingForPlayerId === playerId) this.submitReaction(playerId, null);
      else if (kind === 'play' && this.state.turnPhase === 'play') this.finishTurn(playerId);
    }
  }
}
