import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from './gameEngine';

/** Quanto aspettare un giocatore disconnesso in LOBBY prima di toglierlo dalla stanza (3 minuti). */
const LOBBY_GRACE_MS = 180_000;
/** Quanto aspettare un giocatore disconnesso IN PARTITA prima che un bot prenda temporaneamente il suo posto (60 secondi). */
const AWAY_GRACE_MS = 60_000;
/** Dopo quanto tempo senza nessun umano collegato la stanza viene chiusa (15 minuti). */
const EMPTY_ROOM_TTL_MS = 15 * 60_000;

interface Session {
  roomCode: string;
  playerId: string;
}

/** Legge una stringa dal payload del client in modo sicuro (evita crash del server con dati malformati). */
function str(value: unknown, maxLen: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

/** Nome giocatore: niente caratteri che potrebbero essere interpretati come HTML */
function playerName(value: unknown): string {
  return str(value, 20).replace(/[<>&"'`]/g, '').trim();
}

export class RoomManager {
  private io: Server;
  private rooms: Map<string, GameEngine> = new Map();
  /** socket.id -> giocatore collegato con quel socket */
  private socketToPlayer: Map<string, Session> = new Map();
  /** token segreto di sessione (salvato nel browser) -> giocatore. Permette di rientrare dopo un refresh o un calo di rete. */
  private sessions: Map<string, Session> = new Map();
  /** playerId -> timer di attesa dopo una disconnessione */
  private graceTimers: Map<string, NodeJS.Timeout> = new Map();
  /** roomCode -> timer di chiusura stanza vuota */
  private roomTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  public handleConnection(socket: Socket) {
    // Wrapper: un errore in un handler non deve mai far crollare l'intero server
    const on = (event: string, handler: (data: any, ack?: (...args: any[]) => void) => void) => {
      socket.on(event, (data: any, ack?: any) => {
        try {
          handler(data ?? {}, typeof ack === 'function' ? ack : undefined);
        } catch (err) {
          console.error(`[RoomManager] errore nell'evento "${event}":`, err);
        }
      });
    };

    /** Restituisce stanza e giocatore associati a questo socket. */
    const ctx = () => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return null;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return null;
      return { engine, playerId: mapping.playerId, roomCode: mapping.roomCode };
    };

    // 1. Create room
    on('create_room', (data) => {
      this.leaveCurrent(socket);
      let roomCode = '';
      do {
        roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      } while (roomCode.length < 5 || this.rooms.has(roomCode));

      const playerId = `p_${uuidv4()}`;
      const engine = new GameEngine(roomCode, () => {
        this.broadcastRoomState(roomCode);
      });
      engine.manualDraw = true;
      this.rooms.set(roomCode, engine);

      engine.addPlayer(playerId, playerName(data.playerName) || 'Giocatore 1', true, false);
      this.bindSocket(socket, roomCode, playerId, true, false);
    });

    // 2. Join room
    on('join_room', (data) => {
      const code = str(data.roomCode, 10).toUpperCase();
      const engine = this.rooms.get(code);

      if (!engine) {
        socket.emit('error_message', { message: 'Stanza non trovata.' });
        return;
      }

      const inputName = playerName(data.playerName);

      // CASO A: Partita già in corso
      if (engine.state.status !== 'lobby') {
        // Cerca se esiste un giocatore umano con questo nome che era disconnesso o away e può rientrare
        const matchingPlayer = engine.state.players.find(
          p => !p.isBot && p.name.toLowerCase() === inputName.toLowerCase() && (!p.isConnected || p.isAway)
        );

        if (matchingPlayer) {
          this.leaveCurrent(socket);
          this.bindSocket(socket, code, matchingPlayer.id, matchingPlayer.isHost, true);
          engine.setPlayerConnected(matchingPlayer.id, true);
          return;
        }

        socket.emit('error_message', { message: 'La partita è già in corso e non ci sono posti liberi per questo giocatore.' });
        return;
      }

      // CASO B: Stanza in Lobby
      // Se un giocatore con lo stesso nome si era appena disconnesso (es. calo Wi-Fi/ricarica pagina):
      const existingInLobby = engine.state.players.find(
        p => !p.isBot && p.name.toLowerCase() === inputName.toLowerCase() && !p.isConnected
      );

      if (existingInLobby) {
        this.leaveCurrent(socket);
        this.bindSocket(socket, code, existingInLobby.id, existingInLobby.isHost, true);
        engine.setPlayerConnected(existingInLobby.id, true);
        return;
      }

      this.leaveCurrent(socket);
      const playerId = `p_${uuidv4()}`;
      const name = inputName || `Giocatore ${engine.state.players.length + 1}`;
      const success = engine.addPlayer(playerId, name, false, false);

      if (!success) {
        socket.emit('error_message', { message: 'Impossibile entrare: stanza piena o nome non valido.' });
        return;
      }

      this.bindSocket(socket, code, playerId, false, false);
    });

    // 2b. Rientro in una stanza dopo refresh / calo di rete / telefono in standby
    on('resume_session', (data) => {
      const token = str(data.token, 100);
      const session = token ? this.sessions.get(token) : undefined;
      const engine = session ? this.rooms.get(session.roomCode) : undefined;
      const player = session && engine ? engine.getPlayerPrivate(session.playerId) : undefined;

      if (!session || !engine || !player) {
        if (token) this.sessions.delete(token);
        socket.emit('session_expired');
        return;
      }

      // Se lo stesso giocatore era già collegato da un'altra scheda, quella viene scollegata
      for (const [sid, m] of this.socketToPlayer) {
        if (sid !== socket.id && m.playerId === session.playerId) {
          this.socketToPlayer.delete(sid);
          this.io.sockets.sockets.get(sid)?.leave(session.roomCode);
        }
      }

      this.bindSocket(socket, session.roomCode, session.playerId, player.isHost, true, token);
      engine.setPlayerConnected(session.playerId, true);
    });

    // 2c. Uscita volontaria dalla stanza (pulsante "torna alla lobby")
    on('leave_room', (_data, ack) => {
      const c = ctx();
      if (c) {
        this.forgetSessionsOf(c.playerId);
        this.socketToPlayer.delete(socket.id);
        socket.leave(c.roomCode);
        this.clearGrace(c.playerId);
        if (c.engine.state.status === 'lobby') {
          c.engine.removePlayer(c.playerId);
        } else if (c.engine.state.status === 'playing') {
          c.engine.setPlayerConnected(c.playerId, false);
          c.engine.setPlayerAway(c.playerId);
        }
        this.checkRoomOccupancy(c.roomCode);
      }
      ack?.();
    });

    // 3. Add Bot
    on('add_bot', () => {
      const c = ctx();
      if (!c) return;
      const host = c.engine.getPlayerPrivate(c.playerId);
      if (!host || !host.isHost) return;

      const botNames = ['Kenshin (Bot)', 'Raiden (Bot)', 'Yotsuyu (Bot)', 'Seijuro (Bot)', 'Tadakatsu (Bot)', 'Hattori (Bot)'];
      const currentBots = c.engine.state.players.filter(p => p.isBot).length;
      const botName = botNames[currentBots % botNames.length];
      const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

      c.engine.addPlayer(botId, botName, false, true);
    });

    // 3b. L'host toglie un giocatore (o un bot) dalla lobby
    on('remove_player', data => {
      const c = ctx();
      if (!c || c.engine.state.status !== 'lobby') return;
      const host = c.engine.getPlayerPrivate(c.playerId);
      const targetId = str(data.playerId, 100);
      if (!host?.isHost || !targetId || targetId === c.playerId) return;
      if (!c.engine.getPlayerPrivate(targetId)) return;

      // Avvisa il giocatore tolto e scollega il suo socket dalla stanza
      for (const [sid, m] of this.socketToPlayer) {
        if (m.playerId === targetId) {
          const s2 = this.io.sockets.sockets.get(sid);
          s2?.emit('kicked', { message: "L'host ti ha tolto dalla stanza." });
          s2?.leave(c.roomCode);
          this.socketToPlayer.delete(sid);
        }
      }
      this.forgetSessionsOf(targetId);
      this.clearGrace(targetId);
      c.engine.removePlayer(targetId);
    });

    // 3c. Impostazioni della stanza (solo host, solo in lobby)
    on('update_settings', data => {
      const c = ctx();
      if (!c) return;
      const host = c.engine.getPlayerPrivate(c.playerId);
      if (!host?.isHost) return;
      c.engine.updateSettings({ turnTimer: data.turnTimer, animSpeed: data.animSpeed });
    });

    // 3d. Rivincita: l'host riporta tutti nella stessa stanza
    on('rematch', () => {
      const c = ctx();
      if (!c) return;
      const host = c.engine.getPlayerPrivate(c.playerId);
      if (!host?.isHost) return;
      c.engine.resetToLobby();
    });

    // 4. Start Game
    on('start_game', () => {
      const c = ctx();
      if (!c) return;
      const host = c.engine.getPlayerPrivate(c.playerId);
      if (!host || !host.isHost) return;

      const success = c.engine.startGame();
      if (!success) {
        socket.emit('error_message', { message: 'Servono da 3 a 7 giocatori per iniziare la partita!' });
      }
    });

    // 4b. Initial Deal Complete (received from client when cards finish distributing)
    on('initial_deal_complete', () => {
      ctx()?.engine.completeInitialDeal();
    });

    // 5. Game Actions
    on('attack_with_weapon', (data) => {
      const c = ctx();
      if (!c) return;
      c.engine.attackWithWeapon(c.playerId, str(data.weaponCardId, 100), str(data.targetId, 100));
    });

    on('play_property', (data) => {
      const c = ctx();
      if (!c) return;
      c.engine.playProperty(c.playerId, str(data.cardId, 100));
    });

    on('play_action', (data) => {
      const c = ctx();
      if (!c) return;
      c.engine.playAction(
        c.playerId,
        str(data.cardId, 100),
        str(data.targetPlayerId, 100) || undefined,
        str(data.targetPropertyId, 100) || undefined,
        typeof data.targetHandIndex === 'number' ? data.targetHandIndex : undefined
      );
    });

    on('submit_reaction', (data) => {
      const c = ctx();
      if (!c) return;
      c.engine.submitReaction(c.playerId, str(data.responseCardId, 100) || null);
    });

    on('draw_cards', () => {
      const c = ctx();
      if (!c) return;
      c.engine.drawCardsFromDeck(c.playerId);
    });

    on('draw_ieyasu', (data) => {
      const c = ctx();
      if (!c) return;
      c.engine.drawForIeyasu(c.playerId, data.fromDiscard === true);
    });

    on('use_nobunaga', () => {
      const c = ctx();
      if (!c) return;
      c.engine.useNobunagaAbility(c.playerId);
    });

    on('end_play_phase', () => {
      const c = ctx();
      if (!c) return;
      c.engine.endPlayPhase(c.playerId);
    });

    on('discard_excess', (data) => {
      const c = ctx();
      if (!c) return;
      const ids = Array.isArray(data.cardIds) ? data.cardIds.map((x: unknown) => str(x, 100)).filter(Boolean) : [];
      c.engine.discardExcessCards(c.playerId, ids);
    });

    // Disconnect: non si toglie subito il giocatore, gli si dà tempo di rientrare
    socket.on('disconnect', () => {
      try {
        const mapping = this.socketToPlayer.get(socket.id);
        if (!mapping) return;
        this.socketToPlayer.delete(socket.id);

        const engine = this.rooms.get(mapping.roomCode);
        if (!engine) return;

        // Ancora collegato da un'altra scheda? Allora non è davvero disconnesso
        if (this.isPlayerOnline(mapping.playerId)) return;

        const { roomCode, playerId } = mapping;
        engine.setPlayerConnected(playerId, false);
        this.clearGrace(playerId);

        if (engine.state.status === 'lobby') {
          this.graceTimers.set(
            playerId,
            setTimeout(() => {
              this.graceTimers.delete(playerId);
              if (this.isPlayerOnline(playerId)) return;
              this.forgetSessionsOf(playerId);
              engine.removePlayer(playerId);
              this.checkRoomOccupancy(roomCode);
            }, LOBBY_GRACE_MS)
          );
        } else if (engine.state.status === 'playing') {
          this.graceTimers.set(
            playerId,
            setTimeout(() => {
              this.graceTimers.delete(playerId);
              if (this.isPlayerOnline(playerId)) return;
              engine.setPlayerAway(playerId);
            }, AWAY_GRACE_MS)
          );
        }

        this.checkRoomOccupancy(roomCode);
      } catch (err) {
        console.error('[RoomManager] errore in disconnect:', err);
      }
    });
  }

  /** Collega un socket a un giocatore e gli comunica il token per poter rientrare in futuro. */
  private bindSocket(
    socket: Socket,
    roomCode: string,
    playerId: string,
    isHost: boolean,
    resumed: boolean,
    existingToken?: string
  ) {
    const token = existingToken ?? uuidv4();
    this.sessions.set(token, { roomCode, playerId });
    this.socketToPlayer.set(socket.id, { roomCode, playerId });
    this.clearGrace(playerId);
    this.cancelRoomClose(roomCode);

    socket.join(roomCode);
    socket.emit('room_joined', { roomCode, playerId, isHost, token, resumed });
    this.broadcastRoomState(roomCode);
  }

  /** Se il socket era già in un'altra stanza (es. crea una nuova stanza senza ricaricare), lo scollega. */
  private leaveCurrent(socket: Socket) {
    const mapping = this.socketToPlayer.get(socket.id);
    if (!mapping) return;
    this.socketToPlayer.delete(socket.id);
    socket.leave(mapping.roomCode);
    const engine = this.rooms.get(mapping.roomCode);
    if (engine?.state.status === 'lobby') {
      this.forgetSessionsOf(mapping.playerId);
      engine.removePlayer(mapping.playerId);
    } else if (engine?.state.status === 'playing') {
      engine.setPlayerConnected(mapping.playerId, false);
      engine.setPlayerAway(mapping.playerId);
    }
    this.checkRoomOccupancy(mapping.roomCode);
  }

  private isPlayerOnline(playerId: string): boolean {
    for (const m of this.socketToPlayer.values()) {
      if (m.playerId === playerId) return true;
    }
    return false;
  }

  private clearGrace(playerId: string) {
    const t = this.graceTimers.get(playerId);
    if (t) clearTimeout(t);
    this.graceTimers.delete(playerId);
  }

  private forgetSessionsOf(playerId: string) {
    for (const [token, s] of this.sessions) {
      if (s.playerId === playerId) this.sessions.delete(token);
    }
  }

  /** Se nella stanza non c'è più nessun umano collegato, programma la chiusura (o chiude subito se è vuota). */
  private checkRoomOccupancy(roomCode: string) {
    const engine = this.rooms.get(roomCode);
    if (!engine) return;

    if (engine.state.players.length === 0) {
      this.closeRoom(roomCode);
      return;
    }

    const anyHumanOnline = [...this.socketToPlayer.values()].some(m => m.roomCode === roomCode);
    if (anyHumanOnline || this.roomTimers.has(roomCode)) return;

    this.roomTimers.set(
      roomCode,
      setTimeout(() => {
        this.roomTimers.delete(roomCode);
        const stillEmpty = ![...this.socketToPlayer.values()].some(m => m.roomCode === roomCode);
        if (stillEmpty) this.closeRoom(roomCode);
      }, EMPTY_ROOM_TTL_MS)
    );
  }

  private cancelRoomClose(roomCode: string) {
    const t = this.roomTimers.get(roomCode);
    if (t) clearTimeout(t);
    this.roomTimers.delete(roomCode);
  }

  /** Chiude la stanza, ferma i bot e libera la memoria. */
  private closeRoom(roomCode: string) {
    const engine = this.rooms.get(roomCode);
    if (!engine) return;
    engine.dispose();
    this.rooms.delete(roomCode);
    this.cancelRoomClose(roomCode);
    for (const [token, s] of this.sessions) {
      if (s.roomCode === roomCode) {
        this.sessions.delete(token);
        this.clearGrace(s.playerId);
      }
    }
    console.log(`[RoomManager] stanza ${roomCode} chiusa (nessun giocatore collegato).`);
  }

  private broadcastRoomState(roomCode: string) {
    const engine = this.rooms.get(roomCode);
    if (!engine) return;

    // Send private custom state to each connected player in room
    const sockets = this.io.sockets.adapter.rooms.get(roomCode);
    if (sockets) {
      for (const socketId of sockets) {
        const mapping = this.socketToPlayer.get(socketId);
        if (mapping && mapping.roomCode === roomCode) {
          const clientSocket = this.io.sockets.sockets.get(socketId);
          if (clientSocket) {
            const playerState = engine.getStateForPlayer(mapping.playerId);
            clientSocket.emit('game_state_update', playerState);
          }
        }
      }
    }
  }
}
