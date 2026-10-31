import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import { CardDef, GameState, PlayerPrivateState, PlayerPublicState } from '../../../shared/types';
import { calculateDistance, calculateTargetDifficulty, canAttackWithWeapon } from '../../../shared/rules';
import { soundManager } from '../utils/soundEffects';
import { OpponentTableArea } from './OpponentTableArea';
import { HandTray } from './HandTray';
import { TabletopCard } from './TabletopCard';
import { HeartToken, HonorToken } from './WoodToken';
import { CardInspectModal } from './CardInspectModal';
import { CharacterDetailModal } from './CharacterDetailModal';
import { TableCardAnimator } from './TableCardAnimator';
import { ReactionModal } from './ReactionModal';
import { DiscardModal } from './DiscardModal';
import { GameOverModal } from './GameOverModal';
import { RulesModal } from './RulesModal';
import {
  Sword,
  BookOpen,
  Volume2,
  VolumeX,
  ArrowRight,
  Flame,
  X,
  Crown,
  Sparkles
} from 'lucide-react';

interface VirtualTableProps {
  gameState: GameState;
  myPrivateState?: PlayerPrivateState;
  onReturnToLobby: () => void;
}

export const VirtualTable: React.FC<VirtualTableProps> = ({
  gameState,
  myPrivateState,
  onReturnToLobby
}) => {
  const [inspectCard, setInspectCard] = useState<CardDef | null>(null);
  const [inspectCharacter, setInspectCharacter] = useState<any | null>(null);
  const [activePlayCard, setActivePlayCard] = useState<CardDef | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);
  const [slashAnimation, setSlashAnimation] = useState(false);

  const myId = myPrivateState?.id || '';
  const myPlayer = gameState.players.find(p => p.id === myId);
  const isMyTurn = gameState.turnPlayerId === myId;
  const isPlayPhase = isMyTurn && gameState.turnPhase === 'play';
  const isDiscardPhase = isMyTurn && gameState.turnPhase === 'discard';
  const turnPlayer = gameState.players.find(p => p.id === gameState.turnPlayerId);

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

  // Distribute opponents around table (Uno / Poker style): West (Left), North (Top), East (Right)
  const distributeOpponents = (opponents: PlayerPublicState[]) => {
    const n = opponents.length;
    if (n === 0) return { left: [], top: [], right: [] };
    if (n === 1) return { left: [], top: opponents, right: [] };
    if (n === 2) return { left: [opponents[0]], top: [], right: [opponents[1]] };
    if (n === 3) return { left: [opponents[0]], top: [opponents[1]], right: [opponents[2]] };
    if (n === 4) return { left: [opponents[0]], top: [opponents[1], opponents[2]], right: [opponents[3]] };
    if (n === 5) return { left: [opponents[0]], top: [opponents[1], opponents[2], opponents[3]], right: [opponents[4]] };
    return {
      left: [opponents[0], opponents[1]],
      top: [opponents[2], opponents[3]],
      right: [opponents[4], opponents[5]]
    };
  };

  const { left: leftOpponents, top: topOpponents, right: rightOpponents } = distributeOpponents(opponentsOrdered);

  // Attack / Damage sound effects & Slash animation
  useEffect(() => {
    if (gameState.logs.length > 0) {
      const lastLog = gameState.logs[gameState.logs.length - 1];
      if (lastLog.type === 'attack') {
        soundManager.playSwordSlash();
        setSlashAnimation(true);
        const timer = setTimeout(() => setSlashAnimation(false), 700);
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

  const handleInitiatePlay = (card: CardDef) => {
    if (!isPlayPhase) return;

    if (card.type === 'weapon') {
      if ((myPlayer?.weaponsPlayedThisTurn ?? 0) >= (myPlayer?.maxWeaponsPerTurn ?? 1)) {
        alert('Hai già giocato il numero massimo di armi consentite per questo turno!');
        return;
      }
      setActivePlayCard(card);
      return;
    }

    if (card.type === 'property') {
      if (card.propertyType === 'bushido') {
        setActivePlayCard(card);
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
        setActivePlayCard(card);
      } else {
        soundManager.playTaiko();
        socket.emit('play_action', { cardId: card.id });
      }
    }
  };

  const handleDirectTargetClick = (targetPlayerId: string) => {
    if (!activePlayCard) return;

    if (activePlayCard.type === 'weapon') {
      soundManager.playSwordSlash();
      socket.emit('attack_with_weapon', {
        weaponCardId: activePlayCard.id,
        targetId: targetPlayerId
      });
    } else {
      soundManager.playCardSlide();
      socket.emit('play_action', {
        cardId: activePlayCard.id,
        targetPlayerId
      });
    }

    setActivePlayCard(null);
  };

  const handleEndPlayPhase = () => {
    soundManager.playCardSlide();
    setActivePlayCard(null);
    socket.emit('end_play_phase');
  };

  const handleReaction = (cardId: string | null) => {
    if (cardId) soundManager.playParryClash();
    else soundManager.playTaiko();
    socket.emit('submit_reaction', { responseCardId: cardId });
  };

  const handleNobunagaAbility = () => {
    soundManager.playTaiko();
    socket.emit('use_nobunaga');
  };

  const isTargetValid = (target: PlayerPublicState): boolean => {
    if (!activePlayCard || !myPlayer) return false;
    if (target.id === myId) return false;

    if (activePlayCard.type === 'weapon') {
      const check = canAttackWithWeapon(gameState.players, myPlayer, target, activePlayCard);
      return check.canAttack;
    }

    if (activePlayCard.actionType === 'diversion') {
      return target.handCount > 0;
    }

    if (activePlayCard.actionType === 'geisha') {
      return target.handCount > 0 || target.propertiesInPlay.length > 0;
    }

    if (activePlayCard.propertyType === 'bushido') {
      return !target.isHarmless && target.currentHp > 0;
    }

    if (activePlayCard.actionType === 'breathing') {
      return true;
    }

    return false;
  };

  // My hearts array
  const myHearts = [];
  if (myPrivateState) {
    for (let i = 0; i < myPrivateState.maxHp; i++) {
      myHearts.push(i < myPrivateState.currentHp);
    }
  }

  // Last 2 battle logs for clean floating subtitle text (no box)
  const recentLogs = gameState.logs.slice(-2);

  return (
    <div
      className="h-screen w-screen overflow-hidden select-none relative flex flex-col justify-between p-2.5 sm:p-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, #0c1829 0%, #060e18 60%, #020509 100%)',
        border: '10px solid #1c1109' // Wooden table frame
      }}
    >
      {/* Dynamic Sword Slash Animation Overlay */}
      {slashAnimation && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center animate-slash">
          <div className="w-[120vw] h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent rotate-[-25deg] shadow-[0_0_30px_#ef4444]" />
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex items-center justify-between z-20 text-xs px-2 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-title font-black text-amber-400 text-sm tracking-wider drop-shadow">
            SAMURAI SWORD
          </span>
          <span className="text-slate-400 font-mono text-[11px] drop-shadow">
            Stanza: {gameState.roomCode}
          </span>
        </div>

        {/* Turn Status Indicator */}
        <div className="flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full border border-amber-600/40 backdrop-blur-sm shadow">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-slate-200 text-xs font-semibold">
            Turno: <strong className="text-amber-300">{turnPlayer?.name || '...'}</strong>
            {isMyTurn && ' (Tocca a te!)'}
          </span>
        </div>

        {/* Mute & Rules */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSound}
            className="text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
            title={isMuted ? 'Attiva Audio' : 'Disattiva Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="text-slate-300 hover:text-amber-400 flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Regole
          </button>
        </div>
      </div>

      {/* Direct Targeting Banner (when playing an attack) */}
      {activePlayCard && (
        <div className="absolute top-12 inset-x-0 z-30 flex items-center justify-center gap-3 py-1.5 bg-red-950/95 border-y border-red-500 shadow-2xl backdrop-blur-sm animate-fadeIn">
          <span className="text-xs font-bold text-red-200 flex items-center gap-1.5">
            <Sword className="w-4 h-4 text-red-400" />
            Stai giocando {activePlayCard.name}: Clicca direttamente sul personaggio che vuoi colpire!
          </span>
          <button
            onClick={() => setActivePlayCard(null)}
            className="text-[11px] font-bold text-slate-300 hover:text-white bg-black/60 px-2 py-0.5 rounded border border-slate-600 flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Annulla
          </button>
        </div>
      )}

      {/* MAIN TABLE AREA: Oval / Ring Table with opponents surrounding the felt (Uno style) */}
      <div className="flex-1 flex flex-col justify-between w-full max-w-7xl mx-auto min-h-0 relative px-2">
        {/* NORTH (Top Opponents) */}
        <div className="flex items-start justify-center gap-8 sm:gap-14 pt-0.5 shrink-0 min-h-[140px]">
          {topOpponents.map((opponent) => {
            const dist = myPlayer ? calculateDistance(gameState.players, myPlayer.id, opponent.id) : 0;
            const diff = myPlayer ? calculateTargetDifficulty(gameState.players, myPlayer, opponent) : 0;
            const canTargetThis = isTargetValid(opponent);

            return (
              <OpponentTableArea
                key={opponent.id}
                player={opponent}
                isCurrentTurn={gameState.turnPlayerId === opponent.id}
                distanceFromMe={dist}
                difficultyFromMe={diff}
                isTargetable={canTargetThis}
                onTargetSelect={() => handleDirectTargetClick(opponent.id)}
                onInspectCard={(card) => setInspectCard(card)}
                onInspectCharacter={(char) => setInspectCharacter(char)}
              />
            );
          })}
        </div>

        {/* MIDDLE FELT: Left Opponents (West) <---> Deck & Discard Center <---> Right Opponents (East) */}
        <div className="flex items-center justify-between w-full flex-1 px-4 my-auto">
          {/* WEST (Left Opponents) */}
          <div className="w-56 shrink-0 flex flex-col items-center justify-center gap-4">
            {leftOpponents.map((opponent) => {
              const dist = myPlayer ? calculateDistance(gameState.players, myPlayer.id, opponent.id) : 0;
              const diff = myPlayer ? calculateTargetDifficulty(gameState.players, myPlayer, opponent) : 0;
              const canTargetThis = isTargetValid(opponent);

              return (
                <OpponentTableArea
                  key={opponent.id}
                  player={opponent}
                  isCurrentTurn={gameState.turnPlayerId === opponent.id}
                  distanceFromMe={dist}
                  difficultyFromMe={diff}
                  isTargetable={canTargetThis}
                  onTargetSelect={() => handleDirectTargetClick(opponent.id)}
                  onInspectCard={(card) => setInspectCard(card)}
                  onInspectCharacter={(char) => setInspectCharacter(char)}
                />
              );
            })}
          </div>

          {/* TABLE CENTER: Mazzo, Play Zone, Scarti, and subtle event subtitle */}
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="flex items-center gap-6 sm:gap-8">
              {/* Mazzo (Draw Deck) */}
              <div
                id="table-deck-pile"
                className="relative cursor-pointer transform hover:scale-105 transition-transform"
                title={`Mazzo: ${gameState.deckCount} carte`}
              >
                <TabletopCard
                  imageSrc="/assets/ui/card_back.png"
                  fallbackText="Mazzo"
                  size="md"
                />
                <span className="absolute bottom-1 right-1 bg-black/85 text-amber-300 border border-amber-600 font-bold text-[10px] px-1.5 py-0.2 rounded shadow">
                  {gameState.deckCount}
                </span>
              </div>

              {/* Physical Play Zone where played cards land and sit */}
              <div
                id="table-play-zone"
                className="w-20 sm:w-24 h-28 sm:h-32 rounded-lg border border-dashed border-amber-600/30 flex items-center justify-center relative"
              />

              {/* Scarti (Discard Pile) */}
              <div id="table-discard-pile">
                {gameState.discardPileTop ? (
                  <div
                    className="cursor-pointer transform hover:scale-105 transition-transform"
                    onClick={() => setInspectCard(gameState.discardPileTop)}
                    title="Pila degli Scarti (clicca per ingrandire)"
                  >
                    <TabletopCard
                      imageSrc={`/assets/cards/${gameState.discardPileTop.templateId}.png`}
                      fallbackText={gameState.discardPileTop.name}
                      size="md"
                    />
                  </div>
                ) : (
                  <div
                    style={{ width: '80px', height: '114px' }}
                    className="rounded-md border-2 border-dashed border-slate-700/60 flex items-center justify-center text-slate-500 text-[10px]"
                  >
                    Scarti
                  </div>
                )}
              </div>
            </div>

            {/* Subtle event subtitle text under deck */}
            <div className="mt-2 text-[11px] text-slate-300 text-center max-w-md pointer-events-none drop-shadow space-y-0.5">
              {recentLogs.slice(-2).map((log) => (
                <div key={log.id} className="truncate">
                  <span className="text-amber-400 mr-1.5">•</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* EAST (Right Opponents) */}
          <div className="w-56 shrink-0 flex flex-col items-center justify-center gap-4">
            {rightOpponents.map((opponent) => {
              const dist = myPlayer ? calculateDistance(gameState.players, myPlayer.id, opponent.id) : 0;
              const diff = myPlayer ? calculateTargetDifficulty(gameState.players, myPlayer, opponent) : 0;
              const canTargetThis = isTargetValid(opponent);

              return (
                <OpponentTableArea
                  key={opponent.id}
                  player={opponent}
                  isCurrentTurn={gameState.turnPlayerId === opponent.id}
                  distanceFromMe={dist}
                  difficultyFromMe={diff}
                  isTargetable={canTargetThis}
                  onTargetSelect={() => handleDirectTargetClick(opponent.id)}
                  onInspectCard={(card) => setInspectCard(card)}
                  onInspectCharacter={(char) => setInspectCharacter(char)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM ZONE: Your Physical Cards on Table + Your Hand of Cards + Turn Action Controls */}
      <div className="flex items-end justify-between w-full max-w-7xl mx-auto px-4 pb-2 shrink-0">
        {/* Left: Your Character + Role + Hearts/Honor + In-Play Properties (Armatura, Concentrazione, etc.) */}
        {myPrivateState && (
          <div id="table-player-mat" className="flex items-center gap-3 shrink-0">
            {/* Character Card (Clickable to view full ability) */}
            <div
              onClick={() => {
                if (myPrivateState.character) setInspectCharacter(myPrivateState.character);
              }}
              className="flex flex-col items-center cursor-pointer group"
              title="Clicca per visualizzare l'abilità del personaggio"
            >
              <div className="relative">
                <TabletopCard
                  imageSrc={`/assets/characters/${myPrivateState.character?.id}.png`}
                  fallbackText={myPrivateState.character?.name || 'Personaggio'}
                  size="player"
                  isHoverable={true}
                />
                <div className="absolute top-1 right-1 bg-black/80 group-hover:bg-amber-500 group-hover:text-black text-amber-400 p-1 rounded-full shadow transition-colors">
                  <Sparkles className="w-2.5 h-2.5" />
                </div>
              </div>
              <span className="text-[11px] font-bold text-amber-300 mt-1 drop-shadow flex items-center gap-1">
                {myPrivateState.name} ({myPrivateState.character?.name})
              </span>
              <span className="text-[9px] text-amber-300/80 bg-black/60 px-1.5 py-0.2 rounded border border-amber-600/40 mt-0.5 max-w-[110px] truncate">
                ℹ️ {myPrivateState.character?.title}
              </span>
            </div>

            {/* Role Card */}
            <div className="flex flex-col items-center">
              <TabletopCard
                imageSrc={`/assets/roles/${myPrivateState.role.id}.png`}
                fallbackText={myPrivateState.role.name}
                size="player"
              />
              <span
                className="text-[11px] font-bold mt-1 drop-shadow flex items-center gap-1"
                style={{ color: myPrivateState.role.color }}
              >
                {myPrivateState.role.id === 'shogun' && <Crown className="w-3 h-3" />}
                {myPrivateState.role.name}
              </span>
            </div>

            {/* Tokens beside cards (Hearts & Honor) */}
            <div className="flex flex-col gap-1.5 ml-1">
              {/* Hearts (Vite) */}
              <div className="flex items-center gap-1">
                {myHearts.map((isFilled, idx) => (
                  <HeartToken key={idx} isFilled={isFilled} size="md" />
                ))}
              </div>

              {/* Honor (Fiori di Loto) */}
              <div className="flex items-center gap-1">
                {Array.from({ length: myPrivateState.honorPoints }).map((_, idx) => (
                  <HonorToken key={idx} size="md" />
                ))}
              </div>
            </div>

            {/* In-Play Equipped Properties on the table beside Character (Armatura, Bushido, etc.) */}
            {myPrivateState.propertiesInPlay.length > 0 && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-amber-600/30">
                {myPrivateState.propertiesInPlay.map((prop) => (
                  <div
                    key={prop.id}
                    onClick={() => setInspectCard(prop)}
                    className="flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                    title={`${prop.name}: Clicca per ingrandire`}
                  >
                    <TabletopCard
                      imageSrc={`/assets/cards/${prop.templateId}.png`}
                      fallbackText={prop.name}
                      size="player"
                    />
                    <span className="text-[10px] font-bold text-amber-400 mt-0.5 drop-shadow">
                      {prop.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Center: Your Hand of Cards with Drag and Drop */}
        {myPrivateState && (
          <div className="flex-1 flex justify-center px-2">
            <HandTray
              cards={myPrivateState.hand}
              isMyTurn={isPlayPhase}
              onCardClick={(card) => setInspectCard(card)}
            />
          </div>
        )}

        {/* Right: Pass Turn Button & Nobunaga Ability */}
        <div className="w-60 shrink-0 flex flex-col items-end justify-end gap-2 pb-2">
          {isMyTurn && (
            <span className="text-[11px] text-amber-300 font-bold bg-black/60 px-2.5 py-1 rounded border border-amber-500/30 shadow drop-shadow">
              Armi: {myPrivateState?.weaponsPlayedThisTurn || 0} / {myPrivateState?.maxWeaponsPerTurn || 1}
            </span>
          )}

          {myPrivateState?.character?.id === 'nobunaga' && isPlayPhase && (
            <button
              onClick={handleNobunagaAbility}
              disabled={myPrivateState.currentHp <= 1}
              className="py-1.5 px-3 rounded-lg bg-orange-950/80 hover:bg-orange-900 border border-orange-600 text-orange-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-lg"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Sacrifica 1 Vita per pescare
            </button>
          )}

          {isPlayPhase && (
            <button
              onClick={handleEndPlayPhase}
              className="py-2.5 px-6 rounded-xl font-title font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 active:scale-95 text-slate-950 shadow-xl shadow-amber-500/30 flex items-center gap-2 cursor-pointer transition-all border border-amber-300"
            >
              Passa Turno
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Character Ability Detail Modal */}
      {inspectCharacter && (
        <CharacterDetailModal
          character={inspectCharacter}
          onClose={() => setInspectCharacter(null)}
        />
      )}

      {/* Card Inspect Full-Screen Modal */}
      {inspectCard && (
        <CardInspectModal
          card={inspectCard}
          isPlayable={Boolean(isPlayPhase && myPrivateState?.hand.some((c) => c.id === inspectCard.id))}
          onPlay={handleInitiatePlay}
          onClose={() => setInspectCard(null)}
        />
      )}

      {/* Dominion-style Physical Card Animator: Flying cards & active play zone */}
      <TableCardAnimator
        lastPlayedCard={gameState.lastPlayedCard}
        turnPhase={gameState.turnPhase}
        turnPlayerId={gameState.turnPlayerId}
        myId={myId}
        opponentIds={opponentsOrdered.map(o => o.id)}
        onInspectCard={(card) => setInspectCard(card)}
      />

      {/* Reaction Modal (Parata, etc.) */}
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
