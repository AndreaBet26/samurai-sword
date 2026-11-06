import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import { PlayerPublicState, RoomSettings } from '../../../shared/types';
import { Users, Bot, Copy, Check, Play, BookOpen, Link2, Trash2, Plus } from 'lucide-react';

const NAME_KEY = 'samurai-sword-nome';

/** Il nome scelto viene ricordato per le volte successive */
function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignora */
  }
}

/** Codice stanza preso dal link d'invito (…/?stanza=ABCDE) */
function codeFromUrl(): string {
  try {
    return (new URLSearchParams(window.location.search).get('stanza') ?? '').toUpperCase().slice(0, 6);
  } catch {
    return '';
  }
}

interface LobbyViewProps {
  currentRoomCode: string | null;
  players: PlayerPublicState[];
  isHost: boolean;
  myId?: string;
  settings?: RoomSettings;
  /** Messaggio breve (es. sei stato tolto dalla stanza) */
  notice?: string | null;
  onOpenRules: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  currentRoomCode,
  players,
  isHost,
  myId = '',
  settings = { turnTimer: '120', animSpeed: 'normal' },
  notice = null,
  onOpenRules
}) => {
  const [playerName, setPlayerName] = useState(loadName);
  const [joinCode, setJoinCode] = useState(codeFromUrl);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const invited = Boolean(codeFromUrl());

  // Math.min assicura che l'intera opera d'arte 4K (3840 x 2160) sia visibile al 100% senza essere tagliata
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / 3840, window.innerHeight / 2160)
  );

  useEffect(() => {
    const updateScale = () => {
      setScale(Math.min(window.innerWidth / 3840, window.innerHeight / 2160));
    };
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    if (playerName.trim()) saveName(playerName.trim());
  }, [playerName]);

  const updateSettings = (patch: Partial<RoomSettings>) => socket.emit('update_settings', patch);
  const removePlayer = (playerId: string) => socket.emit('remove_player', { playerId });

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    socket.emit('create_room', { playerName: playerName.trim() || 'Giocatore 1' });
  };

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinCode.trim()) return;
    socket.emit('join_room', {
      roomCode: joinCode.trim(),
      playerName: playerName.trim() || 'Giocatore'
    });
  };

  const handleAddBot = () => {
    socket.emit('add_bot');
  };

  const handleStartGame = () => {
    socket.emit('start_game');
  };

  /** Copia negli appunti (con ripiego per i browser che non lo permettono) */
  const copy = (text: string, what: 'code' | 'link') => {
    const done = () => {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt('Copia questo testo:', text));
    else window.prompt('Copia questo testo:', text);
  };

  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const publicBaseUrl = isLocalhost ? 'http://178.104.245.26:3001' : window.location.origin;
  const inviteLink = currentRoomCode ? `${publicBaseUrl}/?stanza=${currentRoomCode}` : '';

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none animate-fadeIn flex items-center justify-center bg-[#07090e]"
      style={{
        backgroundImage:
          'url(/assets/ui/lobby_background_4k.webp), url(/assets/ui/lobby_background_4k.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Canvas interattivo 4K (3840 x 2160) scalato con Math.min per allinearsi perfettamente alla pagina */}
      <div
        className="relative overflow-hidden shrink-0 pointer-events-auto"
        style={{
          width: 3840,
          height: 2160,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          fontFamily: "'Montserrat', sans-serif"
        }}
      >
        {!currentRoomCode ? (
          /* ===================== SCHERMATA INIZIALE: NESSUN BOX O RIQUADRO ARTIFICIALE ===================== */
          /* Gli elementi appaiono direttamente impressi sullo sfondo ("stampati sul foglio") */
          <div
            className="absolute"
            style={{
              left: 1490,
              top: 960,
              width: 860,
              height: 600,
              backgroundColor: 'transparent',
              border: 'none',
              boxShadow: 'none',
              backdropFilter: 'none',
              padding: '20px 40px'
            }}
          >
            {/* Avviso o invito */}
            {notice && (
              <div
                className="text-center font-bold text-amber-300 rounded-xl py-2 px-4 mb-3"
                style={{
                  fontSize: 18,
                  backgroundColor: 'transparent',
                  border: '1.5px solid rgba(245, 158, 11, 0.6)',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)'
                }}
              >
                {notice}
              </div>
            )}
            {invited && (
              <div
                className="text-center font-bold text-sky-200 rounded-xl py-2 px-4 mb-3"
                style={{
                  fontSize: 18,
                  backgroundColor: 'transparent',
                  border: '1.5px solid rgba(56, 189, 248, 0.6)',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)'
                }}
              >
                Sei stato invitato nella stanza <span className="font-mono font-black text-amber-400">{joinCode}</span>: inserisci il tuo nome e premi ENTRA.
              </div>
            )}

            {/* SEZIONE INPUT NOME - Senza alcun box, impresso direttamente sullo sfondo */}
            <div className="flex flex-col">
              {/* Etichetta: IL TUO NOME GUERRIERO */}
              <label
                htmlFor="input-player-name"
                className="font-black uppercase tracking-wider mb-2.5"
                style={{
                  fontSize: 22,
                  color: '#e2e8f0',
                  letterSpacing: '0.12em',
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.95), 0 0 15px rgba(0, 0, 0, 0.8)'
                }}
              >
                IL TUO NOME GUERRIERO
              </label>

              {/* Campo di Inserimento (Input Text) - Puro testo con sottolineatura dorata calligrafica */}
              <input
                id="input-player-name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (joinCode.trim()) handleJoin();
                    else handleCreate();
                  }
                }}
                placeholder="es. Musashi, Marco, Kenshin..."
                maxLength={20}
                style={{
                  width: 780,
                  height: 64,
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: '2.5px solid rgba(212, 175, 55, 0.7)',
                  borderRadius: 0,
                  color: '#ffffff',
                  fontSize: 28,
                  fontWeight: 700,
                  paddingLeft: 6,
                  paddingRight: 6,
                  outline: 'none',
                  boxShadow: 'none',
                  textShadow: '0 2px 12px rgba(0, 0, 0, 0.95), 0 0 16px rgba(0, 0, 0, 0.8)',
                  transition: 'border-color 0.25s, filter 0.25s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderBottomColor = '#fbbf24';
                  e.currentTarget.style.filter = 'drop-shadow(0 2px 8px rgba(251, 191, 36, 0.65))';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderBottomColor = 'rgba(212, 175, 55, 0.7)';
                  e.currentTarget.style.filter = 'none';
                }}
              />
            </div>

            {/* SEZIONE PULSANTI E CODICE (Allineati orizzontalmente senza box) */}
            <div
              className="flex items-center justify-between"
              style={{
                width: 780,
                marginTop: 40
              }}
            >
              {/* Pulsante: CREA NUOVA STANZA (Rosso imperiale) */}
              <button
                type="button"
                onClick={() => handleCreate()}
                className="flex items-center justify-center font-bold text-white transition-all duration-200 cursor-pointer hover:brightness-115 active:scale-95"
                style={{
                  width: 270,
                  height: 66,
                  background: 'linear-gradient(135deg, #b30000, #e60000)',
                  borderRadius: 33,
                  border: 'none',
                  fontSize: 18,
                  letterSpacing: '0.04em',
                  gap: 10,
                  boxShadow: '0 8px 24px rgba(179, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.8)',
                  textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)'
                }}
              >
                <img
                  src="/assets/icons/sword_white.webp"
                  alt=""
                  style={{ width: 22, height: 22, objectFit: 'contain' }}
                />
                <span>CREA NUOVA STANZA</span>
              </button>

              {/* Input Codice: CODICE - Calligrafico con linea d'oro (Il Secondo) */}
              <div
                className="flex items-center justify-center"
                style={{
                  width: 200,
                  height: 66
                }}
              >
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoin();
                  }}
                  placeholder="CODICE"
                  maxLength={6}
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: '2.5px solid rgba(245, 158, 11, 0.7)',
                    borderRadius: 0,
                    color: '#fcd34d',
                    fontSize: 26,
                    fontWeight: 800,
                    textAlign: 'center',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    outline: 'none',
                    boxShadow: 'none',
                    textShadow: '0 2px 10px rgba(0, 0, 0, 0.95), 0 0 14px rgba(246, 173, 85, 0.5)',
                    transition: 'border-color 0.25s, filter 0.25s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderBottomColor = '#fbbf24';
                    e.currentTarget.style.filter = 'drop-shadow(0 2px 10px rgba(251, 191, 36, 0.75))';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderBottomColor = 'rgba(245, 158, 11, 0.7)';
                    e.currentTarget.style.filter = 'none';
                  }}
                />
              </div>

              {/* Pulsante: ENTRA (Oro luminoso) */}
              <button
                type="button"
                onClick={() => handleJoin()}
                className="flex items-center justify-center font-bold text-slate-950 transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-95"
                style={{
                  width: 240,
                  height: 66,
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                  borderRadius: 33,
                  border: 'none',
                  fontSize: 19,
                  letterSpacing: '0.06em',
                  gap: 10,
                  boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4), 0 2px 6px rgba(0, 0, 0, 0.8)',
                  textShadow: '0 1px 2px rgba(255, 255, 255, 0.25)'
                }}
              >
                <Users style={{ width: 22, height: 22, color: '#1a120b' }} />
                <span>ENTRA</span>
              </button>
            </div>
          </div>
        ) : (
          /* ===================== STANZA DI ATTESA (SALA D'ATTESA LOBBY) ===================== */
          /* Rework estetico: flusso naturale, zero slider/scrollbar, niente vuoti sprecati */
          <div
            className="absolute flex flex-col select-none"
            style={{
              left: 1300,
              top: 720,
              width: 1240,
              backgroundColor: 'transparent',
              border: 'none',
              boxShadow: 'none',
              backdropFilter: 'none',
              padding: '0 15px',
              gap: 22
            }}
          >
            {/* 1. HEADER: CODICE STANZA & CONDIVISIONE */}
            <div
              className="flex items-center justify-between pb-4"
              style={{
                borderBottom: '2px solid rgba(212, 175, 55, 0.45)',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.95)'
              }}
            >
              <div className="flex flex-col">
                <span
                  className="uppercase font-bold tracking-widest"
                  style={{ fontSize: 18, color: '#cbd5e1', letterSpacing: '0.12em' }}
                >
                  CODICE STANZA DA CONDIVIDERE
                </span>
                <span
                  className="font-mono font-black text-amber-400 tracking-[0.18em]"
                  style={{
                    fontSize: 54,
                    lineHeight: 1.15,
                    textShadow: '0 0 20px rgba(245, 158, 11, 0.6), 0 4px 10px rgba(0, 0, 0, 0.9)'
                  }}
                >
                  {currentRoomCode}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => copy(currentRoomCode, 'code')}
                  className="px-6 py-3 rounded-full font-bold text-slate-100 transition-all flex items-center gap-2.5 cursor-pointer hover:bg-white/15 active:scale-95"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1.5px solid rgba(255, 255, 255, 0.3)',
                    fontSize: 18,
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)'
                  }}
                  title="Copia il codice della stanza"
                >
                  {copied === 'code' ? (
                    <Check style={{ width: 22, height: 22, color: '#4ade80' }} />
                  ) : (
                    <Copy style={{ width: 22, height: 22, color: '#e2e8f0' }} />
                  )}
                  <span>{copied === 'code' ? 'Copiato!' : 'Copia Codice'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => copy(inviteLink, 'link')}
                  className="px-7 py-3 rounded-full font-black text-slate-950 transition-all flex items-center gap-2.5 cursor-pointer hover:brightness-110 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                    fontSize: 18,
                    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4), 0 2px 6px rgba(0, 0, 0, 0.8)'
                  }}
                  title="Copia il link d'invito online diretto"
                >
                  {copied === 'link' ? (
                    <Check style={{ width: 22, height: 22, color: '#1a120b' }} />
                  ) : (
                    <Link2 style={{ width: 22, height: 22, color: '#1a120b' }} />
                  )}
                  <span>{copied === 'link' ? 'Copiato!' : 'Copia Link Invito'}</span>
                </button>
              </div>
            </div>

            {/* 2. LISTA GUERRIERI IN ATTESA - Mostra tutti i giocatori (fino a 7) direttamente, senza slider */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <span
                    className="font-black uppercase tracking-wider flex items-center gap-2.5"
                    style={{
                      fontSize: 22,
                      color: '#f8fafc',
                      letterSpacing: '0.08em',
                      textShadow: '0 2px 10px rgba(0, 0, 0, 0.95)'
                    }}
                  >
                    <Users style={{ width: 26, height: 26, color: '#f59e0b' }} />
                    <span>GUERRIERI IN ATTESA ({players.length} / 7)</span>
                  </span>

                  {/* Pulsante rapido affianco al titolo: solo "+" ed icona robot */}
                  {isHost && players.length < 7 && (
                    <button
                      type="button"
                      onClick={handleAddBot}
                      className="flex items-center gap-1 px-3 py-1 rounded-full font-black text-sky-200 transition-all cursor-pointer hover:brightness-125 hover:scale-105 active:scale-95"
                      style={{
                        background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.4), rgba(3, 105, 161, 0.6))',
                        border: '1.5px solid rgba(56, 189, 248, 0.7)',
                        fontSize: 16,
                        boxShadow: '0 2px 10px rgba(2, 132, 199, 0.35)'
                      }}
                      title="Aggiungi Bot (IA)"
                    >
                      <Plus style={{ width: 16, height: 16, strokeWidth: 3 }} />
                      <Bot style={{ width: 20, height: 20, color: '#38bdf8' }} />
                    </button>
                  )}
                </div>

                <span
                  className="font-semibold"
                  style={{
                    fontSize: 18,
                    color: players.length >= 3 ? '#86efac' : '#fca5a5',
                    textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)'
                  }}
                >
                  {players.length >= 3 ? 'Pronto per la battaglia!' : 'Minimo 3 giocatori per avviare'}
                </span>
              </div>

              {/* Lista giocatori: altezza fissa calcolata esattamente per 7 giocatori (il tasto Inizia rimane fermo) */}
              <div
                className="flex flex-col"
                style={{ height: 392 }}
              >
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="px-3 rounded-lg flex items-center justify-between transition-colors hover:bg-white/5"
                    style={{
                      height: 56,
                      backgroundColor: 'transparent',
                      borderBottom: '1.5px solid rgba(255, 255, 255, 0.12)',
                      textShadow: '0 2px 8px rgba(0, 0, 0, 0.95)'
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {p.isBot ? (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: 'rgba(56, 189, 248, 0.15)',
                            border: '1.5px solid rgba(56, 189, 248, 0.5)'
                          }}
                        >
                          <Bot style={{ width: 22, height: 22, color: '#38bdf8' }} />
                        </div>
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            border: '1.5px solid rgba(245, 158, 11, 0.5)'
                          }}
                        >
                          <Users style={{ width: 20, height: 20, color: '#f59e0b' }} />
                        </div>
                      )}
                      <span
                        className="font-extrabold text-slate-100 tracking-wide"
                        style={{ fontSize: 24 }}
                      >
                        {p.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {p.isHost && (
                        <span
                          className="font-bold px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1"
                          style={{
                            fontSize: 14,
                            backgroundColor: 'rgba(217, 119, 6, 0.25)',
                            color: '#fcd34d',
                            border: '1.5px solid #d97706',
                            textShadow: '0 0 8px rgba(245, 158, 11, 0.4)'
                          }}
                        >
                          ★ Capostanza
                        </span>
                      )}
                      {p.isBot && (
                        <span
                          className="font-bold px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5"
                          style={{
                            fontSize: 14,
                            backgroundColor: 'rgba(14, 116, 144, 0.25)',
                            color: '#7dd3fc',
                            border: '1.5px solid #0284c7'
                          }}
                        >
                          <Bot style={{ width: 15, height: 15 }} />
                          IA
                        </span>
                      )}
                      {isHost && p.id !== myId && !p.isHost && (
                        <button
                          type="button"
                          onClick={() => removePlayer(p.id)}
                          className="text-slate-400 hover:text-red-400 hover:scale-110 transition-all cursor-pointer p-1"
                          title={`Togli ${p.name} dalla stanza`}
                        >
                          <Trash2 style={{ width: 20, height: 20 }} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. IMPOSTAZIONI STANZA */}
            <div
              className="py-3 space-y-2.5"
              style={{
                borderTop: '1.5px solid rgba(212, 175, 55, 0.35)',
                borderBottom: '1.5px solid rgba(212, 175, 55, 0.35)',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.95)'
              }}
            >
              {(
                [
                  {
                    key: 'turnTimer' as const,
                    label: 'Tempo per Turno',
                    options: [
                      ['60', '1 Minuto'],
                      ['120', '2 Minuti'],
                      ['off', 'Nessun Limite']
                    ]
                  },
                  {
                    key: 'animSpeed' as const,
                    label: 'Velocità Animazioni',
                    options: [
                      ['normal', 'Normali'],
                      ['fast', 'Veloci']
                    ]
                  }
                ] as const
              ).map((row) => (
                <div key={row.key} className="flex items-center justify-between px-1">
                  <span
                    className="font-bold uppercase tracking-wider"
                    style={{ fontSize: 19, color: '#f1f5f9', letterSpacing: '0.06em' }}
                  >
                    {row.label}
                  </span>
                  <div className="flex items-center gap-2.5">
                    {row.options.map(([value, text]) => {
                      const active = settings[row.key] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={!isHost}
                          onClick={() => updateSettings({ [row.key]: value } as Partial<RoomSettings>)}
                          className={`font-bold px-4 py-1.5 rounded-full transition-all ${
                            active
                              ? 'text-slate-950 font-black scale-105'
                              : isHost
                              ? 'text-slate-300 hover:text-white cursor-pointer bg-white/5 hover:bg-white/10'
                              : 'text-slate-500 bg-transparent'
                          }`}
                          style={{
                            fontSize: 16,
                            background: active
                              ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                              : 'transparent',
                            boxShadow: active ? '0 4px 14px rgba(245, 158, 11, 0.4)' : 'none',
                            border: active ? 'none' : '1.5px solid rgba(255, 255, 255, 0.2)'
                          }}
                        >
                          {text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 4. CONTROLLI DI AVVIO */}
            <div className="flex flex-col gap-2.5 pt-1">
              {isHost && (
                <button
                  type="button"
                  onClick={handleStartGame}
                  disabled={players.length < 3}
                  className={`w-full py-4 rounded-full font-black flex items-center justify-center gap-3 transition-all ${
                    players.length >= 3
                      ? 'text-white cursor-pointer hover:brightness-115 hover:scale-[1.01] active:scale-98'
                      : 'text-slate-400 cursor-not-allowed bg-black/40'
                  }`}
                  style={{
                    fontSize: 24,
                    letterSpacing: '0.06em',
                    background:
                      players.length >= 3
                        ? 'linear-gradient(135deg, #b30000, #e60000)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border: players.length >= 3 ? 'none' : '1.5px solid rgba(255, 255, 255, 0.15)',
                    boxShadow:
                      players.length >= 3
                        ? '0 10px 30px rgba(230, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.9)'
                        : 'none',
                    textShadow: '0 2px 10px rgba(0, 0, 0, 0.95)'
                  }}
                >
                  <Play style={{ width: 26, height: 26 }} fill="currentColor" />
                  <span>
                    {players.length >= 3
                      ? 'INIZIA LA BATTAGLIA!'
                      : `SERVONO ALMENO 3 GIOCATORI (${players.length} / 3)`}
                  </span>
                </button>
              )}

              {!isHost && (
                <div
                  className="text-center font-bold italic py-2"
                  style={{
                    fontSize: 19,
                    color: '#fde68a',
                    textShadow: '0 2px 10px rgba(0, 0, 0, 0.95)'
                  }}
                >
                  In attesa che il capostanza avvii la battaglia...
                </div>
              )}
            </div>
          </div>
        )}

        {/* PULSANTE REGOLAMENTO IN BASSO A DESTRA: SOLO ICONA */}
        <button
          type="button"
          onClick={onOpenRules}
          className="absolute cursor-pointer transition-all duration-200 hover:scale-110 hover:brightness-125 active:scale-95 flex items-center justify-center rounded-full"
          style={{
            right: 80,
            bottom: 65,
            width: 72,
            height: 72,
            backgroundColor: 'rgba(10, 16, 28, 0.75)',
            border: '2px solid rgba(212, 175, 55, 0.65)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.85), 0 0 16px rgba(212, 175, 55, 0.35)',
            zIndex: 50
          }}
          title="Leggi il Regolamento Ufficiale"
        >
          <BookOpen style={{ width: 34, height: 34, color: '#fcd34d' }} />
        </button>
      </div>
    </div>
  );
};
