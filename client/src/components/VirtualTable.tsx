import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { CardDef, GameState, PlayerPrivateState, PlayerPublicState, CharacterDef } from '../../../shared/types';
import { calculateAttackDamage, calculateDistance, calculateTargetDifficulty, canAttackWithWeapon } from '../../../shared/rules';
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
import { EffectsLayer } from './EffectsLayer';
import { TokenPile } from './TokenPile';
import { HiddenCardPicker } from './HiddenCardPicker';
import { STAGE_W, STAGE_H, TABLE_CENTER, computeSeats, setTableScale, setAnimRate, getAnimRate, type SeatGeometry } from '../utils/tableLayout';
import {
  Sword,
  BookOpen,
  Volume2,
  VolumeX,
  ArrowRight,
  AlertTriangle,
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
  // Diversione / Geisha in attesa della scelta della carta
  const [handPick, setHandPick] = useState<{ card: CardDef; targetId: string } | null>(null);
  const pickTarget = handPick ? gameState.players.find(p => p.id === handPick.targetId) ?? null : null;

  // Trascinamento di una carta dalla mano verso il tavolo
  const [draggingCard, setDraggingCard] = useState<CardDef | null>(null);
  const [dragHoverPlayerId, setDragHoverPlayerId] = useState<string | null>(null);
  // Breve suggerimento mostrato al centro del tavolo (es. "Non è il tuo turno")
  const [tableHint, setTableHint] = useState<string | null>(null);
  // Spiegazione mostrata passando sopra una carta che ora non puoi giocare
  const [hoverHint, setHoverHint] = useState<string | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cima degli scarti mostrata: se la carta è appena stata giocata, compare negli scarti solo quando
  // ci arriva davvero (prima viene mostrata al centro), così non si vede due volte.
  const [shownDiscardTop, setShownDiscardTop] = useState<CardDef | null>(gameState.discardPileTop);
  const discardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const top = gameState.discardPileTop;
    if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
    const justPlayed = top && gameState.lastPlayedCard?.card.id === top.id && top.type !== 'property';
    if (justPlayed) {
      discardTimerRef.current = setTimeout(() => setShownDiscardTop(top), 2200 / getAnimRate());
    } else {
      setShownDiscardTop(top);
    }
    return () => {
      if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
    };
  }, [gameState.discardPileTop?.id]);
  const showHint = (text: string) => {
    setTableHint(text);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setTableHint(null), 2600);
  };
  // Ritarda la schermata finale per lasciare spazio all'animazione "決着"
  const [showGameOver, setShowGameOver] = useState(gameState.status === 'game_over');
  useEffect(() => {
    if (gameState.status !== 'game_over') {
      setShowGameOver(false);
      return;
    }
    const t = setTimeout(() => setShowGameOver(true), 2600);
    return () => clearTimeout(t);
  }, [gameState.status]);
  // Se la partita è già oltre la distribuzione (es. rientro dopo un refresh) non si rifà l'animazione
  const [hasInitialDealt, setHasInitialDealt] = useState(gameState.turnPhase !== 'dealing');
  const [dealProgress, setDealProgress] = useState<{ current: number; total: number } | null>(null);
  const [dealCompleteBanner, setDealCompleteBanner] = useState(false);
  const [opponentDealtCounts, setOpponentDealtCounts] = useState<Record<string, number>>({});
  const [pendingDeckDraw, setPendingDeckDraw] = useState<{ type: string; count: number } | null>(null);
  const [displayedHand, setDisplayedHand] = useState<CardDef[]>(() =>
    gameState.turnPhase !== 'dealing' ? myPrivateState?.hand ?? [] : []
  );
  const [incomingDrawnCards, setIncomingDrawnCards] = useState<CardDef[]>([]);
  const [turnBanner, setTurnBanner] = useState<{ playerName: string; isMyTurn: boolean; characterName?: string } | null>(null);

  const knownHandIdsRef = useRef<Set<string>>(
    new Set(gameState.turnPhase !== 'dealing' ? (myPrivateState?.hand ?? []).map(c => c.id) : [])
  );
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
      // Il banner compare solo quando tocca a te (il turno degli altri è già indicato in alto e dall'alone)
      if (player && player.id === myId) {
        soundManager.play('yourTurn');
        setTurnBanner({
          playerName: player.name,
          isMyTurn: player.id === myId,
          characterName: player.character?.name
        });

        // (la chiusura del banner è gestita dall'effetto qui sotto: non deve dipendere dai cambi di fase)
      }
    }
  }, [gameState.turnPlayerId, gameState.status, gameState.turnPhase, myId]);

  // Il banner "È il tuo turno" sparisce sempre dopo 2,2 secondi
  useEffect(() => {
    if (!turnBanner) return;
    const t = setTimeout(() => setTurnBanner(null), 2200);
    return () => clearTimeout(t);
  }, [turnBanner]);

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
      // Grido di Battaglia: serve una Parata; Hanzō può usare un'Arma (se non è la sua unica carta)
      let cards = myPrivateState.hand.filter(c => c.actionType === 'parry');
      if (myPrivateState.character?.id === 'hanzo' && myPrivateState.hand.length > 1) {
        cards = [...cards, ...myPrivateState.hand.filter(c => c.type === 'weapon')];
      }
      eligibleReactionCardIds = cards.map(c => c.id);
    } else if (reaction.type === 'bushido') {
      // Bushido: scarta un'Arma per passarlo a sinistra, altrimenti perdi 1 Onore
      eligibleReactionCardIds = myPrivateState.hand.filter(c => c.type === 'weapon').map(c => c.id);
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
  // Posti attorno al tavolo rotondo, nell'ordine di turno (il prossimo giocatore è alla tua sinistra)
  const seats = computeSeats(opponentsOrdered.length);

  // Scala della scena: il tavolo 1920×1080 viene adattato allo schermo
  const computeScale = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const [stageScale, setStageScale] = useState(() => computeScale());
  useEffect(() => {
    const onResize = () => setStageScale(computeScale());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  setTableScale(stageScale);
  setAnimRate(gameState.settings?.animSpeed === 'fast' ? 1.7 : 1);

  // Attack / Damage sound effects & Slash animation
  useEffect(() => {
    if (gameState.logs.length > 0) {
      const lastLog = gameState.logs[gameState.logs.length - 1];
      if (lastLog.type === 'attack') {
        soundManager.play('swordDraw'); // il colpo (o la parata) suona quando arriva sul bersaglio
      }
      // I suoni di danni, abbattimenti e Onore li gestisce EffectsLayer, sincronizzati con le animazioni
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
        showHint('Hai già giocato tutte le armi consentite in questo turno');
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
        soundManager.play('cardPlace');
        socket.emit('play_action', { cardId: card.id });
      }
    }
  };

  /** Gioca una carta con bersaglio. Diversione e Geisha aprono prima la scelta della carta. */
  const playOnTarget = (card: CardDef, targetPlayerId: string) => {
    if (card.actionType === 'diversion' || card.actionType === 'geisha') {
      setHandPick({ card, targetId: targetPlayerId });
      setActivePlayCard(null);
      return;
    }
    if (card.type === 'weapon') {
      socket.emit('attack_with_weapon', { weaponCardId: card.id, targetId: targetPlayerId });
    } else {
      soundManager.play('cardPlace');
      socket.emit('play_action', { cardId: card.id, targetPlayerId });
    }
    setActivePlayCard(null);
  };

  const handleDirectTargetClick = (targetPlayerId: string) => {
    if (!activePlayCard) return;
    playOnTarget(activePlayCard, targetPlayerId);
  };

  const handleEndPlayPhase = () => {
    soundManager.playCardSlide();
    setActivePlayCard(null);
    setPreviewCard(null);
    socket.emit('end_play_phase');
  };

  const handleReaction = (cardId: string | null) => {
    // Il suono della parata o della ferita arriva con l'animazione sul tavolo
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
    soundManager.play('cardPlace');
    setPendingDeckDraw({ type: 'nobunaga', count: 1 });
  };

  // INTERACTIVE DECK DRAW: Click or drag the deck to draw cards into your hand!
  const handleDeckClick = () => {
    // 0. Regular Turn Draw phase: player draws cards into hand
    if (isMyTurn && gameState.turnPhase === 'draw') {
      soundManager.playCardSlide();
      socket.emit('draw_cards');
      return;
    }

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

  /** La carta può essere giocata su questo giocatore? */
  const isTargetValidFor = (card: CardDef | null, target: PlayerPublicState): boolean => {
    if (!card || !myPlayer) return false;
    if (target.id === myId) return false;

    if (card.type === 'weapon') {
      return canAttackWithWeapon(gameState.players, myPlayer, target, card).canAttack;
    }
    if (card.actionType === 'diversion') return target.handCount > 0;
    if (card.actionType === 'geisha') return target.handCount > 0 || target.propertiesInPlay.length > 0;
    if (card.propertyType === 'bushido') {
      // Si gioca davanti a chiunque (anche Inoffensivi), ma solo se non c'è già un Bushido in gioco
      return !gameState.players.some(p => p.propertiesInPlay.some(c => c.propertyType === 'bushido'));
    }
    if (card.actionType === 'breathing') return true;
    return false;
  };

  /** Bersagli evidenziati: carta scelta per il bersaglio oppure carta che stai trascinando (solo nel tuo turno) */
  const isTargetValid = (target: PlayerPublicState): boolean => {
    if (activePlayCard) return isTargetValidFor(activePlayCard, target);
    if (draggingCard && isPlayPhase) return isTargetValidFor(draggingCard, target);
    return false;
  };

  /**
   * Nel tuo turno: perché una carta della mano adesso non si può giocare (null = giocabile).
   * Le carte bloccate si abbassano un po' nella mano; il motivo compare al centro del tavolo al passaggio.
   */
  const blockedReasons: Record<string, string> = {};
  if (isPlayPhase && myPrivateState && myPlayer && !activePlayCard) {
    const others = gameState.players.filter(p => p.id !== myId);
    const weaponsLeft = (myPlayer.weaponsPlayedThisTurn ?? 0) < (myPlayer.maxWeaponsPerTurn ?? 1);
    for (const card of myPrivateState.hand) {
      let reason: string | null = null;
      if (card.actionType === 'parry') reason = 'La Parata si usa solo quando vieni attaccato';
      else if (card.type === 'weapon') {
        if (!weaponsLeft) reason = 'Hai già usato tutte le armi di questo turno';
        else if (!others.some(o => isTargetValidFor(card, o))) reason = `${card.name}: nessun avversario a portata (gittata ${card.difficulty})`;
      } else if (card.actionType === 'diversion' && !others.some(o => o.handCount > 0)) reason = 'Nessun avversario ha carte in mano';
      else if (card.actionType === 'geisha' && !others.some(o => o.handCount > 0 || o.propertiesInPlay.length > 0))
        reason = 'Nessun avversario ha carte da scartare';
      else if (card.propertyType === 'bushido' && gameState.players.some(p => p.propertiesInPlay.some(c => c.propertyType === 'bushido')))
        reason = "C'è già un Bushido in gioco";
      if (reason) blockedReasons[card.id] = reason;
    }
  }

  /** Carta con cui stai mirando (scelta o trascinata): per mostrare il calcolo accanto al nome degli avversari */
  const aimingCard = isPlayPhase ? activePlayCard ?? draggingCard : null;
  const targetInfoFor = (target: PlayerPublicState): { ok: boolean; text: string } | undefined => {
    if (!aimingCard || !myPlayer) return undefined;
    if (aimingCard.type !== 'weapon') {
      if (!cardNeedsTarget(aimingCard)) return undefined;
      return isTargetValidFor(aimingCard, target) ? { ok: true, text: 'bersaglio valido' } : { ok: false, text: target.handCount === 0 ? 'nessuna carta' : 'non valido' };
    }
    if (target.currentHp <= 0) return { ok: false, text: 'abbattuto: non si può colpire' };
    if (target.isHarmless) return { ok: false, text: 'senza carte: non si può colpire' };
    const dist = calculateDistance(gameState.players, myPlayer.id, target.id);
    const armor = target.propertiesInPlay.filter(c => c.propertyType === 'armor').length;
    const benkei = target.character?.id === 'benkei' ? 1 : 0;
    const diff = dist + armor + benkei;
    const reach = aimingCard.difficulty ?? 1;
    const kojiro = myPlayer.character?.id === 'kojiro';
    if (kojiro || reach >= diff) {
      const dmg = calculateAttackDamage(myPlayer, target, aimingCard);
      return { ok: true, text: `colpito: −${dmg} ferite` };
    }
    const parts = [`distanza ${dist}`];
    if (armor) parts.push(`armatura ${armor}`);
    if (benkei) parts.push('Benkei 1');
    return { ok: false, text: `${parts.join(' + ')}${parts.length > 1 ? ` = ${diff}` : ''} › gittata ${reach}` };
  };

  const cardNeedsTarget = (card: CardDef) =>
    card.type === 'weapon' ||
    card.propertyType === 'bushido' ||
    card.actionType === 'geisha' ||
    card.actionType === 'diversion' ||
    card.actionType === 'breathing';

  /** Carta trascinata dalla mano e lasciata sul tavolo (eventualmente sopra un avversario) */
  const handleDropCard = (card: CardDef, targetPlayerId: string | null) => {
    setDraggingCard(null);
    setDragHoverPlayerId(null);

    // Difesa: trascinare la Parata (o l'arma giusta) sul tavolo = usarla
    if (isUnderAttack) {
      if (eligibleReactionCardIds.includes(card.id)) handleReaction(card.id);
      else showHint('Questa carta non ti difende da questo attacco');
      return;
    }
    if (!isPlayPhase) {
      showHint(isMyTurn ? 'Aspetta la fase di gioco' : 'Non è il tuo turno');
      return;
    }
    if (card.actionType === 'parry') {
      showHint('La Parata si usa solo quando vieni attaccato');
      return;
    }
    if (card.type === 'weapon' && (myPlayer?.weaponsPlayedThisTurn ?? 0) >= (myPlayer?.maxWeaponsPerTurn ?? 1)) {
      showHint('Hai già giocato tutte le armi consentite in questo turno');
      return;
    }

    if (cardNeedsTarget(card)) {
      const target = targetPlayerId ? gameState.players.find(p => p.id === targetPlayerId) : undefined;
      if (target && isTargetValidFor(card, target)) {
        playOnTarget(card, target.id);
        return;
      }
      // Lasciata sul tavolo ma non su un bersaglio valido: si passa alla scelta del bersaglio
      if (target) showHint(card.type === 'weapon' ? `${target.name} è fuori portata` : `Non puoi giocarla su ${target.name}`);
      setActivePlayCard(card);
      return;
    }

    if (card.type === 'property') {
      soundManager.playCardSlide();
      socket.emit('play_property', { cardId: card.id });
    } else {
      soundManager.play('cardPlace');
      socket.emit('play_action', { cardId: card.id });
    }
  };

  /** Posto di un avversario (stessa logica per alto, sinistra e destra) */
  const renderOpponent = (opponent: PlayerPublicState, seat: SeatGeometry) => {
    const dist = myPlayer ? calculateDistance(gameState.players, myPlayer.id, opponent.id) : 0;
    const diff = myPlayer ? calculateTargetDifficulty(gameState.players, myPlayer, opponent) : 0;
    const liveHandCount = hasInitialDealt ? opponent.handCount : opponentDealtCounts[opponent.id] ?? 0;
    const shown = {
      ...opponent,
      handCount: liveHandCount,
      // dopo la distribuzione vale il calcolo ufficiale del server (0 carte O 0 Resistenza)
      isHarmless: hasInitialDealt ? opponent.isHarmless : liveHandCount === 0
    };
    return (
      <OpponentTableArea
        key={opponent.id}
        player={shown}
        seat={seat}
        isCurrentTurn={gameState.turnPlayerId === opponent.id}
        isDeciding={gameState.pendingReaction?.pendingForPlayerId === opponent.id}
        distanceFromMe={dist}
        difficultyFromMe={diff}
        isTargetable={isTargetValid(opponent)}
        targetInfo={targetInfoFor(opponent)}
        onTargetSelect={() => handleDirectTargetClick(opponent.id)}
        onInspectCard={card => setPreviewCard(card)}
        onInspectCharacter={char => setInspectCharacter(char)}
      />
    );
  };

  /** Gettoni Vita nella riserva comune = tutte le ferite subite al tavolo */
  const tokenReserveCount = gameState.players.reduce((sum, p) => sum + Math.max(0, p.maxHp - p.currentHp), 0);

  /** Ultima azione importante da mostrare al centro (niente messaggi di servizio) */
  const lastActionLog = [...gameState.logs]
    .reverse()
    .find(l => ['attack', 'damage', 'heal', 'defeat', 'action', 'end'].includes(l.type));

  // Determine playability of the currently previewed card
  const isPreviewInMyHand = Boolean(myPrivateState?.hand.some(c => c.id === previewCard?.id));
  let canPlayPreviewCard = false;
  let playButtonLabel = 'Gioca Carta';
  let playButtonIcon: React.ReactNode = <img src="/assets/icons/cards_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />;

  if (previewCard && isPreviewInMyHand) {
    if (isUnderAttack) {
      if (eligibleReactionCardIds.includes(previewCard.id)) {
        canPlayPreviewCard = true;
        playButtonLabel = 'Usa per Parare';
        playButtonIcon = reaction?.type === 'jujutsu'
          ? <img src="/assets/icons/crossed_swords_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />
          : <img src="/assets/icons/shield_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />;
      }
    } else if (isPlayPhase) {
      if (previewCard.type === 'weapon') {
        const weaponsPlayed = myPrivateState?.weaponsPlayedThisTurn || 0;
        const maxWeapons = myPrivateState?.maxWeaponsPerTurn || 1;
        if (weaponsPlayed < maxWeapons) {
          canPlayPreviewCard = true;
          playButtonLabel = 'Scegli Bersaglio';
          playButtonIcon = <img src="/assets/icons/sword_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />;
        }
      } else if (previewCard.type === 'property') {
        canPlayPreviewCard = true;
        playButtonLabel = previewCard.propertyType === 'bushido' ? 'Piazza Bushido' : 'Equipaggia Terreno';
        playButtonIcon = <img src="/assets/icons/shield_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />;
      } else if (previewCard.type === 'action') {
        canPlayPreviewCard = true;
        playButtonLabel = 'Attiva Azione';
        playButtonIcon = <img src="/assets/icons/sword_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />;
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
    isIeyasuDrawPhase ||
    (isMyTurn && gameState.turnPhase === 'draw')
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
      id="table-root"
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        backgroundImage: 'linear-gradient(to bottom, rgba(5, 10, 20, 0.62), rgba(8, 14, 25, 0.75)), url(/assets/ui/table_background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: '10px solid #1c1109' // bordo di legno del tavolo
      }}
    >
      {/* SCENA: il tavolo è disegnato a 1920×1080 e ridimensionato per riempire lo schermo */}
      <div
        id="table-stage"
        className="absolute"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${stageScale})`,
          transformOrigin: 'center center'
        }}
      >
      {/* Top Header Row */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between z-40 text-xs px-6 pt-3">
        <div className="flex items-center gap-3">
          <span className="font-title font-black text-amber-400 text-sm tracking-wider drop-shadow">
            SAMURAI SWORD
          </span>
          <span className="text-slate-400 font-mono text-[11px] drop-shadow">
            Stanza: {gameState.roomCode}
          </span>
          {/* Di chi è il turno (a sinistra, così non copre il giocatore di fronte) */}
        <div className="flex items-center gap-2 transition-all seat-label">
          <span className={`w-2.5 h-2.5 rounded-full ${gameState.turnPhase === 'dealing' ? 'bg-amber-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
          <span className="text-slate-200 text-xs font-semibold">
            {gameState.turnPhase === 'dealing' ? (
              <span className="text-amber-300 font-bold">Distribuzione Carte in corso...</span>
            ) : (
              <>
                Turno: <strong className="text-amber-300">{turnPlayer?.name || '...'}</strong>
                <span className="text-slate-400 ml-1.5 font-normal">
                  ({gameState.turnPhase === 'recover' ? 'Recupero' : gameState.turnPhase === 'draw' ? 'Pesca' : gameState.turnPhase === 'play' ? 'Azione' : gameState.turnPhase === 'discard' ? 'Scarto' : 'Attesa'})
                </span>
              </>
            )}
          </span>
        </div>
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
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={Math.round(soundManager.volume * 100)}
            onChange={e => soundManager.setVolume(Number(e.target.value) / 100)}
            onMouseUp={() => soundManager.play('uiClick')}
            className="w-20 accent-amber-500 cursor-pointer"
            title="Volume"
          />
        </div>
      </div>

      {/* ===================== TAVOLO ROTONDO ===================== */}
      {opponentsOrdered.map((opponent, i) => renderOpponent(opponent, seats[i]))}

      {/* Centro del tavolo: riserva gettoni, mazzo, scarti */}
      <div
        className="absolute flex flex-col items-center"
        style={{ left: TABLE_CENTER.x, top: TABLE_CENTER.y, transform: 'translate(-50%, -50%)' }}
      >
        <div className="flex items-center gap-8 sm:gap-12">
          {/* Riserva comune dei gettoni Vita: qui finiscono le ferite e da qui tornano le cure */}
          <div className="flex flex-col items-center justify-center" style={{ minWidth: 90 }} title="Riserva dei gettoni Vita">
            <TokenPile
              id="table-token-reserve"
              kind="hp"
              ledgerKey="reserve"
              count={tokenReserveCount}
              seed="reserve"
              size={22}
              perRow={4}
              title={`Riserva: ${tokenReserveCount} gettoni Vita`}
            />
          </div>

          {/* Mazzo */}
          <div
            id="table-deck-pile"
            onClick={handleDeckClick}
            draggable={isDeckReadyToDraw}
            onDragStart={(e) => {
              if (isDeckReadyToDraw) {
                e.dataTransfer.setData('text/plain', 'deck_draw');
                e.dataTransfer.effectAllowed = 'copyMove';
              }
            }}
            className={`relative transition-all duration-300 cursor-pointer ${
              isDeckReadyToDraw ? 'scale-110 ring-4 ring-amber-400/90 shadow-[0_0_30px_rgba(245,158,11,0.7)] animate-pulse' : 'hover:scale-105'
            }`}
            title={
              isDeckReadyToDraw
                ? 'Clicca o trascina il mazzo nella tua mano per pescare!'
                : `Mazzo: ${gameState.deckCount} carte`
            }
          >
            {isDeckReadyToDraw && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-500 text-slate-950 font-black text-[11px] px-2.5 py-0.5 rounded-full shadow-lg border border-amber-300 flex items-center gap-1.5 z-30 animate-bounce">
                <img src="/assets/icons/cards_white.webp" alt="" className="w-3.5 h-3.5 object-contain invert" />
                <span>PESCA DAL MAZZO</span>
              </div>
            )}
            <TabletopCard imageSrc="/assets/ui/card_back.webp" fallbackText="Mazzo" size="md" />
            <span className={`absolute bottom-1 right-1.5 font-black text-sm seat-label ${gameState.deckCount <= 8 ? 'text-red-300 animate-pulse' : 'text-amber-200'}`}>
              {gameState.deckCount}
            </span>
            {gameState.status === 'playing' && gameState.deckCount <= 8 && (
              <span
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-red-300 seat-label flex items-center gap-1"
                title="Quando il mazzo finisce, gli scarti vengono rimescolati e tutti perdono 1 Punto Onore"
              >
                <AlertTriangle className="w-3 h-3 text-red-400 inline-block" />
                Mazzo quasi finito: −1 Onore a tutti
              </span>
            )}
          </div>

          {/* Punto d'arrivo delle carte giocate (invisibile: la carta si mostra e poi va negli scarti) */}
          <div id="table-play-zone" className="w-28 h-40" />

          {/* Scarti */}
          <div
            id="table-discard-pile"
            onClick={handleDiscardPileClick}
            className={`relative transition-transform duration-300 cursor-pointer ${isIeyasuDrawPhase ? 'scale-105 seat-turn' : 'hover:scale-105'}`}
          >
            {isIeyasuDrawPhase && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-amber-300 font-black text-xs whitespace-nowrap seat-label z-30">
                Pesca dagli scarti
              </div>
            )}
            {shownDiscardTop ? (
              <div className="rotate-2 hover:rotate-0 transition-transform duration-300" title="Pila degli scarti (clicca per vedere la carta)">
                <TabletopCard imageSrc={`/assets/cards/${shownDiscardTop.templateId}.webp`} fallbackText={shownDiscardTop.name} size="md" />
              </div>
            ) : (
              <div style={{ width: '104px', height: '148px' }} className="flex items-center justify-center text-slate-500/70 text-xs font-bold seat-label">
                Scarti
              </div>
            )}
          </div>
        </div>

        {/* Un'unica riga con l'ultima azione importante (il resto è nella Cronologia) */}
        <div className="mt-5 h-5 text-sm text-slate-200 text-center w-[640px] pointer-events-none seat-label truncate">
          {tableHint ? (
            <span className="text-amber-300 font-bold">{tableHint}</span>
          ) : hoverHint ? (
            <span className="text-slate-300 italic">{hoverHint}</span>
          ) : (
            lastActionLog?.text
          )}
        </div>

        {/* Richieste per te (difesa, bersaglio, scarto, pesca): al centro del tavolo, dove guardi */}
        <div className="mt-3 flex flex-col items-center gap-2">
        {/* Fase di pesca: clicca o trascina il mazzo */}
        {isMyTurn && gameState.turnPhase === 'draw' && (
          <div className="flex items-center justify-center gap-2 animate-fadeIn bg-black/70 px-4 py-1.5 rounded-full border border-amber-400/80 shadow-lg">
            <img src="/assets/icons/cards_white.webp" alt="" className="w-4 h-4 object-contain animate-bounce" />
            <span className="text-xs font-bold text-amber-200 seat-label">
              Fase di Pesca: <strong className="text-amber-300">pesca le tue carte dal mazzo</strong> (clicca o trascina)
            </span>
          </div>
        )}

        {/* Nobunaga pesca in sospeso */}
        {pendingDeckDraw?.type === 'nobunaga' && (
          <div className="flex items-center justify-center gap-2 animate-fadeIn bg-orange-950/85 px-4 py-1.5 rounded-full border border-orange-400/80 shadow-lg">
            <img src="/assets/icons/cards_white.webp" alt="" className="w-4 h-4 object-contain animate-bounce" />
            <span className="text-xs font-bold text-orange-200 seat-label">
              Abilità Nobunaga: <strong className="text-amber-300">clicca il mazzo</strong> per pescare sacrificando 1 Resistenza
            </span>
          </div>
        )}

        {/* Difesa: scegli una carta o subisci */}
        {isUnderAttack && reaction && (
          <div className="flex items-center justify-center gap-3 animate-fadeIn">
            <span className="text-sm font-bold text-red-200 flex items-center gap-1.5 seat-label">
              <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
              {reaction.type === 'bushido' ? (
                <>
                  <img src="/assets/icons/crossed_swords_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />
                  <strong className="text-amber-300">Bushido!</strong> È uscita un'Arma: scarta un'<strong className="text-amber-300">Arma</strong> oppure perdi 1 Onore
                </>
              ) : reaction.type === 'battle_cry' ? (
                <>
                  <img src="/assets/icons/shield_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />
                  <strong className="text-amber-300">Grido di Battaglia!</strong> Gioca una <strong className="text-emerald-300">Parata</strong> per difenderti
                </>
              ) : reaction.type === 'jujutsu' ? (
                <>
                  <img src="/assets/icons/crossed_swords_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />
                  <strong className="text-amber-300">Jiujitsu!</strong> Scarta un'<strong className="text-amber-300">Arma</strong> per neutralizzarlo
                </>
              ) : (
                <span className="flex items-center gap-1">
                  <img src="/assets/icons/sword_white.webp" alt="" className="w-4 h-4 object-contain inline-block" />
                  Attacco con <strong className="text-amber-300">{reaction.weaponCard?.name || "un'Arma"}</strong> (−{reaction.damage || 1}
                  <img src="/assets/ui/resilience_token.webp" alt="" className="w-3.5 h-3.5 object-contain inline-block ml-0.5" />)
                </span>
              )}
            </span>
            <button
              onClick={() => handleReaction(null)}
              className="bg-red-800 hover:bg-red-700 text-white font-black text-xs px-3.5 py-1.5 rounded-full border border-red-400 shadow flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-105 active:scale-95"
              title={reaction.type === 'bushido' ? 'Perdi 1 Punto Onore' : 'Subisci il colpo e perdi punti vita'}
            >
              <HeartCrack className="w-3.5 h-3.5 text-red-200" />
              {reaction.type === 'bushido' ? (
                <span className="flex items-center gap-1">
                  Perdi 1 Onore
                  <img src="/assets/ui/honor_token.webp" alt="" className="w-3.5 h-3.5 object-contain inline-block" />
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  Subisci (−{reaction.damage || 1}
                  <img src="/assets/ui/resilience_token.webp" alt="" className="w-3.5 h-3.5 object-contain inline-block" />)
                </span>
              )}
            </button>
          </div>
        )}

        {/* Scelta del bersaglio in corso */}
        {activePlayCard && !isUnderAttack && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setActivePlayCard(null)}
              className="text-xs font-bold text-amber-200 hover:text-white bg-black/70 hover:bg-black/90 px-4 py-1.5 rounded-full border border-amber-500/50 flex items-center gap-2 cursor-pointer shadow transition-all hover:scale-102"
              title="Clicca per deselezionare"
            >
              <img src="/assets/icons/sword_white.webp" alt="" className="w-3.5 h-3.5 object-contain" />
              <span>Scegli il bersaglio per {activePlayCard.name} (clicca per deselezionare)</span>
            </button>
          </div>
        )}

        {/* Scarto oltre le 7 carte */}
        {isDiscardPhase && excessDiscardCount > 0 && !isUnderAttack && (
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs font-bold text-amber-200 seat-label">Scegli {excessDiscardCount} carte da scartare (massimo 7 in mano)</span>
            <button
              onClick={handleDiscardConfirm}
              disabled={selectedDiscardIds.length !== excessDiscardCount}
              className={`py-1 px-4 rounded-full font-black text-xs border shadow flex items-center gap-1.5 transition-all ${
                selectedDiscardIds.length === excessDiscardCount
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Scarta ({selectedDiscardIds.length}/{excessDiscardCount})</span>
            </button>
          </div>
        )}

        </div>
      </div>

      {/* ===================== IL TUO PERSONAGGIO (IN BASSO A SINISTRA) ===================== */}
      {myPrivateState && (
        <div
          id="table-player-mat"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('text/plain')) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            const data = e.dataTransfer.getData('text/plain');
            if (data === 'deck_draw' && isDeckReadyToDraw) {
              e.preventDefault();
              handleDeckClick();
            }
          }}
          className={`absolute bottom-3 left-4 sm:left-6 z-30 select-none flex flex-col items-start gap-1.5 ${
            myPrivateState.currentHp <= 0 ? 'opponent-defeated' : isMyTurn ? 'seat-turn' : ''
          }`}
        >
          {/* Nome giocatore e abilità */}
          <div className="seat-label flex flex-col">
            <div className={`font-title font-bold text-sm tracking-wide transition-colors duration-500 ${isMyTurn ? 'text-amber-300 seat-name-turn' : 'text-slate-100'}`}>
              {myPrivateState.name}
            </div>
            {myPrivateState.character && (
              <div
                className="relative group text-[10px] text-slate-300/80 italic max-w-[210px] truncate"
                title={`${myPrivateState.character.name}: ${myPrivateState.character.abilityDescription}`}
              >
                <span>{myPrivateState.character.name} · {myPrivateState.character.shortAbility}</span>
                {myPrivateState.character.id === 'nobunaga' && isPlayPhase && myPrivateState.currentHp > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNobunagaAbilityClick();
                    }}
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-amber-500/35 border border-amber-400 rounded px-1.5 py-0.5 text-[9px] not-italic font-bold text-amber-100 backdrop-blur-xs flex items-center justify-center gap-1 transition-opacity cursor-pointer shadow-md"
                    title="Usa abilità: Sacrifica 1 Resistenza per pescare 1 carta"
                  >
                    <img src="/assets/icons/cards_white.webp" alt="" className="w-3 h-3 object-contain inline-block" />
                    <span>Attiva abilità</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Area carte + gettoni: Vita a sinistra, Carte sovrapposte al centro, Onore a destra */}
          <div className="flex items-center gap-2">
            {/* Gettoni Resistenza (Vita) */}
            <div className="flex flex-col items-center">
              <TokenPile
                id={`tokens-hp-${myId}`}
                kind="hp"
                ledgerKey={`hp:${myId}`}
                count={myPrivateState.currentHp}
                seed={`hp-${myId}`}
                size={24}
                perRow={2}
                title={`Resistenza: ${myPrivateState.currentHp} su ${myPrivateState.maxHp}`}
              />
              <span className="text-[10px] font-bold text-red-300 seat-label mt-0.5">
                {myPrivateState.currentHp}/{myPrivateState.maxHp}
              </span>
            </div>

            {/* Carte Personaggio + Ruolo sovrapposte */}
            <div className="relative" style={{ width: 88 + 44, height: 125 }}>
              {/* Ruolo sotto, sfalsato a destra */}
              <div className="absolute" style={{ left: 44, top: 0, rotate: '4deg' }}>
                <TabletopCard imageSrc={`/assets/roles/${myPrivateState.role.id}.webp`} fallbackText={myPrivateState.role.name} size="seat" />
                {myPrivateState.role.id === 'shogun' && (
                  <div className="absolute -top-2 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full shadow">
                    <Crown className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              {/* Personaggio sopra */}
              <div
                id={`character-card-${myId}`}
                className="absolute cursor-pointer transition-transform"
                style={{ left: 0, top: 0, rotate: '-2deg' }}
                onClick={() => myPrivateState.character && setInspectCharacter(myPrivateState.character)}
                title="Clicca per vedere l'abilità del personaggio"
              >
                <TabletopCard
                  imageSrc={`/assets/characters/${myPrivateState.character?.id}.webp`}
                  fallbackText={myPrivateState.character?.name || 'Personaggio'}
                  size="seat"
                />
              </div>

              {/* Taglio se a zero pf */}
              {myPrivateState.currentHp <= 0 && (
                <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
                  <span className="font-jp text-6xl text-red-600/85 drop-shadow-[0_0_12px_rgba(220,38,38,0.8)] animate-fadeIn">斬</span>
                </div>
              )}
            </div>

            {/* Gettoni Onore */}
            <div className="flex flex-col items-center">
              <TokenPile
                id={`tokens-honor-${myId}`}
                kind="honor"
                ledgerKey={`honor:${myId}`}
                count={myPrivateState.honorPoints}
                seed={`honor-${myId}`}
                size={24}
                perRow={2}
                title={`Punti Onore: ${myPrivateState.honorPoints}`}
              />
              <span className="text-[10px] font-bold text-purple-300 seat-label mt-0.5">
                {myPrivateState.honorPoints} Onore
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CENTRO IN BASSO: PROPRIETÀ E MANO ===================== */}
      <div className="absolute bottom-0 left-0 right-0 pb-3 flex flex-col items-center select-none z-20 pointer-events-none">
        {/* LE TUE CARTE GIOCATE: più avanti, verso il centro del tavolo */}
        {myPrivateState && (
          <div className="w-full flex justify-center mb-2 pointer-events-auto">
            <PlayerField
              properties={myPrivateState.propertiesInPlay}
              onInspectCard={card => setPreviewCard(card)}
              isDropActive={Boolean(draggingCard) && isPlayPhase && !dragHoverPlayerId && !cardNeedsTarget(draggingCard!) && draggingCard!.actionType !== 'parry'}
            />
          </div>
        )}

        {/* LA TUA MANO: in basso, grande, a ventaglio e trascinabile */}
        <div
          className="relative w-full flex justify-center pointer-events-auto"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('text/plain')) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            const data = e.dataTransfer.getData('text/plain');
            if (data === 'deck_draw' && isDeckReadyToDraw) {
              e.preventDefault();
              handleDeckClick();
            }
          }}
        >
          {myPrivateState && (
            <HandTray
              cards={visibleCardsForTray}
              isMyTurn={isPlayPhase}
              isUnderAttack={isUnderAttack}
              reactionType={isUnderAttack ? reaction?.type ?? null : null}
              eligibleReactionCardIds={eligibleReactionCardIds}
              isDiscardPhase={isDiscardPhase}
              selectedDiscardIds={selectedDiscardIds}
              selectedCardId={previewCard?.id || activePlayCard?.id}
              blockedReasons={blockedReasons}
              onHoverCard={card => setHoverHint(card ? blockedReasons[card.id] ?? null : null)}
              onCardClick={handleCardClick}
              onDropToTable={handleDropCard}
              onDragToTableChange={(card, hovered) => {
                setDraggingCard(card);
                setDragHoverPlayerId(hovered);
              }}
            />
          )}

          {/* Comandi, in basso a destra */}
          <div className="absolute right-0 bottom-1 w-56 flex flex-col items-end justify-end gap-2.5">
            {isPlayPhase && (
              <span className="text-xs text-amber-300 font-bold seat-label">
                Armi giocate: {myPrivateState?.weaponsPlayedThisTurn || 0} / {myPrivateState?.maxWeaponsPerTurn || 1}
              </span>
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
      </div>
      {/* fine SCENA */}

      {/* FLOATING CARD PREVIEW (NO SCHEDE: VISUALIZZA LA CARTA FISICA INGRANDITA + PULSANTE GIOCA) */}
      {previewCard && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/65 backdrop-blur-xs select-none animate-fadeIn pointer-events-auto cursor-pointer"
          onClick={() => setPreviewCard(null)}
          title="Clicca ovunque per chiudere l'anteprima"
        >
          <div
            className="flex flex-col items-center gap-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Visualizzazione ingrandita ad alta risoluzione della carta stessa (310x440px) */}
            <div
              onClick={() => setPreviewCard(null)}
              className="rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] border-2 border-amber-500/80 transform hover:scale-102 transition-transform cursor-pointer"
              title="Clicca per chiudere"
            >
              <TabletopCard
                imageSrc={`/assets/cards/${previewCard.templateId}.webp`}
                fallbackText={previewCard.name}
                size="zoom"
                isHoverable={false}
              />
            </div>

            {/* Pulsanti d'azione diretti sotto la carta */}
            {canPlayPreviewCard && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleConfirmPlay(previewCard)}
                  className="py-2.5 px-6 rounded-xl font-title font-black text-sm uppercase tracking-wider bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:brightness-110 active:scale-95 text-slate-950 shadow-xl shadow-emerald-500/35 border border-emerald-300 cursor-pointer flex items-center gap-2 transition-all"
                >
                  <span>{playButtonIcon}</span>
                  <span>{playButtonLabel}</span>
                </button>
              </div>
            )}
            {!canPlayPreviewCard && isPreviewInMyHand && (
              <div className="py-1.5 px-3.5 rounded-full bg-slate-900/90 border border-slate-700 text-xs text-slate-400 font-semibold">
                Non giocabile in questo momento (clicca ovunque per chiudere)
              </div>
            )}
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

      {/* EFFETTI CINEMATOGRAFICI: danni, parate, abbattimenti, Onore, carte in volo */}
      <EffectsLayer events={gameState.events ?? []} myId={myId} players={gameState.players} />

      {/* TIMER DELLA DECISIONE: quanto tempo resta prima che l'IA decida al posto del giocatore */}
      <DecisionCountdown gameState={gameState} myId={myId} />

      {/* TURN CHANGE BANNER (ANIMAZIONE FLUIDA AL CAMBIO TURNO) */}
      {turnBanner && (
        <div className="fixed top-[30%] left-1/2 -translate-x-1/2 z-60 animate-fadeIn pointer-events-none">
          {/* Solo testo, senza riquadro: non copre le carte dei giocatori */}
          <div
            className={`flex flex-col items-center justify-center transition-all turn-banner-text ${
              turnBanner.isMyTurn ? 'text-amber-300' : 'text-slate-100'
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
          </div>
        </div>
      )}

      {/* Distribuzione iniziale: solo un contatore discreto (la cutscene ha già presentato il tavolo) */}
      {gameState.turnPhase === 'dealing' && !hasInitialDealt && dealProgress && (
        <div className="fixed top-[30%] left-1/2 -translate-x-1/2 z-60 pointer-events-none text-amber-200 text-sm font-bold turn-banner-text">
          Distribuzione carte… {dealProgress.current}/{dealProgress.total}
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
      {/* La schermata finale arriva dopo la scena cinematografica di fine battaglia */}
      {gameState.status === 'game_over' && showGameOver && (
        <GameOverModal
          gameState={gameState}
          onPlayAgain={onReturnToLobby}
          isHost={Boolean(myPrivateState?.isHost)}
          onRematch={() => socket.emit('rematch')}
        />
      )}

      {/* Rules Modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* Diversione / Geisha: scegli la carta coperta (o la Proprietà) dell'avversario */}
      {handPick && pickTarget && (
        <HiddenCardPicker
          card={handPick.card}
          target={pickTarget}
          onCancel={() => setHandPick(null)}
          onPickHand={index => {
            socket.emit('play_action', { cardId: handPick.card.id, targetPlayerId: handPick.targetId, targetHandIndex: index });
            setHandPick(null);
          }}
          onPickProperty={propertyId => {
            socket.emit('play_action', { cardId: handPick.card.id, targetPlayerId: handPick.targetId, targetPropertyId: propertyId });
            setHandPick(null);
          }}
        />
      )}

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

/** Conto alla rovescia della decisione corrente (mostrato a chi deve decidere e, negli ultimi secondi, agli altri). */
const DecisionCountdown: React.FC<{ gameState: GameState; myId: string }> = ({ gameState, myId }) => {
  const [now, setNow] = useState(() => Date.now());
  const deadlineRef = useRef<number | null>(null);

  // Il server invia i millisecondi rimasti: li trasformo in una scadenza sull'orologio locale
  useEffect(() => {
    deadlineRef.current = gameState.decisionMsLeft != null ? Date.now() + gameState.decisionMsLeft : null;
    setNow(Date.now());
  }, [gameState]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  if (gameState.status !== 'playing' || !gameState.decisionPlayerId || deadlineRef.current == null) return null;
  const secs = Math.max(0, Math.ceil((deadlineRef.current - now) / 1000));
  const mine = gameState.decisionPlayerId === myId;
  const who = gameState.players.find(p => p.id === gameState.decisionPlayerId)?.name ?? '';
  if (!mine && secs > 15) return null;

  return (
    <div className="fixed top-12 right-6 z-[70] pointer-events-none">
      <div
        className={`text-sm font-black seat-label ${secs <= 10 ? 'text-red-300 animate-pulse' : 'text-amber-200'}`}
      >
        ⏳ {mine ? `Il tuo tempo: ${secs}s` : `${who}: ${secs}s`}
      </div>
    </div>
  );
};
