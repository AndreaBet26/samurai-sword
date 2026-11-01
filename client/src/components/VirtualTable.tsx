import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { CardDef, GameState, PlayerPrivateState, PlayerPublicState, CharacterDef } from '../../../shared/types';
import { calculateDistance, calculateTargetDifficulty, canAttackWithWeapon } from '../../../shared/rules';
import { soundManager } from '../utils/soundEffects';
import { OpponentTableArea } from './OpponentTableArea';
import { HandTray } from './HandTray';
import { PlayerField } from './PlayerField';
import { TabletopCard } from './TabletopCard';
import { HeartToken, HonorToken } from './WoodToken';
import { CharacterDetailModal } from './CharacterDetailModal';
import { TableCardAnimator } from './TableCardAnimator';
import { GameOverModal } from './GameOverModal';
import { RulesModal } from './RulesModal';
import { GameHistoryDrawer } from './GameHistoryDrawer';
import {
  Sword,
  BookOpen,
  Volume2,
  VolumeX,
  ArrowRight,
  Flame,
  X,
  Crown,
  Sparkles,
  ShieldAlert,
  HeartCrack,
  Trash2,
  History
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
  const [inspectCharacter, setInspectCharacter] = useState<CharacterDef | null>(null);
  const [activePlayCard, setActivePlayCard] = useState<CardDef | null>(null);
  const [previewCard, setPreviewCard] = useState<CardDef | null>(null);
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);
  const [slashAnimation, setSlashAnimation] = useState(false);
  const [hasInitialDealt, setHasInitialDealt] = useState(
    gameState.turnPhase !== 'dealing' && (myPrivateState?.hand?.length ?? 0) > 0
  );
  const [dealProgress, setDealProgress] = useState<{ current: number; total: number } | null>(null);
  const [dealCompleteBanner, setDealCompleteBanner] = useState(false);
  const [opponentDealtCounts, setOpponentDealtCounts] = useState<Record<string, number>>({});
  const [pendingDeckDraw, setPendingDeckDraw] = useState<{ type: string; count: number } | null>(null);
  const [displayedHand, setDisplayedHand] = useState<CardDef[]>([]);
  const [incomingDrawnCards, setIncomingDrawnCards] = useState<CardDef[]>([]);
  const [turnBanner, setTurnBanner] = useState<{ playerName: string; isMyTurn: boolean; characterName?: string } | null>(null);

  const knownHandIdsRef = useRef<Set<string>>(new Set());
  const lastTurnPlayerRef = useRef<string>('');

  const myId = myPrivateState?.id || '';
  const myPlayer = gameState.players.find(p => p.id === myId);
  const isMyTurn = gameState.turnPlayerId === myId;
  const isPlayPhase = isMyTurn && gameState.turnPhase === 'play';
  const isDiscardPhase = isMyTurn && gameState.turnPhase === 'discard';
  const isIeyasuDrawPhase = isMyTurn && gameState.turnPhase === 'draw' && myPrivateState?.character?.id === 'ieyasu';
  const turnPlayer = gameState.players.find(p => p.id === gameState.turnPlayerId);

  // Turn Change Banner Detection for smooth transitions
  useEffect(() => {
    if (gameState.status !== 'playing' || gameState.turnPhase === 'dealing') return;
    if (!gameState.turnPlayerId) return;

    if (gameState.turnPlayerId !== lastTurnPlayerRef.current) {
      lastTurnPlayerRef.current = gameState.turnPlayerId;
      const player = gameState.players.find(p => p.id === gameState.turnPlayerId);
      if (player) {
        setTurnBanner({
          playerName: player.name,
          isMyTurn: player.id === myId,
          characterName: player.character?.name
        });

        const timer = setTimeout(() => {
          setTurnBanner(null);
        }, 2200);

        return () => clearTimeout(timer);
      }
    }
  }, [gameState.turnPlayerId, gameState.status, gameState.turnPhase, myId]);

  // Under attack / pending reaction state
  const isUnderAttack = Boolean(
    gameState.pendingReaction && gameState.pendingReaction.pendingForPlayerId === myId
  );
  const reaction = gameState.pendingReaction;

  // Determine which cards in hand can parry/defend
  let eligibleReactionCardIds: string[] = [];
  if (isUnderAttack && reaction && myPrivateState) {
    if (reaction.type === 'parry_weapon') {
      let cards = myPrivateState.hand.filter(c => c.actionType === 'parry');
      if (myPrivateState.character?.id === 'hanzo' && myPrivateState.hand.length > 1) {
        cards = [...cards, ...myPrivateState.hand.filter(c => c.type === 'weapon')];
      }
      eligibleReactionCardIds = cards.map(c => c.id);
    } else if (reaction.type === 'battle_cry') {
      // Per Grido di Battaglia la regola impone esclusivamente lo scarto di una Parata (nessuna arma)
      eligibleReactionCardIds = myPrivateState.hand.filter(c => c.actionType === 'parry').map(c => c.id);
    } else if (reaction.type === 'jujutsu') {
      // Per Jiujitsu si deve scartare un'Arma
      eligibleReactionCardIds = myPrivateState.hand.filter(c => c.type === 'weapon').map(c => c.id);
    }
  }

  // Clear discard selection when phase changes
  useEffect(() => {
    if (!isDiscardPhase) {
      setSelectedDiscardIds([]);
    }
  }, [isDiscardPhase]);

  // Synchronize hand updates so newly drawn cards are delivered ONE BY ONE!
  useEffect(() => {
    if (!myPrivateState?.hand) return;

    if (!hasInitialDealt) {
      return;
    }

    const currentHand = myPrivateState.hand;
    const currentIds = new Set(currentHand.map(c => c.id));

    // 1. Detect removed cards (played or discarded) and update immediately
    const removedIds = new Set([...knownHandIdsRef.current].filter(id => !currentIds.has(id)));
    if (removedIds.size > 0) {
      setDisplayedHand(prev => prev.filter(c => !removedIds.has(c.id)));
      knownHandIdsRef.current = new Set([...knownHandIdsRef.current].filter(id => currentIds.has(id)));
    }

    // 2. Detect newly drawn cards and send them to the sequential one-by-one animator!
    const newCards = currentHand.filter(c => !knownHandIdsRef.current.has(c.id));
    if (newCards.length > 0) {
      newCards.forEach(c => knownHandIdsRef.current.add(c.id));
      setIncomingDrawnCards(newCards);
    }
  }, [myPrivateState?.hand, hasInitialDealt]);

  const handleOpponentCardDelivered = (opId: string) => {
    setOpponentDealtCounts(prev => ({
      ...prev,
      [opId]: (prev[opId] || 0) + 1
    }));
  };

  const handleInitialDealComplete = () => {
    setDealCompleteBanner(true);
    setDealProgress(null);

    setTimeout(() => {
      setHasInitialDealt(true);
      setDealCompleteBanner(false);
      if (myPrivateState?.hand) {
        setDisplayedHand(myPrivateState.hand);
        knownHandIdsRef.current = new Set(myPrivateState.hand.map(c => c.id));
      }
      socket.emit('initial_deal_complete');
    }, 1500);
  };

  const handleCardDeliveredToHand = (card: CardDef) => {
    setDisplayedHand(prev => {
      if (prev.some(c => c.id === card.id)) return prev;
      return [...prev, card];
    });
  };

  const handleAllDrawnDelivered = () => {
    setIncomingDrawnCards([]);
    if (myPrivateState?.hand) {
      setDisplayedHand(myPrivateState.hand);
      knownHandIdsRef.current = new Set(myPrivateState.hand.map(c => c.id));
    }
  };

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

  // Distribute opponents around table: West (Left), North (Top), East (Right)
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

  // Click on a card in hand: preview it enlarged first so player can read effect and choose whether to play!
  const handleCardClick = (card: CardDef) => {
    // 1. If under attack: direct instant parry without opening any modal/sheet!
    if (isUnderAttack) {
      if (eligibleReactionCardIds.includes(card.id)) {
        handleReaction(card.id);
        return;
      }
    }

    // In discard phase, toggle discard selection on the card (Hand limit: 7 cards)
    if (isDiscardPhase && myPrivateState && myPrivateState.hand.length > 7) {
      const excess = myPrivateState.hand.length - 7;
      if (selectedDiscardIds.includes(card.id)) {
        setSelectedDiscardIds(prev => prev.filter(id => id !== card.id));
      } else if (selectedDiscardIds.length < excess) {
        setSelectedDiscardIds(prev => [...prev, card.id]);
      }
      return;
    }

    // Open card preview directly (displays the physical card enlarged to read the effect)
    soundManager.playCardSlide();
    setPreviewCard(card);
  };

  // Confirm play from the card preview
  const handleConfirmPlay = (card: CardDef) => {
    setPreviewCard(null);

    // 1. If under attack and card is eligible defense
    if (isUnderAttack) {
      if (eligibleReactionCardIds.includes(card.id)) {
        handleReaction(card.id);
      }
      return;
    }

    // 2. Play phase actions
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
        // Direct play property: animates straight to player's field in front of hand!
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
    setPreviewCard(null);
    socket.emit('end_play_phase');
  };

  const handleReaction = (cardId: string | null) => {
    if (cardId) soundManager.playParryClash();
    else soundManager.playTaiko();
    socket.emit('submit_reaction', { responseCardId: cardId });
  };

  const handleDiscardConfirm = () => {
    soundManager.playCardSlide();
    socket.emit('discard_excess', { cardIds: selectedDiscardIds });
    setSelectedDiscardIds([]);
  };

  // Nobunaga: arm the deck draw so player clicks the deck to draw!
  const handleNobunagaAbilityClick = () => {
    if (myPrivateState?.currentHp && myPrivateState.currentHp <= 1) return;
    soundManager.playTaiko();
    setPendingDeckDraw({ type: 'nobunaga', count: 1 });
  };

  // INTERACTIVE DECK DRAW: Click the deck to draw cards into your hand!
  const handleDeckClick = () => {
    // 1. Nobunaga manual draw
    if (pendingDeckDraw?.type === 'nobunaga') {
      soundManager.playCardSlide();
      socket.emit('use_nobunaga');
      setPendingDeckDraw(null);
      return;
    }

    // 2. Ieyasu draw from deck
    if (isIeyasuDrawPhase) {
      soundManager.playCardSlide();
      socket.emit('draw_ieyasu', { fromDiscard: false });
      return;
    }
  };

  // Ieyasu draw from discard pile
  const handleDiscardPileClick = () => {
    if (isIeyasuDrawPhase) {
      soundManager.playCardSlide();
      socket.emit('draw_ieyasu', { fromDiscard: true });
    } else if (gameState.discardPileTop) {
      setPreviewCard(gameState.discardPileTop);
    }
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

  // Determine playability of the currently previewed card
  const isPreviewInMyHand = Boolean(myPrivateState?.hand.some(c => c.id === previewCard?.id));
  let canPlayPreviewCard = false;
  let playButtonLabel = 'Gioca Carta';
  let playButtonIcon = '🎴';

  if (previewCard && isPreviewInMyHand) {
    if (isUnderAttack) {
      if (eligibleReactionCardIds.includes(previewCard.id)) {
        canPlayPreviewCard = true;
        playButtonLabel = 'Usa per Parare';
        playButtonIcon = '🛡️';
      }
    } else if (isPlayPhase) {
      if (previewCard.type === 'weapon') {
        const weaponsPlayed = myPrivateState?.weaponsPlayedThisTurn || 0;
        const maxWeapons = myPrivateState?.maxWeaponsPerTurn || 1;
        if (weaponsPlayed < maxWeapons) {
          canPlayPreviewCard = true;
          playButtonLabel = 'Scegli Bersaglio';
          playButtonIcon = '⚔️';
        }
      } else if (previewCard.type === 'property') {
        canPlayPreviewCard = true;
        playButtonLabel = previewCard.propertyType === 'bushido' ? 'Piazza Bushido' : 'Equipaggia Terreno';
        playButtonIcon = '🛡️';
      } else if (previewCard.type === 'action') {
        canPlayPreviewCard = true;
        playButtonLabel = 'Attiva Azione';
        playButtonIcon = '⚡';
      }
    }
  }

  // My hearts array
  const myHearts = [];
  if (myPrivateState) {
    for (let i = 0; i < myPrivateState.maxHp; i++) {
      myHearts.push(i < myPrivateState.currentHp);
    }
  }

  // Excess cards for discard (Official Samurai Sword rule: hand limit is 7)
  const excessDiscardCount = myPrivateState ? Math.max(0, myPrivateState.hand.length - 7) : 0;

  // Deck glows when a draw is pending or ready
  const isDeckReadyToDraw = Boolean(
    pendingDeckDraw ||
    isIeyasuDrawPhase
  );

  // Recent logs
  const recentLogs = gameState.logs.slice(-2);

  // Visible hand: durante la distribuzione iniziale o mentre le carte stanno atterrando,
  // mostra displayedHand per farle comparire una ad una. A distribuzione completata si sincronizza con myPrivateState.hand!
  const visibleCardsForTray = (!hasInitialDealt || incomingDrawnCards.length > 0)
    ? displayedHand
    : (myPrivateState?.hand || []);

  return (
    <div
      className="h-screen w-screen overflow-hidden select-none relative flex flex-col justify-between"
      style={{
        backgroundImage: 'linear-gradient(to bottom, rgba(5, 10, 20, 0.62), rgba(8, 14, 25, 0.75)), url(/assets/ui/table_background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: '10px solid #1c1109' // Wooden table border
      }}
    >
      {/* Dynamic Sword Slash Animation Overlay */}
      {slashAnimation && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center animate-slash">
          <div className="w-[120vw] h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent rotate-[-25deg] shadow-[0_0_35px_#ef4444]" />
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex items-center justify-between z-20 text-xs px-6 pt-2 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-title font-black text-amber-400 text-sm tracking-wider drop-shadow">
            SAMURAI SWORD
          </span>
          <span className="text-slate-400 font-mono text-[11px] drop-shadow">
            Stanza: {gameState.roomCode}
          </span>
        </div>

        {/* Turn Status Indicator */}
        <div className="flex items-center gap-2 bg-black/60 px-4 py-1.5 rounded-full border border-amber-600/50 backdrop-blur-sm shadow-md transition-all">
          <span className={`w-2.5 h-2.5 rounded-full ${gameState.turnPhase === 'dealing' ? 'bg-amber-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
          <span className="text-slate-200 text-xs font-semibold">
            {gameState.turnPhase === 'dealing' ? (
              <span className="text-amber-300 font-bold">Distribuzione Carte in corso...</span>
            ) : (
              <>
                Turno: <strong className="text-amber-300">{turnPlayer?.name || '...'}</strong>
                {isMyTurn && ' (Tocca a te!)'}
                <span className="text-slate-400 ml-1.5 font-normal">
                  ({gameState.turnPhase === 'recover' ? 'Recupero' : gameState.turnPhase === 'draw' ? 'Pesca' : gameState.turnPhase === 'play' ? 'Azione' : gameState.turnPhase === 'discard' ? 'Scarto' : 'Attesa'})
                </span>
              </>
            )}
          </span>
        </div>

        {/* Audio Toggle, Cronologia & Rules */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(true)}
            className="text-slate-300 hover:text-amber-400 flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer bg-black/40 hover:bg-black/70 px-2.5 py-1 rounded-full border border-slate-700/80 shadow"
            title="Apri cronologia carte giocate e attacchi"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Cronologia</span>
            {gameState.logs.length > 0 && (
              <span className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full">
                {gameState.logs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="text-slate-300 hover:text-amber-400 flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Regole
          </button>
          <button
            onClick={toggleSound}
            className="text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
            title={isMuted ? 'Attiva Audio' : 'Disattiva Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* MAIN TABLE FELT: Full-bleed width across monitor with generous breathing room */}
      <div className="flex-1 flex flex-col justify-between w-full min-h-0 relative px-6 sm:px-10">
        {/* NORTH (Top Opponents) */}
        <div className="flex items-start justify-center gap-10 sm:gap-16 pt-1 shrink-0 min-h-[160px]">
          {topOpponents.map((opponent) => {
            const dist = myPlayer ? calculateDistance(gameState.players, myPlayer.id, opponent.id) : 0;
            const diff = myPlayer ? calculateTargetDifficulty(gameState.players, myPlayer, opponent) : 0;
            const canTargetThis = isTargetValid(opponent);
            const liveHandCount = hasInitialDealt ? opponent.handCount : (opponentDealtCounts[opponent.id] ?? 0);
            const opponentWithLiveHand = {
              ...opponent,
              handCount: liveHandCount,
              isHarmless: liveHandCount === 0
            };

            return (
              <OpponentTableArea
                key={opponent.id}
                player={opponentWithLiveHand}
                orientation="horizontal"
                isCurrentTurn={gameState.turnPlayerId === opponent.id}
                distanceFromMe={dist}
                difficultyFromMe={diff}
                isTargetable={canTargetThis}
                onTargetSelect={() => handleDirectTargetClick(opponent.id)}
                onInspectCard={(card) => setPreviewCard(card)}
                onInspectCharacter={(char) => setInspectCharacter(char)}
              />
            );
          })}
        </div>

        {/* MIDDLE FELT: Left Opponents <---> Center Deck, Play Zone & Discards <---> Right Opponents */}
        <div className="flex items-center justify-between w-full flex-1 px-4 my-auto">
          {/* WEST (Left Opponents) */}
          <div className="w-64 sm:w-80 shrink-0 flex flex-col items-center justify-center gap-5">
            {leftOpponents.map((opponent) => {
              const dist = myPlayer ? calculateDistance(gameState.players, myPlayer.id, opponent.id) : 0;
              const diff = myPlayer ? calculateTargetDifficulty(gameState.players, myPlayer, opponent) : 0;
              const canTargetThis = isTargetValid(opponent);
              const liveHandCount = hasInitialDealt ? opponent.handCount : (opponentDealtCounts[opponent.id] ?? 0);
              const opponentWithLiveHand = {
                ...opponent,
                handCount: liveHandCount,
                isHarmless: liveHandCount === 0
              };

              return (
                <OpponentTableArea
                  key={opponent.id}
                  player={opponentWithLiveHand}
                  orientation="vertical"
                  isCurrentTurn={gameState.turnPlayerId === opponent.id}
                  distanceFromMe={dist}
                  difficultyFromMe={diff}
                  isTargetable={canTargetThis}
                  onTargetSelect={() => handleDirectTargetClick(opponent.id)}
                  onInspectCard={(card) => setPreviewCard(card)}
                  onInspectCharacter={(char) => setInspectCharacter(char)}
                />
              );
            })}
          </div>

          {/* TABLE CENTER: Mazzo, Play Zone, Scarti with large generous cards */}
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="flex items-center gap-8 sm:gap-12">
              {/* Mazzo (Draw Deck) - Interactive clickable deck! */}
              <div
                id="table-deck-pile"
                onClick={handleDeckClick}
                className={`relative transition-all duration-200 cursor-pointer ${
                  isDeckReadyToDraw
                    ? 'scale-108 ring-4 ring-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.9)] animate-pulse'
                    : 'hover:scale-105'
                }`}
                title={`Mazzo: ${gameState.deckCount} carte`}
              >
                <TabletopCard
                  imageSrc="/assets/ui/card_back.png"
                  fallbackText="Mazzo"
                  size="md"
                />
                <span className="absolute bottom-1 right-1 bg-black/85 text-amber-300 border border-amber-600 font-bold text-xs px-2 py-0.5 rounded shadow">
                  {gameState.deckCount}
                </span>
              </div>

              {/* Physical Play Zone where played cards land and sit */}
              <div
                id="table-play-zone"
                className="w-28 sm:w-32 h-36 sm:h-44 rounded-xl border-2 border-dashed border-amber-600/40 flex items-center justify-center relative"
              />

              {/* Scarti (Discard Pile) */}
              <div
                id="table-discard-pile"
                onClick={handleDiscardPileClick}
                className={`transition-all duration-200 cursor-pointer ${
                  isIeyasuDrawPhase
                    ? 'scale-108 ring-4 ring-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.9)] animate-pulse'
                    : 'hover:scale-105'
                }`}
              >
                {isIeyasuDrawPhase && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full shadow-xl animate-bounce whitespace-nowrap flex items-center gap-1 border border-amber-200 z-30">
                    Pesca da Scarti
                  </div>
                )}

                {gameState.discardPileTop ? (
                  <div
                    className="transform rotate-2 hover:rotate-0 transition-transform cursor-pointer"
                    title="Pila degli Scarti (clicca per visualizzare)"
                  >
                    <TabletopCard
                      imageSrc={`/assets/cards/${gameState.discardPileTop.templateId}.png`}
                      fallbackText={gameState.discardPileTop.name}
                      size="md"
                    />
                  </div>
                ) : (
                  <div
                    style={{ width: '104px', height: '148px' }}
                    className="rounded-lg border-2 border-dashed border-slate-700/70 flex items-center justify-center text-slate-500 text-xs font-bold"
                  >
                    Scarti
                  </div>
                )}
              </div>
            </div>

            {/* Subtle event subtitle text under deck */}
            <div className="mt-3 text-xs text-slate-300 text-center max-w-lg pointer-events-none drop-shadow space-y-0.5">
              {recentLogs.slice(-2).map((log) => (
                <div key={log.id} className="truncate">
                  <span className="text-amber-400 mr-1.5">•</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* EAST (Right Opponents) */}
          <div className="w-64 sm:w-80 shrink-0 flex flex-col items-center justify-center gap-5">
            {rightOpponents.map((opponent) => {
              const dist = myPlayer ? calculateDistance(gameState.players, myPlayer.id, opponent.id) : 0;
              const diff = myPlayer ? calculateTargetDifficulty(gameState.players, myPlayer, opponent) : 0;
              const canTargetThis = isTargetValid(opponent);
              const liveHandCount = hasInitialDealt ? opponent.handCount : (opponentDealtCounts[opponent.id] ?? 0);
              const opponentWithLiveHand = {
                ...opponent,
                handCount: liveHandCount,
                isHarmless: liveHandCount === 0
              };

              return (
                <OpponentTableArea
                  key={opponent.id}
                  player={opponentWithLiveHand}
                  orientation="vertical"
                  isCurrentTurn={gameState.turnPlayerId === opponent.id}
                  distanceFromMe={dist}
                  difficultyFromMe={diff}
                  isTargetable={canTargetThis}
                  onTargetSelect={() => handleDirectTargetClick(opponent.id)}
                  onInspectCard={(card) => setPreviewCard(card)}
                  onInspectCharacter={(char) => setInspectCharacter(char)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM COCKPIT: Full width across screen with large prominent cards */}
      <div className="w-full px-6 sm:px-10 pb-2 shrink-0 flex flex-col items-center select-none relative z-30">
        {/* COMPACT & CLEAN DEFENSE PROMPT */}
        {isUnderAttack && reaction && (
          <div className="mb-2 flex items-center justify-center gap-3 bg-red-950/95 border border-red-500/80 px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-md animate-fadeIn">
            <span className="text-xs font-bold text-red-200 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
              {reaction.type === 'battle_cry' ? (
                <>📢 <strong className="text-amber-300">Grido di Battaglia!</strong> Scarta una <strong className="text-emerald-300">Parata</strong> per difenderti:</>
              ) : reaction.type === 'jujutsu' ? (
                <>🥋 <strong className="text-amber-300">Jiujitsu!</strong> Scarta un'<strong className="text-amber-300">Arma</strong> per neutralizzarlo:</>
              ) : (
                <>⚔️ Attacco con <strong className="text-amber-300">{reaction.weaponCard?.name || "un'Arma"}</strong> (-{reaction.damage || 1} ❤️):</>
              )}
            </span>

            <button
              onClick={() => handleReaction(null)}
              className="bg-red-800 hover:bg-red-700 text-white font-black text-xs px-3.5 py-1 rounded-full border border-red-400 shadow flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 active:scale-95"
              title="Subisci il colpo e perdi punti vita"
            >
              <HeartCrack className="w-3.5 h-3.5 text-red-200" />
              <span>Subisci (-{reaction.damage || 1} ❤️)</span>
            </button>
          </div>
        )}

        {/* TARGETING ACTIVE: Clean discreet cancel button */}
        {activePlayCard && !isUnderAttack && (
          <div className="mb-2 flex items-center justify-center">
            <button
              onClick={() => setActivePlayCard(null)}
              className="text-xs font-bold text-slate-200 hover:text-white bg-black/80 hover:bg-black px-4 py-1.5 rounded-full border border-slate-600 flex items-center gap-1.5 cursor-pointer shadow-lg transition-all"
            >
              <X className="w-3.5 h-3.5 text-amber-400" />
              <span>Annulla {activePlayCard.name}</span>
            </button>
          </div>
        )}

        {/* DISCARD EXCESS CARDS: Clean compact button */}
        {isDiscardPhase && excessDiscardCount > 0 && !isUnderAttack && (
          <div className="mb-2 flex items-center justify-center">
            <button
              onClick={handleDiscardConfirm}
              disabled={selectedDiscardIds.length !== excessDiscardCount}
              className={`py-1.5 px-5 rounded-full font-black text-xs border shadow-xl flex items-center gap-1.5 transition-all ${
                selectedDiscardIds.length === excessDiscardCount
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 cursor-pointer shadow-amber-500/30 scale-105'
                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Scarta ({selectedDiscardIds.length}/{excessDiscardCount})</span>
            </button>
          </div>
        )}

        {/* CARTE TERRENO (PROPRIETA' IN GIOCO): Posizionate DIRETTAMENTE DAVANTI alla mano sul tavolo! */}
        {myPrivateState && myPrivateState.propertiesInPlay.length > 0 && (
          <div className="w-full flex justify-center mb-1">
            <PlayerField
              properties={myPrivateState.propertiesInPlay}
              onInspectCard={(card) => setPreviewCard(card)}
            />
          </div>
        )}

        {/* BOTTOM ROW: Player Mat (Left) | Hand Dock (Center) | Controls (Right) */}
        <div className="flex items-end justify-between w-full gap-4">
          {/* Left: Player Mat (Character + Role + Hearts + Honor) with larger 112x159px cards */}
          {myPrivateState && (
            <div id="table-player-mat" className="flex items-center gap-3.5 shrink-0">
              {/* Character Card */}
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
                  <div className="absolute top-1.5 right-1.5 bg-black/80 group-hover:bg-amber-500 group-hover:text-black text-amber-400 p-1.5 rounded-full shadow transition-colors">
                    <Sparkles className="w-3 h-3" />
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-300 mt-1 drop-shadow flex items-center gap-1">
                  {myPrivateState.name}
                </span>
                <span className="text-[10px] text-amber-300/80 bg-black/60 px-2 py-0.5 rounded border border-amber-600/40 mt-0.5 max-w-[120px] truncate">
                  {myPrivateState.character?.name}
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
                  className="text-xs font-bold mt-1 drop-shadow flex items-center gap-1"
                  style={{ color: myPrivateState.role.color }}
                >
                  {myPrivateState.role.id === 'shogun' && <Crown className="w-3.5 h-3.5" />}
                  {myPrivateState.role.name}
                </span>
              </div>

              {/* Wooden Tokens (Hearts & Honor) */}
              <div className="flex flex-col gap-2 ml-1">
                <div className="flex items-center gap-1">
                  {myHearts.map((isFilled, idx) => (
                    <HeartToken key={idx} isFilled={isFilled} size="md" />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: myPrivateState.honorPoints }).map((_, idx) => (
                    <HonorToken key={idx} size="md" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Center: Hand of Cards with large 136x193px cards */}
          {myPrivateState && (
            <div className="flex-1 flex justify-center px-2">
              <HandTray
                cards={visibleCardsForTray}
                isMyTurn={isPlayPhase}
                isUnderAttack={isUnderAttack}
                eligibleReactionCardIds={eligibleReactionCardIds}
                isDiscardPhase={isDiscardPhase}
                selectedDiscardIds={selectedDiscardIds}
                selectedCardId={previewCard?.id || activePlayCard?.id}
                onCardClick={handleCardClick}
              />
            </div>
          )}

          {/* Right: Pass Turn Button & Ability */}
          <div className="w-64 shrink-0 flex flex-col items-end justify-end gap-2.5 pb-1">
            {isMyTurn && (
              <span className="text-xs text-amber-300 font-bold bg-black/60 px-3 py-1 rounded-lg border border-amber-500/30 shadow drop-shadow">
                Armi: {myPrivateState?.weaponsPlayedThisTurn || 0} / {myPrivateState?.maxWeaponsPerTurn || 1}
              </span>
            )}

            {/* Nobunaga Ability Button */}
            {myPrivateState?.character?.id === 'nobunaga' && isPlayPhase && (
              <button
                onClick={handleNobunagaAbilityClick}
                disabled={myPrivateState.currentHp <= 1}
                className="py-2 px-4 rounded-xl bg-orange-950/90 hover:bg-orange-900 border border-orange-500 text-orange-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-lg hover:scale-105"
              >
                <Flame className="w-4 h-4 text-orange-400" />
                Sacrifica 1 Vita per pescare
              </button>
            )}

            {isPlayPhase && (
              <button
                onClick={handleEndPlayPhase}
                className="py-3 px-7 rounded-xl font-title font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 active:scale-95 text-slate-950 shadow-xl shadow-amber-500/30 flex items-center gap-2 cursor-pointer transition-all border border-amber-300"
              >
                Passa Turno
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FLOATING CARD PREVIEW (NO SCHEDE: VISUALIZZA LA CARTA FISICA INGRANDITA + PULSANTI GIOCA / ANNULLA) */}
      {previewCard && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs select-none animate-fadeIn pointer-events-auto"
          onClick={() => setPreviewCard(null)}
        >
          <div
            className="flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Visualizzazione ingrandita ad alta risoluzione della carta stessa (310x440px) */}
            <div className="rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] border-2 border-amber-500/80 transform hover:scale-102 transition-transform">
              <TabletopCard
                imageSrc={`/assets/cards/${previewCard.templateId}.png`}
                fallbackText={previewCard.name}
                size="zoom"
              />
            </div>

            {/* Pulsanti d'azione diretti sotto la carta */}
            <div className="flex items-center gap-3">
              {canPlayPreviewCard ? (
                <button
                  onClick={() => handleConfirmPlay(previewCard)}
                  className="py-2.5 px-6 rounded-xl font-title font-black text-sm uppercase tracking-wider bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:brightness-110 active:scale-95 text-slate-950 shadow-xl shadow-emerald-500/35 border border-emerald-300 cursor-pointer flex items-center gap-2 transition-all"
                >
                  <span>{playButtonIcon}</span>
                  <span>{playButtonLabel}</span>
                </button>
              ) : (
                isPreviewInMyHand && (
                  <div className="py-2 px-4 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-slate-400 font-semibold">
                    Non giocabile in questo momento
                  </div>
                )
              )}

              <button
                onClick={() => setPreviewCard(null)}
                className="py-2.5 px-5 rounded-xl font-title font-bold text-sm bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Character Ability Detail Modal */}
      {inspectCharacter && (
        <CharacterDetailModal
          character={inspectCharacter}
          onClose={() => setInspectCharacter(null)}
        />
      )}

      {/* TURN CHANGE BANNER (ANIMAZIONE FLUIDA AL CAMBIO TURNO) */}
      {turnBanner && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-60 animate-fadeIn pointer-events-none">
          <div
            className={`px-8 py-3 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.9)] border-2 backdrop-blur-xl flex flex-col items-center justify-center transition-all ${
              turnBanner.isMyTurn
                ? 'bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-amber-400 text-amber-300'
                : 'bg-slate-900/95 border-slate-600 text-slate-100'
            }`}
          >
            <span className="font-title text-base sm:text-lg font-black tracking-wider flex items-center gap-2">
              {turnBanner.isMyTurn ? (
                <>
                  <Sword className="w-5 h-5 text-amber-400 animate-bounce" />
                  <span>È IL TUO TURNO!</span>
                  <Sword className="w-5 h-5 text-amber-400 animate-bounce" />
                </>
              ) : (
                <>
                  <span>Turno di {turnBanner.playerName}</span>
                </>
              )}
            </span>
            <span className="text-[11px] text-slate-300 font-semibold mt-0.5">
              {turnBanner.isMyTurn ? 'Fase di Recupero & Pesca' : turnBanner.characterName || 'Guerriero al Tavolo'}
            </span>
          </div>
        </div>
      )}

      {/* INITIAL DEALING PROGRESS BANNER */}
      {gameState.turnPhase === 'dealing' && !hasInitialDealt && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-60 animate-fadeIn pointer-events-none">
          <div className="bg-slate-950/95 border-2 border-amber-500/90 text-amber-200 px-7 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-xl flex flex-col items-center">
            <span className="font-title text-sm font-black flex items-center gap-2 text-amber-300">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
              Distribuzione delle Carte a Tutti i Guerrieri
            </span>
            {dealProgress && (
              <span className="text-xs text-slate-300 mt-1 font-mono">
                Carta {dealProgress.current} di {dealProgress.total}
              </span>
            )}
          </div>
        </div>
      )}

      {/* DEAL COMPLETE CELEBRATION BANNER */}
      {dealCompleteBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-60 animate-fadeIn pointer-events-none">
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-2 border-amber-400 text-amber-200 px-9 py-4 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-xl flex flex-col items-center">
            <span className="font-title text-base font-black text-amber-300 flex items-center gap-2">
              ⚔️ Tutte le carte sono state distribuite a tutti! ⚔️
            </span>
            <span className="text-xs text-slate-200 mt-1 font-medium">
              Il tavolo è pronto: la Via della Spada ha inizio!
            </span>
          </div>
        </div>
      )}

      {/* Animated Physical Cards on Table (Dealing, Attacking, Properties, Flying Cards ONE BY ONE) */}
      <TableCardAnimator
        lastPlayedCard={gameState.lastPlayedCard}
        turnPhase={gameState.turnPhase}
        turnPlayerId={gameState.turnPlayerId}
        myId={myId}
        turnOrder={gameState.turnOrder}
        opponentIds={opponentsOrdered.map(o => o.id)}
        isInitialDealing={!hasInitialDealt}
        initialHandCards={myPrivateState?.hand || []}
        incomingDrawnCards={incomingDrawnCards}
        onCardDeliveredToHand={handleCardDeliveredToHand}
        onOpponentCardDelivered={handleOpponentCardDelivered}
        onAllDrawnCardsDelivered={handleAllDrawnDelivered}
        onInitialDealProgress={(curr, tot) => setDealProgress({ current: curr, total: tot })}
        onInitialDealComplete={handleInitialDealComplete}
      />

      {/* Game Over Modal */}
      {gameState.status === 'game_over' && (
        <GameOverModal gameState={gameState} onPlayAgain={onReturnToLobby} />
      )}

      {/* Rules Modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* Game History Drawer on the right */}
      <GameHistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        logs={gameState.logs}
        players={gameState.players}
        myId={myId}
        onInspectCard={(card) => setPreviewCard(card)}
      />
    </div>
  );
};
