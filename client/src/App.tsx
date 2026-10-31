import React, { useEffect, useState } from 'react';
import { socket } from './socket';
import { GameState, PlayerPrivateState } from '../../shared/types';
import { LobbyView } from './components/LobbyView';
import { VirtualTable } from './components/VirtualTable';
import { RulesModal } from './components/RulesModal';

export const App: React.FC = () => {
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [gameState, setGameState] = useState<GameState>({
    roomCode: '',
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
  });
  const [myPrivateState, setMyPrivateState] = useState<PlayerPrivateState | undefined>(undefined);

  useEffect(() => {
    socket.on('room_joined', (data: { roomCode: string; playerId: string; isHost: boolean }) => {
      setCurrentRoomCode(data.roomCode);
      setIsHost(data.isHost);
    });

    socket.on('game_state_update', (data: GameState & { myPrivateState?: PlayerPrivateState }) => {
      setGameState(data);
      if (data.myPrivateState) {
        setMyPrivateState(data.myPrivateState);
      }
    });

    socket.on('error_message', (data: { message: string }) => {
      alert(data.message);
    });

    return () => {
      socket.off('room_joined');
      socket.off('game_state_update');
      socket.off('error_message');
    };
  }, []);

  const handleReturnToLobby = () => {
    window.location.reload();
  };

  const isGameActive = gameState.status === 'playing' || gameState.status === 'game_over';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {!isGameActive ? (
        <LobbyView
          currentRoomCode={currentRoomCode}
          players={gameState.players}
          isHost={isHost}
          onOpenRules={() => setShowRules(true)}
        />
      ) : (
        <VirtualTable
          gameState={gameState}
          myPrivateState={myPrivateState}
          onReturnToLobby={handleReturnToLobby}
        />
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
};
