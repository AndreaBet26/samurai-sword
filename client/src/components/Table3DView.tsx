import React, { useEffect, useRef, useState } from 'react';
import { CardDef, GameState, PlayerPrivateState } from '../../../shared/types';
import { Table3DScene } from '../three/Table3DScene';
import { PlayerSeat } from './PlayerSeat';
import { ActionLog } from './ActionLog';
import { TargetSelectionModal } from './TargetSelectionModal';
import { ReactionModal } from './ReactionModal';
import { DiscardModal } from './DiscardModal';
import { GameOverModal } from './GameOverModal';
import { RulesModal } from './RulesModal';
import { soundManager } from '../utils/soundEffects';
import { calculateDistance, calculateTargetDifficulty } from '../../../shared/rules';
import { socket } from '../socket';
import {
  Sword,
  BookOpen,
  Volume2,
  VolumeX,
  ArrowRight,
  Sparkles,
  Crown,
  Heart
} from 'lucide-react';

interface Table3DViewProps {
  gameState: GameState;
  myPrivateState?: PlayerPrivateState;
  onReturnToLobby: () => void;
}

export const Table3DView: React.FC<Table3DViewProps> = ({
  gameState,
  myPrivateState,
  onReturnToLobby
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Table3DScene | null>(null);

  const [hasStartedShuffle, setHasStartedShuffle] = useState(false);
  const [shuffleStatus, setShuffleStatus] = useState<string | null>(null);
  const [selectedCardForTarget, setSelectedCardForTarget] = useState<CardDef | null>(null);
  const [selectedCardInspect, setSelectedCardInspect] = useState<CardDef | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);

  const myId = myPrivateState?.id || '';
  const myPlayer = gameState.players.find(p => p.id === myId);
  const isMyTurn = gameState.turnPlayerId === myId;
  const isPlayPhase = isMyTurn && gameState.turnPhase === 'play';
  const isDiscardPhase = isMyTurn && gameState.turnPhase === 'discard';
  const turnPlayer = gameState.players.find(p => p.id === gameState.turnPlayerId);

  // Initialize 3D Scene immediately
  useEffect(() => {
    if (!mountRef.current) return;

    // Destroy any existing scene
    if (sceneRef.current) {
      sceneRef.current.destroy();
    }

    const scene = new Table3DScene(mountRef.current, {
      onCardClick: (card) => {
        setSelectedCardInspect(card);
      }
    });
    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  // Trigger opening 3D shuffle & deal as soon as scene and player state are ready!
  useEffect(() => {
    if (sceneRef.current && myPrivateState && !hasStartedShuffle) {
      setHasStartedShuffle(true);

      const runSequence = async () => {
        setShuffleStatus('Mescolamento del Mazzo in 3D...');
        soundManager.playGong();

        // 1. Riffle Shuffle in 3D
        await sceneRef.current!.deck3D.riffleShuffle();

        // 2. Deal around the 3D table
        setShuffleStatus('Distribuzione delle carte ai guerrieri...');
        const opponentCount = gameState.players.length - 1;
        for (let round = 0; round < 3; round++) {
          for (let pIdx = 0; pIdx < opponentCount; pIdx++) {
            const angle = -Math.PI / 2 + ((pIdx + 1) * (Math.PI * 2)) / gameState.players.length;
            const targetX = Math.cos(angle) * 6.5;
            const targetZ = Math.sin(angle) * 5.0;

            await sceneRef.current!.deck3D.dealCardTo(
              { x: targetX, y: 0.1, z: targetZ } as any,
              { x: -Math.PI / 2, y: 0, z: angle + Math.PI / 2 } as any
            );
          }
        }

        // 3. Deal the player's 3D hand
        setShuffleStatus('Preparazione della tua mano...');
        await sceneRef.current!.dealPlayerHand(myPrivateState.hand);

        setShuffleStatus(null);
      };

      runSequence();
    }
  }, [hasStartedShuffle, myPrivateState?.hand?.length]);

  // Sync hand updates if cards change after initial deal
  useEffect(() => {
    if (hasStartedShuffle && !shuffleStatus && sceneRef.current && myPrivateState?.hand) {
      sceneRef.current.dealPlayerHand(myPrivateState.hand);
    }
  }, [myPrivateState?.hand?.length]);

  // Sync discard pile top
  useEffect(() => {
    if (gameState.discardPileTop && sceneRef.current) {
      sceneRef.current.addCardToDiscard(gameState.discardPileTop);
    }
  }, [gameState.discardPileCount]);

  const handleConfirmTarget = (targetPlayerId: string, targetPropertyId?: string) => {
    if (!selectedCardForTarget) return;

    if (selectedCardForTarget.type === 'weapon') {
      soundManager.playSwordSlash();
      socket.emit('attack_with_weapon', {
        weaponCardId: selectedCardForTarget.id,
        targetId: targetPlayerId
      });
    } else {
      soundManager.playCardSlide();
      socket.emit('play_action', {
        cardId: selectedCardForTarget.id,
        targetPlayerId,
        targetPropertyId
      });
    }

    setSelectedCardForTarget(null);
    setSelectedCardInspect(null);
  };

  const handleEndPlayPhase = () => {
    soundManager.playCardSlide();
    socket.emit('end_play_phase');
  };

  const toggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  // Opponents ordered in clockwise circle starting after me
  const myIndex = gameState.turnOrder.indexOf(myId);
  const opponentsOrdered = [];
  if (myIndex !== -1) {
    for (let i = 1; i < gameState.turnOrder.length; i++) {
      const targetId = gameState.turnOrder[(myIndex + i) % gameState.turnOrder.length];
      const p = gameState.players.find(player => player.id === targetId);
      if (p) opponentsOrdered.push(p);
    }
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 3D WebGL Canvas (Always present and rendered!) */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Riffle Shuffle Banner Overlay */}
      {shuffleStatus && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-slate-900/95 border-2 border-amber-500 px-8 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-pulse">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="font-title font-black text-base text-amber-300 tracking-wider">
            {shuffleStatus}
          </span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="absolute top-0 inset-x-0 z-20 bg-slate-950/80 border-b border-slate-800/80 px-5 py-3 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sword className="w-5 h-5 text-red-500" />
            <span className="font-title font-black text-lg text-slate-100 tracking-wider hidden sm:inline">
              SAMURAI SWORD 3D
            </span>
          </div>
          <span className="bg-slate-900 text-amber-400 font-mono text-xs px-2.5 py-1 rounded-lg border border-slate-700">
            Stanza: {gameState.roomCode}
          </span>
        </div>

        {/* Turn Status Badge */}
        <div className="flex items-center gap-2">
          <div className="text-xs px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 font-bold flex items-center gap-2 shadow-inner">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>
              Turno di: <strong className="text-amber-300">{turnPlayer?.name || '...'}</strong>
            </span>
            <span className="text-slate-500 hidden md:inline">
              ({gameState.turnPhase === 'play' ? 'Fase di Gioco' : gameState.turnPhase === 'discard' ? 'Fase di Scarto' : 'Fase Risoluzione'})
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isMuted ? 'Attiva Audio' : 'Disattiva Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Regolamento</span>
          </button>
        </div>
      </header>

      {/* Opponents Seats (Top Row) */}
      <div className="absolute top-16 inset-x-0 z-10 px-4 flex items-center justify-center gap-3 pointer-events-none">
        {opponentsOrdered.map(opponent => {
          const dist = myPlayer ? calculateDistance(gameState.players, myPlayer.id, opponent.id) : 0;
          const diff = myPlayer ? calculateTargetDifficulty(gameState.players, myPlayer, opponent) : 0;

          return (
            <div key={opponent.id} className="pointer-events-auto transform scale-85 sm:scale-95">
              <PlayerSeat
                player={opponent}
                isCurrentTurn={gameState.turnPlayerId === opponent.id}
                isMe={false}
                distanceFromMe={dist}
                difficultyFromMe={diff}
              />
            </div>
          );
        })}
      </div>

      {/* Battle Log (Floating on top right) */}
      <div className="absolute right-4 top-44 z-10 w-72 sm:w-80 pointer-events-auto opacity-90 hover:opacity-100 transition-opacity">
        <ActionLog logs={gameState.logs} />
      </div>

      {/* Card 3D Inspector Modal when clicked in hand */}
      {selectedCardInspect && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl backdrop-blur-md max-w-sm w-full text-center animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <span className="font-title font-bold text-base text-amber-300">
              {selectedCardInspect.name}
            </span>
            <span className="text-xs uppercase font-bold text-slate-400">
              {selectedCardInspect.type === 'weapon' ? 'Arma' : selectedCardInspect.type === 'property' ? 'Proprietà' : 'Azione'}
            </span>
          </div>

          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            {selectedCardInspect.description}
          </p>

          {selectedCardInspect.type === 'weapon' && (
            <div className="flex items-center justify-center gap-4 bg-slate-950 p-2 rounded-xl mb-4 border border-slate-800 text-xs font-bold">
              <span className="text-amber-400">Gittata: {selectedCardInspect.difficulty}</span>
              <span className="text-red-400">Danno: {selectedCardInspect.damage} PV</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCardInspect(null)}
              className="flex-1 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-slate-400 font-semibold cursor-pointer"
            >
              Chiudi
            </button>

            {isPlayPhase && (
              <button
                onClick={() => {
                  const card = selectedCardInspect;
                  if (card.type === 'weapon' || card.propertyType === 'bushido' || card.actionType === 'geisha' || card.actionType === 'diversion' || card.actionType === 'breathing') {
                    setSelectedCardForTarget(card);
                  } else if (card.type === 'property') {
                    socket.emit('play_property', { cardId: card.id });
                    setSelectedCardInspect(null);
                  } else {
                    socket.emit('play_action', { cardId: card.id });
                    setSelectedCardInspect(null);
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-title font-bold text-xs shadow-lg shadow-red-600/30 cursor-pointer"
              >
                Gioca Questa Carta
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom HUD: Player Identity Bar */}
      {myPrivateState && (
        <div className="absolute bottom-3 inset-x-4 z-20 flex items-center justify-between pointer-events-none">
          {/* Identity & Stats Pill */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md pointer-events-auto shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">
              {myPrivateState.character?.avatar || '👤'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">{myPrivateState.name}</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-black border uppercase"
                  style={{
                    backgroundColor: `${myPrivateState.role.color}25`,
                    borderColor: myPrivateState.role.color,
                    color: myPrivateState.role.color
                  }}
                >
                  {myPrivateState.role.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs mt-0.5 font-bold">
                <span className="text-red-400">❤️ {myPrivateState.currentHp}/{myPrivateState.maxHp}</span>
                <span className="text-purple-300">🪷 {myPrivateState.honorPoints} Onore</span>
                <span className="text-amber-400">⚔️ Armi: {myPrivateState.weaponsPlayedThisTurn}/{myPrivateState.maxWeaponsPerTurn}</span>
              </div>
            </div>
          </div>

          {/* Turn Actions Controls */}
          <div className="pointer-events-auto flex items-center gap-3">
            {isPlayPhase && (
              <button
                onClick={handleEndPlayPhase}
                className="py-3 px-6 rounded-2xl font-title font-black text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:scale-105 text-slate-950 shadow-2xl shadow-amber-500/30 flex items-center gap-2 cursor-pointer transition-all"
              >
                Passa Turno
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Target Selection Modal */}
      {selectedCardForTarget && myPlayer && (
        <TargetSelectionModal
          cardToPlay={selectedCardForTarget}
          myPlayer={myPlayer}
          allPlayers={gameState.players}
          onConfirm={handleConfirmTarget}
          onCancel={() => setSelectedCardForTarget(null)}
        />
      )}

      {/* Reaction Modal */}
      {gameState.pendingReaction && gameState.pendingReaction.pendingForPlayerId === myId && (
        <ReactionModal
          reaction={gameState.pendingReaction}
          myHand={myPrivateState?.hand || []}
          myCharacterId={myPrivateState?.character?.id}
          onReact={(cardId) => {
            if (cardId) soundManager.playParryClash();
            else soundManager.playTaiko();
            socket.emit('submit_reaction', { responseCardId: cardId });
          }}
        />
      )}

      {/* Discard Excess Cards Modal */}
      {isDiscardPhase && myPrivateState && myPrivateState.hand.length > myPrivateState.currentHp && (
        <DiscardModal
          myHand={myPrivateState.hand}
          currentHp={myPrivateState.currentHp}
          onConfirmDiscard={(cardIds) => {
            soundManager.playCardSlide();
            socket.emit('discard_excess', { cardIds });
          }}
        />
      )}

      {/* Game Over Modal */}
      {gameState.status === 'game_over' && (
        <GameOverModal gameState={gameState} onPlayAgain={onReturnToLobby} />
      )}

      {/* Rules Modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
};
