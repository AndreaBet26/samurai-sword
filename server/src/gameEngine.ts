import { v4 as uuidv4 } from 'uuid';
import {
  CardDef,
  CharacterDef,
  GameLogEntry,
  GameState,
  PendingReaction,
  PlayerPrivateState,
  PlayerPublicState,
  RoleDef,
  RoleId,
  TurnPhase
} from '../../shared/types';
import { ALL_CHARACTERS } from '../../shared/charactersData';
import { CARD_TEMPLATES, buildDeck, shuffleArray } from '../../shared/cardsData';
import { getInitialHonorPoints, getRoleDistribution, ROLES_DATA } from '../../shared/rolesData';
import {
  calculateAttackDamage,
  calculateDistance,
  calculateFinalScores,
  calculateTargetDifficulty,
  canAttackWithWeapon
} from '../../shared/rules';
import { BotAI } from './botLogic';

export class GameEngine {
  public state: GameState;
  private playersPrivate: Map<string, PlayerPrivateState> = new Map();
  private deck: CardDef[] = [];
  private discardPile: CardDef[] = [];
  private onStateChangeCallback?: () => void;

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
      logs: []
    };
  }

  public setOnStateChange(cb: () => void) {
    this.onStateChangeCallback = cb;
  }

  private notifyStateChange() {
    this.syncPublicState();
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
          const first = Array.from(this.playersPrivate.values())[0];
          first.isHost = true;
        }
        this.notifyStateChange();
      }
    }
  }

  public startGame(): boolean {
    const playerCount = this.playersPrivate.size;
    if (playerCount < 3 || playerCount > 7) {
      return false;
    }

    this.deck = buildDeck();
    this.discardPile = [];
    this.state.logs = [];

    // Assign roles
    const roleIds = shuffleArray(getRoleDistribution(playerCount));
    const characters = shuffleArray([...ALL_CHARACTERS]);

    const playerList = Array.from(this.playersPrivate.values());
    let shogunPlayerId = '';

    // Assign roles & characters
    playerList.forEach((player, idx) => {
      const roleId = roleIds[idx];
      const role = { ...ROLES_DATA[roleId] };
      const character = characters[idx];

      player.role = role;
      player.character = character;
      player.maxHp = character.maxHp;
      player.currentHp = character.maxHp;
      player.honorPoints = getInitialHonorPoints(playerCount, roleId);
      player.propertiesInPlay = [];
      player.weaponsPlayedThisTurn = 0;
      player.maxWeaponsPerTurn = character.id === 'goemon' ? 2 : 1;
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
        if (card) p.hand.push(card);
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
    this.state.turnPlayerId = playerId;
    this.state.turnPhase = 'recover';
    const player = this.playersPrivate.get(playerId);
    if (!player) return;

    this.addLog(`È il turno di ${player.name}.`, 'info');

    // 1. Recover Phase
    if (player.isDefeatedThisRound) {
      player.currentHp = player.maxHp;
      player.isDefeatedThisRound = false;
      this.addLog(`${player.name} si riprende e ripristina la propria Resistenza al massimo (${player.maxHp} PV)!`, 'heal');
    }

    // Reset turn counters
    player.weaponsPlayedThisTurn = 0;
    const focusBonus = player.propertiesInPlay.filter(p => p.propertyType === 'focus').length;
    player.maxWeaponsPerTurn = (player.character?.id === 'goemon' ? 2 : 1) + focusBonus;

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

  private handleBushidoCheck(player: PlayerPrivateState, bushidoIndex: number) {
    const revealedCard = this.drawOneCard();
    if (!revealedCard) {
      this.proceedToDrawPhase(player);
      return;
    }

    this.discardPile.push(revealedCard);
    this.addLog(`${player.name} scopre per il Bushido: ${revealedCard.name} (${revealedCard.type}).`, 'info');

    const bushidoCard = player.propertiesInPlay[bushidoIndex];

    if (revealedCard.type === 'weapon') {
      // Must discard a weapon or lose 1 honor point
      const weaponInHand = player.hand.find(c => c.type === 'weapon');
      if (weaponInHand) {
        // Discard the weapon, pass bushido to next player
        this.removeCardFromHand(player, weaponInHand.id);
        this.discardPile.push(weaponInHand);
        player.propertiesInPlay.splice(bushidoIndex, 1);
        this.passBushidoToLeft(player.id, bushidoCard);
        this.addLog(`${player.name} scarta un'arma (${weaponInHand.name}) per onorare il Bushido e lo passa a sinistra.`, 'action');
      } else {
        // Lose 1 honor point! Bushido is discarded
        player.propertiesInPlay.splice(bushidoIndex, 1);
        this.discardPile.push(bushidoCard);
        player.honorPoints -= 1;
        this.addLog(`${player.name} non ha armi da scartare e perde 1 Punto Onore per il Bushido!`, 'damage');
        if (this.checkGameOver()) return;
      }
    } else {
      // Not a weapon: passes to left without penalty
      player.propertiesInPlay.splice(bushidoIndex, 1);
      this.passBushidoToLeft(player.id, bushidoCard);
      this.addLog(`Il Bushido non è stato innescato e passa al giocatore a sinistra.`, 'info');
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
    }
  }

  private proceedToDrawPhase(player: PlayerPrivateState) {
    this.state.turnPhase = 'draw';

    // If character is Ieyasu and discard pile has cards, ask if want to draw from discard
    // If bot, decide automatically
    if (player.character?.id === 'ieyasu' && this.discardPile.length > 0) {
      if (player.isBot) {
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
      this.addLog(`${player.name} (Ieyasu) pesca ${top.name} dagli scarti!`, 'action');
    } else {
      const c1 = this.drawOneCard();
      if (c1) player.hand.push(c1);
    }

    // Second card always from deck
    const c2 = this.drawOneCard();
    if (c2) player.hand.push(c2);

    this.notifyStateChange();

    setTimeout(() => {
      if (this.state.status !== 'playing' || this.state.turnPlayerId !== player.id) return;
      this.finishDrawPhase(player);
    }, 1400);
  }

  private executeStandardDraw(player: PlayerPrivateState) {
    // Hideyoshi draws 3, others draw 2
    const drawCount = player.character?.id === 'hideyoshi' ? 3 : 2;
    for (let i = 0; i < drawCount; i++) {
      const c = this.drawOneCard();
      if (c) player.hand.push(c);
    }

    if (player.character?.id === 'hideyoshi') {
      this.addLog(`${player.name} (Hideyoshi) pesca 3 carte dal mazzo.`, 'info');
    } else {
      this.addLog(`${player.name} pesca 2 carte dal mazzo.`, 'info');
    }

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
    targetPropertyId?: string
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
      const target = this.playersPrivate.get(targetPlayerId);
      if (!target || target.isHarmless) return false;

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
          if (c) player.hand.push(c);
        }
        // Everyone else draws 1 card
        this.playersPrivate.forEach(p => {
          if (p.id !== playerId) {
            const c = this.drawOneCard();
            if (c) {
              p.hand.push(c);
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
          if (c) player.hand.push(c);
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
        this.triggerCardPlayed(card, player, `${player.name} usa Respirazione e recupera tutte le ferite!`, otherPlayer);
        this.addLog(`${player.name} usa Respirazione e recupera tutte le ferite (${healed} PV recuperati)!`, 'heal');

        // Other player draws 1 card
        const cardDrawn = this.drawOneCard();
        if (cardDrawn) {
          otherPlayer.hand.push(cardDrawn);
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

        // Steal random card from target's hand
        const randomIndex = Math.floor(Math.random() * target.hand.length);
        const stolenCard = target.hand.splice(randomIndex, 1)[0];
        player.hand.push(stolenCard);

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
            this.addLog(`${player.name} usa Geisha e fa scartare ${discardedProp.name} di ${target.name}!`, 'action');
          }
        } else if (target.hand.length > 0) {
          // Discard random card from hand
          const randomIndex = Math.floor(Math.random() * target.hand.length);
          const discardedHand = target.hand.splice(randomIndex, 1)[0];
          this.discardPile.push(discardedHand);
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
          if (!p || p.isHarmless || p.currentHp <= 0) return false;
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
          if (!p || p.isHarmless || p.currentHp <= 0) return false;
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

    if (reaction.type === 'battle_cry') {
      if (responseCardId) {
        const card = player.hand.find(c => c.id === responseCardId);
        // Per Grido di Battaglia la regola ufficiale richiede esclusivamente lo scarto di una carta Parata
        const isParry = card?.actionType === 'parry';

        if (isParry) {
          this.removeCardFromHand(player, responseCardId);
          this.discardPile.push(card!);
          this.triggerCardPlayed(card!, player, `${player.name} scarta ${card!.name} contro il Grido di Battaglia!`, sourcePlayer);
          this.addLog(`${player.name} scarta una Parata per evitare il danno del Grido di Battaglia.`, 'action');
        } else {
          return false; // Carta non valida: non si possono scartare armi contro il Grido di Battaglia!
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
    this.addLog(`${target.name} subisce ${wounds} ferite! (Resistenza rimasta: ${target.currentHp}/${target.maxHp})`, 'damage');

    // Attacker character triggers:
    // Tomoe: if wounds dealt with weapon, draws 1 card
    if (isWeaponDamage && wounds > 0 && attacker.character?.id === 'tomoe') {
      const bonusCard = this.drawOneCard();
      if (bonusCard) {
        attacker.hand.push(bonusCard);
        this.addLog(`${attacker.name} (Tomoe) pesca 1 carta per aver ferito un avversario!`, 'info');
      }
    }

    // Target character triggers:
    // Ushiwaka: draws 1 card per wound taken from weapon
    if (isWeaponDamage && target.character?.id === 'ushiwaka') {
      for (let i = 0; i < wounds; i++) {
        const c = this.drawOneCard();
        if (c) target.hand.push(c);
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

    // Transfer 1 Honor point
    target.honorPoints = Math.max(0, target.honorPoints - 1);
    attacker.honorPoints += 1;
    this.addLog(`${attacker.name} conquista 1 Punto Onore da ${target.name}!`, 'defeat');

    // Check Game Over: if any player has 0 honor points left
    if (this.checkGameOver()) {
      return;
    }

    // Target becomes defeated/harmless until their next turn
    target.isDefeatedThisRound = true;
    target.isHarmless = true;

    // REGOLA UFFICIALE SAMURAI SWORD: Il giocatore abbattuto NON scarta la mano né le proprietà!
    // Rimane semplicemente Inoffensivo fino al suo prossimo turno, quando recupererà tutta la Resistenza al massimo.
    this.addLog(`${target.name} è Inoffensivo fino al suo prossimo turno (recupererà tutti i punti ferita e mantiene le sue carte).`, 'info');
  }

  public useNobunagaAbility(playerId: string): boolean {
    if (this.state.status !== 'playing' || this.state.turnPlayerId !== playerId) return false;
    if (this.state.turnPhase !== 'play') return false;

    const player = this.playersPrivate.get(playerId);
    if (!player || player.character?.id !== 'nobunaga') return false;
    if (player.currentHp <= 1) return false; // cannot sacrifice last HP

    player.currentHp -= 1;
    const card = this.drawOneCard();
    if (card) player.hand.push(card);

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

  private triggerGameOver() {
    this.state.status = 'game_over';
    this.addLog('🏆 La riserva dei Punti Onore si è esaurita! La partita è terminata!', 'end');

    // Reveal all roles
    this.playersPrivate.forEach(p => {
      p.role = { ...p.role, isRevealed: true };
    });

    const scores = calculateFinalScores(Array.from(this.playersPrivate.values()));
    this.state.winnerTeam = scores.winnerTeam;
    this.state.finalScores = scores;

    const teamNames = {
      shogun: 'Squadra Shōgun & Samurai',
      ninja: 'Squadra Ninja',
      ronin: 'Il Ronin',
      draw: 'Pareggio'
    };

    this.addLog(`Vittoria per: ${teamNames[scores.winnerTeam]}!`, 'end');
    this.notifyStateChange();
  }

  // --- BOT EXECUTION ---

  private checkBotAction() {
    if (this.state.status !== 'playing' || this.state.turnPhase === 'dealing') return;

    // Check reaction pending
    if (this.state.pendingReaction) {
      const targetId = this.state.pendingReaction.pendingForPlayerId;
      const target = this.playersPrivate.get(targetId);
      if (target?.isBot) {
        // Give 2.4s so everyone sees the attack card before bot reacts
        setTimeout(() => {
          if (this.state.status !== 'playing' || !this.state.pendingReaction) return;
          BotAI.respondToReaction(this, targetId);
        }, 2400);
      }
      return;
    }

    // Check turn player
    const curr = this.playersPrivate.get(this.state.turnPlayerId);
    if (!curr || !curr.isBot) return;

    if (this.state.turnPhase === 'play') {
      // Human-like pause while bot assesses the situation and plays: 2.2s
      setTimeout(() => {
        if (this.state.status !== 'playing' || this.state.turnPlayerId !== curr.id || this.state.turnPhase !== 'play') return;
        BotAI.playTurn(this, curr.id);
      }, 2200);
    } else if (this.state.turnPhase === 'discard') {
      // Pause before bot discards excess: 1.6s
      setTimeout(() => {
        if (this.state.status !== 'playing' || this.state.turnPlayerId !== curr.id || this.state.turnPhase !== 'discard') return;
        BotAI.discardDown(this, curr.id);
      }, 1600);
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
    this.state.players = Array.from(this.playersPrivate.values()).map(p => ({
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
      isHarmless: p.hand.length === 0,
      isDefeatedThisRound: p.isDefeatedThisRound,
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
    return {
      ...this.state,
      myPrivateState: privateState
    };
  }
}
