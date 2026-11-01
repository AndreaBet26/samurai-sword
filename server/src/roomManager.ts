import { Server, Socket } from 'socket.io';
import { GameEngine } from './gameEngine';

export class RoomManager {
  private io: Server;
  private rooms: Map<string, GameEngine> = new Map();
  private socketToPlayer: Map<string, { roomCode: string; playerId: string }> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  public handleConnection(socket: Socket) {
    // 1. Create room
    socket.on('create_room', (data: { playerName: string }) => {
      const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      const playerId = socket.id;

      const engine = new GameEngine(roomCode, () => {
        this.broadcastRoomState(roomCode);
      });

      engine.addPlayer(playerId, data.playerName.trim() || 'Giocatore 1', true, false);
      this.rooms.set(roomCode, engine);
      this.socketToPlayer.set(socket.id, { roomCode, playerId });

      socket.join(roomCode);
      socket.emit('room_joined', { roomCode, playerId, isHost: true });
      this.broadcastRoomState(roomCode);
    });

    // 2. Join room
    socket.on('join_room', (data: { roomCode: string; playerName: string }) => {
      const code = data.roomCode.trim().toUpperCase();
      const engine = this.rooms.get(code);

      if (!engine) {
        socket.emit('error_message', { message: 'Stanza non trovata.' });
        return;
      }

      if (engine.state.status !== 'lobby') {
        socket.emit('error_message', { message: 'La partita è già in corso.' });
        return;
      }

      const playerId = socket.id;
      const success = engine.addPlayer(playerId, data.playerName.trim() || `Giocatore ${engine.state.players.length + 1}`, false, false);

      if (!success) {
        socket.emit('error_message', { message: 'Impossibile entrare: stanza piena o nome non valido.' });
        return;
      }

      this.socketToPlayer.set(socket.id, { roomCode: code, playerId });
      socket.join(code);
      socket.emit('room_joined', { roomCode: code, playerId, isHost: false });
      this.broadcastRoomState(code);
    });

    // 3. Add Bot
    socket.on('add_bot', () => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      const host = engine.getPlayerPrivate(mapping.playerId);
      if (!host || !host.isHost) return;

      const botNames = ['Kenshin (Bot)', 'Raiden (Bot)', 'Yotsuyu (Bot)', 'Seijuro (Bot)', 'Tadakatsu (Bot)', 'Hattori (Bot)'];
      const currentBots = engine.state.players.filter(p => p.isBot).length;
      const botName = botNames[currentBots % botNames.length];
      const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

      engine.addPlayer(botId, botName, false, true);
    });

    // 4. Start Game
    socket.on('start_game', () => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      const host = engine.getPlayerPrivate(mapping.playerId);
      if (!host || !host.isHost) return;

      const success = engine.startGame();
      if (!success) {
        socket.emit('error_message', { message: 'Servono da 3 a 7 giocatori per iniziare la partita!' });
      }
    });

    // 4b. Initial Deal Complete (received from client when cards finish distributing)
    socket.on('initial_deal_complete', () => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      engine.completeInitialDeal();
    });

    // 5. Game Actions
    socket.on('attack_with_weapon', (data: { weaponCardId: string; targetId: string }) => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      engine.attackWithWeapon(mapping.playerId, data.weaponCardId, data.targetId);
    });

    socket.on('play_property', (data: { cardId: string }) => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      engine.playProperty(mapping.playerId, data.cardId);
    });

    socket.on('play_action', (data: { cardId: string; targetPlayerId?: string; targetPropertyId?: string }) => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      engine.playAction(mapping.playerId, data.cardId, data.targetPlayerId, data.targetPropertyId);
    });

    socket.on('submit_reaction', (data: { responseCardId: string | null }) => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      engine.submitReaction(mapping.playerId, data.responseCardId);
    });

    socket.on('draw_ieyasu', (data: { fromDiscard: boolean }) => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      engine.drawForIeyasu(mapping.playerId, data.fromDiscard);
    });

    socket.on('use_nobunaga', () => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      engine.useNobunagaAbility(mapping.playerId);
    });

    socket.on('end_play_phase', () => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      engine.endPlayPhase(mapping.playerId);
    });

    socket.on('discard_excess', (data: { cardIds: string[] }) => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (!mapping) return;
      const engine = this.rooms.get(mapping.roomCode);
      if (!engine) return;

      engine.discardExcessCards(mapping.playerId, data.cardIds);
    });

    // Disconnect
    socket.on('disconnect', () => {
      const mapping = this.socketToPlayer.get(socket.id);
      if (mapping) {
        const engine = this.rooms.get(mapping.roomCode);
        if (engine) {
          engine.removePlayer(mapping.playerId);
          if (engine.state.players.length === 0) {
            this.rooms.delete(mapping.roomCode);
          }
        }
        this.socketToPlayer.delete(socket.id);
      }
    });
  }

  private broadcastRoomState(roomCode: string) {
    const engine = this.rooms.get(roomCode);
    if (!engine) return;

    // Send private custom state to each connected player in room
    const sockets = this.io.sockets.adapter.rooms.get(roomCode);
    if (sockets) {
      for (const socketId of sockets) {
        const mapping = this.socketToPlayer.get(socketId);
        if (mapping) {
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
