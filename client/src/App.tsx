import React, { useEffect, useRef, useState } from 'react';
import { socket, saveSession, clearSession, resumeSavedSession } from './socket';
import { GameState, PlayerPrivateState } from '../../shared/types';
import { LobbyView } from './components/LobbyView';
import { VirtualTable } from './components/VirtualTable';
import { RulesModal } from './components/RulesModal';
import { OpeningCutscene } from './components/OpeningCutscene';

export const App: React.FC = () => {
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
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
    logs: [],
    events: []
  });
  const [myPrivateState, setMyPrivateState] = useState<PlayerPrivateState | undefined>(undefined);
  const [isOffline, setIsOffline] = useState(false);
  // Messaggio breve mostrato nella lobby (es. "L'host ti ha tolto dalla stanza")
  const [notice, setNotice] = useState<string | null>(null);

  // Telefono tenuto in verticale: il tavolo si gioca solo in orizzontale
  const [isPortraitPhone, setIsPortraitPhone] = useState(false);
  useEffect(() => {
    const check = () => {
      const touch = window.matchMedia('(pointer: coarse)').matches;
      const portrait = window.innerHeight > window.innerWidth;
      const small = Math.min(window.innerWidth, window.innerHeight) < 820;
      setIsPortraitPhone(touch && portrait && small);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  const justResumedRef = useRef(false);

  useEffect(() => {
    socket.on('room_joined', (data: { roomCode: string; playerId: string; isHost: boolean; token: string; resumed?: boolean }) => {
      setCurrentRoomCode(data.roomCode);
      setIsHost(data.isHost);
      if (data.token) saveSession({ token: data.token, roomCode: data.roomCode });
      setNotice(null);
      // Il link d'invito ha fatto il suo lavoro: lo togliamo dalla barra dell'indirizzo
      if (window.location.search.includes('stanza=')) window.history.replaceState(null, '', window.location.pathname);
      // Rientro: al primo aggiornamento di stato decidiamo se saltare la cutscene iniziale
      if (data.resumed) justResumedRef.current = true;
    });

    // La sessione salvata non è più valida (stanza chiusa o server riavviato)
    socket.on('session_expired', () => {
      clearSession();
      setCurrentRoomCode(null);
      setNotice('La sessione precedente è terminata o la stanza è stata chiusa.');
    });

    // Ad ogni (ri)connessione prova a rientrare nella stanza in cui si stava giocando
    const onConnect = () => {
      setIsOffline(false);
      resumeSavedSession();
    };
    const onDisconnect = () => setIsOffline(true);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) resumeSavedSession();

    socket.on('game_state_update', (data: GameState & { myPrivateState?: PlayerPrivateState }) => {
      setGameState(data);
      if (justResumedRef.current) {
        justResumedRef.current = false;
        // Partita già avviata: la cutscene di assegnazione ruoli è già stata vista
        setHasSeenIntro(data.status !== 'lobby' && data.turnPhase !== 'dealing');
      }
      if (data.myPrivateState) {
        setMyPrivateState(data.myPrivateState);
      }
    });

    // L'host ti ha tolto dalla stanza
    socket.on('kicked', (data: { message: string }) => {
      clearSession();
      setCurrentRoomCode(null);
      setNotice(data.message);
    });

    socket.on('error_message', (data: { message: string }) => {
      alert(data.message);
    });

    return () => {
      socket.off('room_joined');
      socket.off('session_expired');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('game_state_update');
      socket.off('error_message');
      socket.off('kicked');
    };
  }, []);

  // When returning to lobby, reset intro state
  useEffect(() => {
    if (gameState.status === 'lobby') {
      setHasSeenIntro(false);
    }
  }, [gameState.status]);

  const handleReturnToLobby = () => {
    // Esce davvero dalla stanza (così il refresh non ci riporta dentro), poi ricarica
    clearSession();
    let done = false;
    const reload = () => {
      if (done) return;
      done = true;
      window.location.reload();
    };
    socket.emit('leave_room', {}, reload);
    setTimeout(reload, 800);
  };

  const isGameActive = gameState.status === 'playing' || gameState.status === 'game_over';
  const showIntro = gameState.status === 'playing' && !hasSeenIntro && myPrivateState?.character && myPrivateState?.role;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {!isGameActive ? (
        <LobbyView
          currentRoomCode={currentRoomCode}
          players={gameState.players}
          isHost={myPrivateState?.isHost ?? isHost}
          myId={myPrivateState?.id ?? ''}
          settings={gameState.settings}
          notice={notice}
          onOpenRules={() => setShowRules(true)}
        />
      ) : showIntro && myPrivateState?.character && myPrivateState?.role ? (
        <OpeningCutscene
          character={myPrivateState.character}
          role={myPrivateState.role}
          players={gameState.players}
          myPlayerId={myPrivateState.id}
          onComplete={() => setHasSeenIntro(true)}
        />
      ) : (
        <VirtualTable
          gameState={gameState}
          myPrivateState={myPrivateState}
          onReturnToLobby={handleReturnToLobby}
        />
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {isGameActive && isPortraitPhone && (
        <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col items-center justify-center text-center px-8">
          <div className="text-6xl mb-6 animate-pulse" style={{ display: 'inline-block', transform: 'rotate(90deg)' }}>
            📱
          </div>
          <div className="font-title text-2xl font-black text-amber-300 mb-2">Ruota il telefono</div>
          <div className="text-slate-300 text-sm">Samurai Sword si gioca in orizzontale.</div>
        </div>
      )}

      {isOffline && currentRoomCode && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] bg-red-950/95 border border-red-600 text-red-200 text-sm font-semibold px-4 py-2 rounded-lg shadow-xl">
          Connessione persa: sto provando a riconnettermi...
        </div>
      )}
    </div>
  );
};
