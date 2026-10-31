import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import { CardDef, GameState, PlayerPrivateState, PlayerPublicState } from '../../../shared/types';
import { calculateDistance, calculateTargetDifficulty, canAttackWithWeapon } from '../../../shared/rules';
import { soundManager } from '../utils/soundEffects';
import { PlayerSeat } from './PlayerSeat';
import { CardView } from './CardView';
import { ActionLog } from './ActionLog';
import { ReactionModal } from './ReactionModal';
import { TargetSelectionModal } from './TargetSelectionModal';
import { DiscardModal } from './DiscardModal';
import { GameOverModal } from './GameOverModal';
import { RulesModal } from './RulesModal';
import { OpeningCutscene } from './OpeningCutscene';
import {
  Sword,
  Shield,
  Layers,
  Flame,
  BookOpen,
  ArrowRight,
  Volume2,
  VolumeX,
  Sparkles
} from 'lucide-react';

interface GameBoardProps {
  gameState: GameState;
  myPrivateState?: PlayerPrivateState;
  onReturnToLobby: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  myPrivateState,
  onReturnToLobby
}) => {
  const [selectedCardForTarget, setSelectedCardForTarget] = useState<CardDef | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const [slashAnimation, setSlashAnimation] = useState(false);

  const myId = myPrivateState?.id || '';
  const myPlayer = gameState.players.find(p => p.id === myId);
  const isMyTurn = gameState.turnPlayerId === myId;
  const isPlayPhase = isMyTurn && gameState.turnPhase === 'play';
  const isDiscardPhase = isMyTurn && gameState.turnPhase === 'discard';
  const isIeyasuDrawPhase = isMyTurn && gameState.turnPhase === 'draw' && myPrivateState?.character?.id === 'ieyasu';

  // Opponents ordered in clockwise circle starting after me
  const myIndex = gameState.turnOrder.indexOf(myId);
  const opponentsOrdered: PlayerPublicState[] = [];
  if (myIndex !== -1) {
    for (let i = 1; i < gameState.turnOrder.length; i++) {
      const targetId = gameState.turnOrder[(myIndex + i) % gameState.turnOrder.length];
      const p = gameState.players.find(player => player.id === targetId);
      if (p) opponentsOrdered.push(p);
    }
  }

  // Trigger slash animation on attacks in log
  useEffect(() => {
    if (gameState.logs.length > 0) {
      const lastLog = gameState.logs[gameState.logs.length - 1];
      if (lastLog.type === 'attack') {
        soundManager.playSwordSlash();
        setSlashAnimation(true);
        const timer = setTimeout(() => setSlashAnimation(false), 800);
        return () => clearTimeout(timer);
      } else if (lastLog.type === 'damage') {
        soundManager.playTaiko();
      } else if (lastLog.type === 'defeat') {
        soundManager.playHonorChime();
      }
    }
  }, [gameState.logs.length]);

  const toggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  // Handle clicking a card in your hand
  const handleCardClick = (card: CardDef) => {
    if (!isPlayPhase) return;

    if (card.type === 'weapon') {
      if ((myPlayer?.weaponsPlayedThisTurn ?? 0) >= (myPlayer?.maxWeaponsPerTurn ?? 1)) {
        alert('Hai già giocato il numero massimo di armi consentite per questo turno!');
        return;
      }
      setSelectedCardForTarget(card);
      return;
    }

    if (card.type === 'property') {
      if (card.propertyType === 'bushido') {
        setSelectedCardForTarget(card);
      } else {
        soundManager.playCardSlide();
        socket.emit('play_property', { cardId: card.id });
      }
      return;
    }

    if (card.type === 'action') {
      if (
        card.actionType === 'geisha' ||
        card.actionType === 'diversion' ||
        card.actionType === 'breathing'
      ) {
        setSelectedCardForTarget(card);
      } else {
        // Self or global actions: tea_ceremony, daimyo, battle_cry, jujutsu
        soundManager.playTaiko();
        socket.emit('play_action', { cardId: card.id });
      }
    }
  };

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
  };

  const handleReaction = (cardId: string | null) => {
    if (cardId) {
      soundManager.playParryClash();
    } else {
      soundManager.playTaiko();
    }
    socket.emit('submit_reaction', { responseCardId: cardId });
  };

  const handleEndPlayPhase = () => {
    soundManager.playCardSlide();
    socket.emit('end_play_phase');
  };

  const handleDiscardConfirm = (cardIds: string[]) => {
    soundManager.playCardSlide();
    socket.emit('discard_excess', { cardIds });
  };

  const handleIeyasuDraw = (fromDiscard: boolean) => {
    soundManager.playCardSlide();
    socket.emit('draw_ieyasu', { fromDiscard });
  };

  const handleNobunagaAbility = () => {
    soundManager.playTaiko();
    socket.emit('use_nobunaga');
  };

  const turnPlayer = gameState.players.find(p => p.id === gameState.turnPlayerId);

  // If opening cutscene has not been viewed yet, show it!
  if (!hasSeenIntro && myPrivateState?.character && myPrivateState?.role) {
    return (
      <OpeningCutscene
        character={myPrivateState.character}
        role={myPrivateState.role}
        onComplete={() => setHasSeenIntro(true)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden relative">
      {/* Dynamic Sword Slash Animation Overlay */}
      {slashAnimation && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center animate-slash">
          <div className="w-[120vw] h-1.5 bg-gradient-to-r from-transparent via-red-500 to-transparent rotate-[-25deg] shadow-[0_0_20px_#ef4444]" />
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sword className="w-5 h-5 text-red-500" />
            <span className="font-title font-black text-lg text-slate-100 tracking-wider hidden sm:inline">
              SAMURAI SWORD
            </span>
          </div>
          <span className="bg-slate-800 text-amber-400 font-mono text-xs px-2.5 py-1 rounded-lg border border-slate-700">
            Stanza: {gameState.roomCode}
          </span>
        </div>

        {/* Turn Status Banner */}
        <div className="flex items-center gap-2">
          <div className="text-xs px-3.5 py-1 rounded-full bg-slate-800 border border-slate-700 font-semibold flex items-center gap-2 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>
              Turno di: <strong className="text-amber-300">{turnPlayer?.name || '...'}</strong>
            </span>
            <span className="text-slate-500 hidden md:inline">
              ({gameState.turnPhase === 'play' ? 'Fase di Gioco' : gameState.turnPhase === 'discard' ? 'Fase di Scarto' : 'Fase Risoluzione'})
            </span>
          </div>
        </div>

        {/* Actions & Audio Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isMuted ? 'Attiva Audio' : 'Disattiva Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => setShowRules(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Regolamento</span>
          </button>
        </div>
      </header>

      {/* Main Table Arena */}
      <div className="flex-1 flex flex-col justify-between p-3 sm:p-5 max-w-7xl w-full mx-auto gap-4">
        {/* Opponents Circle (Top & Middle) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Guerrieri al Tavolo
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Mazzo: {gameState.deckCount} carte • Scarti: {gameState.discardPileCount} carte
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {opponentsOrdered.map(opponent => {
              const dist = myPlayer ? calculateDistance(gameState.players, myPlayer.id, opponent.id) : 0;
              const diff = myPlayer ? calculateTargetDifficulty(gameState.players, myPlayer, opponent) : 0;

              return (
                <PlayerSeat
                  key={opponent.id}
                  player={opponent}
                  isCurrentTurn={gameState.turnPlayerId === opponent.id}
                  isMe={false}
                  distanceFromMe={dist}
                  difficultyFromMe={diff}
                />
              );
            })}
          </div>
        </div>

        {/* Center Arena: Draw Pile, Discard Pile & Battle Log */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-900/40 border border-slate-800/80 rounded-3xl p-4 backdrop-blur-sm">
          {/* Deck & Discard Piles */}
          <div className="flex items-center justify-center gap-6">
            {/* Draw Deck */}
            <div className="flex flex-col items-center">
              <div className="w-20 sm:w-24 h-28 sm:h-32 rounded-2xl bg-gradient-to-br from-red-950 via-slate-900 to-black border-2 border-red-800/80 shadow-2xl flex flex-col items-center justify-center text-center p-2 relative group select-none hover:scale-105 transition-transform cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-red-900/60 border border-red-600 flex items-center justify-center mb-1">
                  <Sword className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Mazzo
                </span>
                <span className="text-base font-black text-slate-100">{gameState.deckCount}</span>
              </div>
            </div>

            {/* Discard Pile */}
            <div className="flex flex-col items-center">
              {gameState.discardPileTop ? (
                <div className="transform rotate-2 hover:rotate-0 transition-transform">
                  <CardView card={gameState.discardPileTop} isPlayable={false} isCompact={false} />
                </div>
              ) : (
                <div className="w-20 sm:w-24 h-28 sm:h-32 rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-600 text-xs">
                  <Layers className="w-6 h-6 mb-1 opacity-50" />
                  Scarti
                </div>
              )}
            </div>
          </div>

          {/* Special Prompts (e.g. Ieyasu Draw Choice or Turn Instructions) */}
          <div className="flex flex-col items-center justify-center text-center p-3">
            {isIeyasuDrawPhase && (
              <div className="bg-amber-950/80 border-2 border-amber-500 rounded-3xl p-4 shadow-xl animate-bounce-short">
                <span className="text-xs uppercase font-bold text-amber-400 block mb-1">
                  Abilità Speciale di Ieyasu
                </span>
                <p className="text-xs text-slate-200 mb-3">
                  Puoi scegliere di pescare la prima carta dalla cima degli Scarti!
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleIeyasuDraw(true)}
                    className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow"
                  >
                    Pesca da Scarti
                  </button>
                  <button
                    onClick={() => handleIeyasuDraw(false)}
                    className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 cursor-pointer"
                  >
                    Pesca da Mazzo
                  </button>
                </div>
              </div>
            )}

            {!isIeyasuDrawPhase && isMyTurn && (
              <div className="bg-slate-900 border border-amber-500/60 rounded-2xl p-3 shadow-lg max-w-xs">
                <span className="text-xs font-bold text-amber-400 block mb-1">È il tuo turno!</span>
                <p className="text-xs text-slate-300">
                  {isPlayPhase && 'Gioca armi, equipaggia proprietà o attiva azioni dalla tua mano.'}
                  {isDiscardPhase && 'Scarta le carte in eccesso per rispettare il limite di Resistenza.'}
                </p>
              </div>
            )}
          </div>

          {/* Action Log Drawer */}
          <div>
            <ActionLog logs={gameState.logs} />
          </div>
        </div>

        {/* Bottom Cockpit: Player's Own Status & Hand of Cards */}
        {myPrivateState && (
          <div className="bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-md">
            {/* Player Info Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
              {/* Character & Role */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl shadow-inner overflow-hidden">
                  {myPrivateState.character?.avatar || '👤'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-100">
                      {myPrivateState.name}
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-lg text-xs font-black border uppercase tracking-wider shadow-sm"
                      style={{
                        backgroundColor: `${myPrivateState.role.color}25`,
                        borderColor: myPrivateState.role.color,
                        color: myPrivateState.role.color
                      }}
                      title={myPrivateState.role.description}
                    >
                      {myPrivateState.role.name}
                    </span>
                  </div>
                  <span className="text-xs text-amber-400 font-semibold block">
                    {myPrivateState.character?.name} ({myPrivateState.character?.title})
                  </span>
                </div>
              </div>

              {/* Stats & Turn Weapons Counter */}
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">Resistenza:</span>
                  <span className="font-black text-red-400 text-sm">
                    {myPrivateState.currentHp} / {myPrivateState.maxHp}
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-purple-300 font-bold uppercase">Onore:</span>
                  <span className="font-black text-purple-300 text-sm">
                    {myPrivateState.honorPoints} 🪷
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-bold uppercase">Armi giocate:</span>
                  <span className="font-black text-amber-300 text-sm">
                    {myPrivateState.weaponsPlayedThisTurn} / {myPrivateState.maxWeaponsPerTurn}
                  </span>
                </div>

                {/* Nobunaga special button */}
                {myPrivateState.character?.id === 'nobunaga' && isPlayPhase && (
                  <button
                    onClick={handleNobunagaAbility}
                    disabled={myPrivateState.currentHp <= 1}
                    className="py-1.5 px-3 rounded-xl bg-orange-950 border border-orange-600 hover:bg-orange-900 text-orange-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    Sacrifica 1 PV per pescare
                  </button>
                )}

                {/* Pass Turn Button */}
                {isPlayPhase && (
                  <button
                    onClick={handleEndPlayPhase}
                    className="py-2.5 px-6 rounded-xl font-title font-bold text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:scale-105 text-slate-950 shadow-xl shadow-amber-500/25 flex items-center gap-2 cursor-pointer transition-all"
                  >
                    Passa Turno
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Properties currently in play in front of you */}
            {myPrivateState.propertiesInPlay.length > 0 && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-blue-400 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  Proprietà Attive:
                </span>
                <div className="flex flex-wrap gap-2">
                  {myPrivateState.propertiesInPlay.map(prop => (
                    <CardView key={prop.id} card={prop} isCompact={true} isPlayable={false} />
                  ))}
                </div>
              </div>
            )}

            {/* Player's Hand Cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  La Tua Mano ({myPrivateState.hand.length} carte)
                </span>
                {isPlayPhase && (
                  <span className="text-xs text-amber-400 font-semibold animate-pulse">
                    Clicca su una carta per giocarla
                  </span>
                )}
              </div>

              {myPrivateState.hand.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-800 rounded-2xl text-center text-slate-500 italic text-sm">
                  Non hai carte in mano. Sei Inoffensivo fino al tuo prossimo turno!
                </div>
              ) : (
                <div className="flex items-center gap-3 overflow-x-auto pb-4 pt-2 px-1">
                  {myPrivateState.hand.map(card => (
                    <CardView
                      key={card.id}
                      card={card}
                      isPlayable={isPlayPhase}
                      onClick={() => handleCardClick(card)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
          onReact={handleReaction}
        />
      )}

      {/* Discard Excess Cards Modal */}
      {isDiscardPhase && myPrivateState && myPrivateState.hand.length > myPrivateState.currentHp && (
        <DiscardModal
          myHand={myPrivateState.hand}
          currentHp={myPrivateState.currentHp}
          onConfirmDiscard={handleDiscardConfirm}
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
