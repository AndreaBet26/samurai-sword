import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import { CardDef, GameState, PlayerPrivateState, PlayerPublicState } from '../../../shared/types';
import { calculateDistance, calculateTargetDifficulty, canAttackWithWeapon } from '../../../shared/rules';
import { soundManager } from '../utils/soundEffects';
import { PlayerSeat } from './PlayerSeat';
import { CardView } from './CardView';
import { ActionLog } from './ActionLog';
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
  Crosshair,
  ShieldAlert,
  HeartCrack,
  Trash2,
  X
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
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
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

  // Under attack / reaction state
  const isUnderAttack = Boolean(
    gameState.pendingReaction && gameState.pendingReaction.pendingForPlayerId === myId
  );
  const reaction = gameState.pendingReaction;

  // Determine eligible cards from hand for defensive reaction
  let eligibleReactionCardIds: string[] = [];
  if (isUnderAttack && reaction && myPrivateState) {
    if (reaction.type === 'parry_weapon') {
      let cards = myPrivateState.hand.filter(c => c.actionType === 'parry');
      if (myPrivateState.character?.id === 'hanzo' && myPrivateState.hand.length > 1) {
        cards = [...cards, ...myPrivateState.hand.filter(c => c.type === 'weapon')];
      }
      eligibleReactionCardIds = cards.map(c => c.id);
    } else if (reaction.type === 'battle_cry') {
      eligibleReactionCardIds = myPrivateState.hand.filter(c => c.actionType === 'parry').map(c => c.id);
    } else if (reaction.type === 'jujutsu') {
      eligibleReactionCardIds = myPrivateState.hand.filter(c => c.type === 'weapon').map(c => c.id);
    }
  }

  // Clear discard selection when not in discard phase
  useEffect(() => {
    if (!isDiscardPhase) {
      setSelectedDiscardIds([]);
    }
  }, [isDiscardPhase]);

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

  // Check if an opponent can be targeted by the currently selected card
  const checkCanTargetOpponent = (opponent: PlayerPublicState): boolean => {
    if (!selectedCardForTarget || !myPlayer) return false;
    if (opponent.id === myPlayer.id) return false;

    if (selectedCardForTarget.type === 'weapon') {
      const check = canAttackWithWeapon(gameState.players, myPlayer, opponent, selectedCardForTarget);
      return check.canAttack;
    }
    if (selectedCardForTarget.actionType === 'diversion') {
      return opponent.handCount > 0;
    }
    if (selectedCardForTarget.actionType === 'geisha') {
      return opponent.handCount > 0 || opponent.propertiesInPlay.length > 0;
    }
    if (selectedCardForTarget.propertyType === 'bushido') {
      return !opponent.isHarmless && opponent.currentHp > 0;
    }
    if (selectedCardForTarget.actionType === 'breathing') {
      return true;
    }
    return true;
  };

  // Handle clicking a card in your hand directly
  const handleCardClick = (card: CardDef) => {
    // 1. If under attack, clicking an eligible defense card immediately parries!
    if (isUnderAttack) {
      if (eligibleReactionCardIds.includes(card.id)) {
        handleReaction(card.id);
      }
      return;
    }

    // 2. If in discard phase, toggle discard selection on the card
    if (isDiscardPhase && myPrivateState && myPrivateState.hand.length > myPrivateState.currentHp) {
      const excess = myPrivateState.hand.length - myPrivateState.currentHp;
      if (selectedDiscardIds.includes(card.id)) {
        setSelectedDiscardIds(prev => prev.filter(id => id !== card.id));
      } else if (selectedDiscardIds.length < excess) {
        setSelectedDiscardIds(prev => [...prev, card.id]);
      }
      return;
    }

    // 3. Normal play phase
    if (!isPlayPhase) return;

    if (card.type === 'weapon') {
      if ((myPlayer?.weaponsPlayedThisTurn ?? 0) >= (myPlayer?.maxWeaponsPerTurn ?? 1)) {
        alert('Hai già giocato il numero massimo di armi consentite per questo turno!');
        return;
      }
      if (selectedCardForTarget?.id === card.id) {
        setSelectedCardForTarget(null);
      } else {
        setSelectedCardForTarget(card);
      }
      return;
    }

    if (card.type === 'property') {
      if (card.propertyType === 'bushido') {
        if (selectedCardForTarget?.id === card.id) {
          setSelectedCardForTarget(null);
        } else {
          setSelectedCardForTarget(card);
        }
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
        if (selectedCardForTarget?.id === card.id) {
          setSelectedCardForTarget(null);
        } else {
          setSelectedCardForTarget(card);
        }
      } else {
        // Self or global actions: tea_ceremony, daimyo, battle_cry, jujutsu
        soundManager.playTaiko();
        socket.emit('play_action', { cardId: card.id });
      }
    }
  };

  // Directly confirm target when clicking opponent seat on the table
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
    setSelectedCardForTarget(null);
    soundManager.playCardSlide();
    socket.emit('end_play_phase');
  };

  const handleDiscardConfirm = (cardIds: string[]) => {
    soundManager.playCardSlide();
    socket.emit('discard_excess', { cardIds });
    setSelectedDiscardIds([]);
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

  const excessDiscardCount = myPrivateState ? Math.max(0, myPrivateState.hand.length - myPrivateState.currentHp) : 0;

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
              const canTarget = checkCanTargetOpponent(opponent);

              return (
                <PlayerSeat
                  key={opponent.id}
                  player={opponent}
                  isCurrentTurn={gameState.turnPlayerId === opponent.id}
                  isMe={false}
                  distanceFromMe={dist}
                  difficultyFromMe={diff}
                  canTarget={canTarget}
                  targetCardName={selectedCardForTarget?.name}
                  onSelectAsTarget={(propertyId) => handleConfirmTarget(opponent.id, propertyId)}
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

          {/* Center Prompts */}
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

            {!isIeyasuDrawPhase && isMyTurn && !isUnderAttack && (
              <div className="bg-slate-900 border border-amber-500/60 rounded-2xl p-3 shadow-lg max-w-xs">
                <span className="text-xs font-bold text-amber-400 block mb-1">È il tuo turno!</span>
                <p className="text-xs text-slate-300">
                  {isPlayPhase && 'Clicca una carta dalla mano per giocarla o attaccare.'}
                  {isDiscardPhase && 'Seleziona le carte in eccesso direttamente dalla mano per scartarle.'}
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

            {/* IN-GAME NOTIFICATION: ATTACK & DEFENSE ALERT (ZERO MODAL) */}
            {isUnderAttack && reaction && (
              <div className="mb-4 bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-2 border-red-500 rounded-2xl p-4 shadow-2xl shadow-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-900/80 border-2 border-red-500 flex items-center justify-center text-red-300 shrink-0 shadow-lg animate-pulse">
                    <ShieldAlert className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-black tracking-wider text-red-400 flex items-center gap-1">
                      ⚠️ SEI SOTTO ATTACCO!
                    </span>
                    <p className="text-sm font-semibold text-slate-100 mt-0.5">
                      {reaction.type === 'parry_weapon' && (
                        <>Attacco con <span className="text-amber-400 font-bold">{reaction.weaponCard?.name || 'un\'Arma'}</span> per <span className="text-red-400 font-bold">{reaction.damage} PV</span> di danno!</>
                      )}
                      {reaction.type === 'battle_cry' && (
                        <>Un avversario ha scagliato un <span className="text-amber-400 font-bold">Grido di Battaglia</span> (-1 PV)!</>
                      )}
                      {reaction.type === 'jujutsu' && (
                        <>Un avversario usa una tecnica di <span className="text-amber-400 font-bold">Jiujitsu</span>!</>
                      )}
                    </p>
                    <span className="text-xs text-slate-300 font-medium">
                      {eligibleReactionCardIds.length > 0
                        ? '🛡️ Clicca la carta PARATA evidenziata nella tua mano per parare l\'attacco, oppure:'
                        : 'Non possiedi carte di difesa in mano. Devi subire il colpo:'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleReaction(null)}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-red-800 to-rose-900 hover:from-red-700 hover:to-rose-800 text-white font-bold text-xs flex items-center gap-2 border border-red-500 shadow-xl shadow-red-900/40 cursor-pointer transition-all hover:scale-105"
                  >
                    <HeartCrack className="w-4 h-4 text-red-200" />
                    Subisci il Danno ({reaction.damage || 1} PV)
                  </button>
                </div>
              </div>
            )}

            {/* IN-GAME NOTIFICATION: TARGETING ACTIVE (ZERO MODAL) */}
            {selectedCardForTarget && !isUnderAttack && (
              <div className="mb-4 bg-gradient-to-r from-slate-900 via-amber-950/50 to-slate-900 border-2 border-amber-500 rounded-2xl p-3.5 shadow-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400 shrink-0">
                    <Crosshair className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-black text-amber-400 block">
                      Carta Selezionata: {selectedCardForTarget.name}
                    </span>
                    <p className="text-xs text-slate-200">
                      {selectedCardForTarget.type === 'weapon'
                        ? `Gittata ${selectedCardForTarget.difficulty}. Clicca direttamente uno dei guerrieri a portata cerchiati di rosso al tavolo:`
                        : 'Clicca direttamente uno dei guerrieri al tavolo per colpirlo:'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCardForTarget(null)}
                  className="py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Annulla
                </button>
              </div>
            )}

            {/* IN-GAME NOTIFICATION: DISCARD LIMIT ACTIVE (ZERO MODAL) */}
            {isDiscardPhase && excessDiscardCount > 0 && !isUnderAttack && (
              <div className="mb-4 bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border-2 border-amber-500 rounded-2xl p-3.5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400 shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-black text-amber-400 block">
                      Fase di Scarto ({selectedDiscardIds.length} di {excessDiscardCount} selezionate)
                    </span>
                    <p className="text-xs text-slate-300">
                      La tua Resistenza è di {myPrivateState.currentHp} PV. Clicca le {excessDiscardCount} carte dalla mano che desideri scartare:
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDiscardConfirm(selectedDiscardIds)}
                  disabled={selectedDiscardIds.length !== excessDiscardCount}
                  className={`py-2 px-5 rounded-xl font-black text-xs border shadow transition-all ${
                    selectedDiscardIds.length === excessDiscardCount
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 cursor-pointer shadow-amber-500/30 scale-105'
                      : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                  }`}
                >
                  Conferma Scarto ({selectedDiscardIds.length}/{excessDiscardCount})
                </button>
              </div>
            )}

            {/* Player's Hand of Cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  La Tua Mano ({myPrivateState.hand.length} carte)
                </span>
                {isUnderAttack ? (
                  <span className="text-xs text-emerald-400 font-black animate-pulse flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    Clicca sulla carta Parata evidenziata per difenderti!
                  </span>
                ) : isPlayPhase ? (
                  <span className="text-xs text-amber-400 font-semibold animate-pulse">
                    Clicca su una carta per giocarla
                  </span>
                ) : null}
              </div>

              {myPrivateState.hand.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-800 rounded-2xl text-center text-slate-500 italic text-sm">
                  Non hai carte in mano. Sei Inoffensivo fino al tuo prossimo turno!
                </div>
              ) : (
                <div className="flex items-center gap-3 overflow-x-auto pb-4 pt-2 px-1">
                  {myPrivateState.hand.map(card => {
                    const isDefensive = isUnderAttack && eligibleReactionCardIds.includes(card.id);
                    const isDiscardSelected = isDiscardPhase && selectedDiscardIds.includes(card.id);
                    const isCardSelected = selectedCardForTarget?.id === card.id;

                    const isCardPlayable = isUnderAttack
                      ? isDefensive
                      : isDiscardPhase
                      ? true
                      : isPlayPhase;

                    return (
                      <CardView
                        key={card.id}
                        card={card}
                        isSelected={isCardSelected}
                        isPlayable={isCardPlayable}
                        isDefensiveGlow={isDefensive}
                        isDiscardSelected={isDiscardSelected}
                        onClick={() => handleCardClick(card)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Game Over Modal */}
      {gameState.status === 'game_over' && (
        <GameOverModal gameState={gameState} onPlayAgain={onReturnToLobby} />
      )}

      {/* Rules Modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
};
