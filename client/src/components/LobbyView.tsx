import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import { PlayerPublicState, RoomSettings } from '../../../shared/types';
import { Users, Bot, Copy, Check, Play, BookOpen, Link2, Trash2 } from 'lucide-react';

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

  // Math.max assicura che l'immagine riempia il 100% della pagina (cover edge-to-edge, zero barre nere)
  const [scale, setScale] = useState(() =>
    Math.max(window.innerWidth / 3840, window.innerHeight / 2160)
  );

  useEffect(() => {
    const updateScale = () => {
      setScale(Math.max(window.innerWidth / 3840, window.innerHeight / 2160));
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
      className="fixed inset-0 overflow-hidden select-none animate-fadeIn flex items-center justify-center bg-black"
      style={{
        backgroundImage:
          'url(/assets/ui/lobby_background_4k.webp), url(/assets/ui/lobby_background_4k.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Canvas 4K (3840 x 2160) scalato con Math.max per coprire l'intero schermo senza alcuna barra nera */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{
          width: 3840,
          height: 2160,
          backgroundImage:
            'url(/assets/ui/lobby_background_4k.webp), url(/assets/ui/lobby_background_4k.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
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
                className="text-center font-bold text-amber-300 bg-amber-950/80 border border-amber-500/80 rounded-xl py-2 px-4 mb-3 shadow-lg"
                style={{ fontSize: 18 }}
              >
                {notice}
              </div>
            )}
            {invited && (
              <div
                className="text-center font-bold text-sky-200 bg-sky-950/80 border border-sky-500/80 rounded-xl py-2 px-4 mb-3 shadow-lg"
                style={{ fontSize: 18 }}
              >
                Sei stato invitato nella stanza <span className="font-mono font-black text-amber-400">{joinCode}</span>: inserisci il tuo nome e premi ENTRA.
              </div>
            )}

            {/* SEZIONE INPUT NOME */}
            <div className="flex flex-col">
              {/* Etichetta: IL TUO NOME GUERRIERO */}
              <label
                htmlFor="input-player-name"
                className="font-black uppercase tracking-wider mb-2.5"
                style={{
                  fontSize: 22,
                  color: '#e2e8f0',
                  letterSpacing: '0.1em',
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.95), 0 0 15px rgba(0, 0, 0, 0.8)'
                }}
              >
                IL TUO NOME GUERRIERO
              </label>

              {/* Campo di Inserimento (Input Text) */}
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
                  height: 72,
                  backgroundColor: 'rgba(5, 8, 15, 0.75)',
                  border: '1.5px solid #2b4c7e',
                  borderRadius: 16,
                  color: '#fdf8e2',
                  fontSize: 26,
                  fontWeight: 600,
                  paddingLeft: 24,
                  paddingRight: 24,
                  outline: 'none',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.75), inset 0 2px 6px rgba(0, 0, 0, 0.6)',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#f59e0b';
                  e.currentTarget.style.boxShadow = '0 0 18px rgba(245, 158, 11, 0.4)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#2b4c7e';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.75), inset 0 2px 6px rgba(0, 0, 0, 0.6)';
                }}
              />
            </div>

            {/* SEZIONE PULSANTI DI GIOCO (Allineati orizzontalmente) */}
            <div
              className="flex items-center justify-between"
              style={{
                width: 780,
                marginTop: 36
              }}
            >
              {/* Pulsante: CREA NUOVA STANZA */}
              <button
                type="button"
                onClick={() => handleCreate()}
                className="flex items-center justify-center font-bold text-white transition-all duration-200 cursor-pointer hover:brightness-115 active:scale-95"
                style={{
                  width: 270,
                  height: 68,
                  background: 'linear-gradient(to right, #b30000, #e60000)',
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  fontSize: 18,
                  letterSpacing: '0.04em',
                  gap: 10,
                  boxShadow: '0 8px 24px rgba(230, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.8)'
                }}
              >
                <img
                  src="/assets/icons/sword_white.webp"
                  alt=""
                  style={{ width: 22, height: 22, objectFit: 'contain' }}
                />
                <span>CREA NUOVA STANZA</span>
              </button>

              {/* Input Codice: CODICE */}
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
                  width: 180,
                  height: 68,
                  backgroundColor: 'rgba(10, 16, 28, 0.85)',
                  border: '1.5px solid #3a4a63',
                  borderRadius: 16,
                  color: '#f6ad55',
                  fontSize: 22,
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  outline: 'none',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.7)',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#f59e0b';
                  e.currentTarget.style.boxShadow = '0 0 16px rgba(245, 158, 11, 0.4)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#3a4a63';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.7)';
                }}
              />

              {/* Pulsante: ENTRA */}
              <button
                type="button"
                onClick={() => handleJoin()}
                className="flex items-center justify-center font-bold text-white transition-all duration-200 cursor-pointer hover:bg-[#1a273f] hover:border-amber-300 active:scale-95"
                style={{
                  width: 270,
                  height: 68,
                  backgroundColor: 'rgba(20, 29, 47, 0.92)',
                  border: '1.5px solid #d69e2e',
                  borderRadius: 16,
                  fontSize: 18,
                  letterSpacing: '0.04em',
                  gap: 10,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 15px rgba(214, 158, 46, 0.25)'
                }}
              >
                <Users style={{ width: 22, height: 22, color: '#f6ad55' }} />
                <span>ENTRA</span>
              </button>
            </div>

            {/* SEZIONE LINK INFORMATIVO IN BASSO */}
            <div className="flex justify-center" style={{ marginTop: 44 }}>
              <button
                type="button"
                onClick={onOpenRules}
                className="font-bold transition-all cursor-pointer hover:text-amber-300 hover:underline flex items-center gap-2"
                style={{
                  fontSize: 20,
                  color: '#cbd5e1',
                  letterSpacing: '0.04em',
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.95), 0 0 15px rgba(0, 0, 0, 0.8)'
                }}
              >
                <BookOpen style={{ width: 22, height: 22 }} />
                <span>Leggi il Regolamento Ufficiale</span>
              </button>
            </div>
          </div>
        ) : (
          /* ===================== STANZA DI ATTESA (SALA D'ATTESA LOBBY) ===================== */
          <div
            className="absolute flex flex-col justify-between"
            style={{
              left: 1440,
              top: 860,
              width: 960,
              height: 780,
              backgroundColor: 'rgba(10, 15, 25, 0.88)',
              border: '1px solid #1a2c42',
              borderRadius: 24,
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 45px rgba(26, 44, 66, 0.35)',
              backdropFilter: 'blur(12px)',
              padding: '35px 40px'
            }}
          >
            {/* Header Stanza & Condivisione */}
            <div
              className="flex items-center justify-between p-4 rounded-2xl"
              style={{ backgroundColor: '#05080f', border: '1px solid #1f3a60' }}
            >
              <div>
                <span
                  className="uppercase font-bold block"
                  style={{ fontSize: 13, color: '#a0aec0', letterSpacing: '0.08em' }}
                >
                  CODICE STANZA DA CONDIVIDERE
                </span>
                <span
                  className="font-mono font-black text-amber-400 tracking-widest"
                  style={{ fontSize: 32 }}
                >
                  {currentRoomCode}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => copy(currentRoomCode, 'code')}
                  className="px-4 py-2.5 rounded-xl font-semibold text-slate-200 transition-all flex items-center gap-2 cursor-pointer hover:bg-slate-700 active:scale-95"
                  style={{ backgroundColor: '#1a273f', border: '1px solid #2d3748', fontSize: 16 }}
                  title="Copia il codice della stanza"
                >
                  {copied === 'code' ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  <span>{copied === 'code' ? 'Copiato!' : 'Codice'}</span>
                </button>
                <button
                  onClick={() => copy(inviteLink, 'link')}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-950 transition-all flex items-center gap-2 cursor-pointer hover:brightness-110 active:scale-95"
                  style={{
                    background: 'linear-gradient(to right, #d97706, #f59e0b)',
                    fontSize: 16,
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
                  }}
                  title="Copia il link d'invito online diretto"
                >
                  {copied === 'link' ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}
                  <span>{copied === 'link' ? 'Copiato!' : 'Copia link invito'}</span>
                </button>
              </div>
            </div>

            {/* Lista Guerrieri in Attesa */}
            <div className="flex flex-col flex-1 my-3 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="font-bold uppercase tracking-wider"
                  style={{ fontSize: 14, color: '#a0aec0' }}
                >
                  Guerrieri in Attesa ({players.length} / 7)
                </span>
                <span style={{ fontSize: 13, color: '#718096' }}>
                  Minimo 3 giocatori per avviare
                </span>
              </div>

              <div
                className="space-y-2 overflow-y-auto pr-1"
                style={{ maxHeight: 220 }}
              >
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl flex items-center justify-between"
                    style={{ backgroundColor: 'rgba(5, 8, 15, 0.7)', border: '1px solid #1a2c42' }}
                  >
                    <div className="flex items-center gap-3">
                      {p.isBot ? (
                        <Bot className="w-6 h-6 text-sky-400" />
                      ) : (
                        <Users className="w-6 h-6 text-amber-400" />
                      )}
                      <span className="font-bold text-slate-100" style={{ fontSize: 18 }}>
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.isHost && (
                        <span
                          className="font-bold px-3 py-0.5 rounded-full"
                          style={{
                            fontSize: 12,
                            backgroundColor: 'rgba(120, 53, 15, 0.6)',
                            color: '#fcd34d',
                            border: '1px solid #b45309'
                          }}
                        >
                          Capostanza
                        </span>
                      )}
                      {p.isBot && (
                        <span
                          className="font-semibold px-3 py-0.5 rounded-full flex items-center gap-1"
                          style={{
                            fontSize: 12,
                            backgroundColor: 'rgba(30, 41, 59, 0.8)',
                            color: '#94a3b8',
                            border: '1px solid #475569'
                          }}
                        >
                          <Bot className="w-3.5 h-3.5" />
                          IA
                        </span>
                      )}
                      {isHost && p.id !== myId && !p.isHost && (
                        <button
                          onClick={() => removePlayer(p.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer p-1"
                          title={`Togli ${p.name} dalla stanza`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Impostazioni Stanza */}
            <div
              className="p-3 rounded-xl mb-3 space-y-2"
              style={{ backgroundColor: 'rgba(5, 8, 15, 0.6)', border: '1px solid #1a2c42' }}
            >
              {(
                [
                  {
                    key: 'turnTimer' as const,
                    label: 'Tempo per turno',
                    options: [
                      ['60', '1 minuto'],
                      ['120', '2 minuti'],
                      ['off', 'Nessun limite']
                    ]
                  },
                  {
                    key: 'animSpeed' as const,
                    label: 'Animazioni',
                    options: [
                      ['normal', 'Normali'],
                      ['fast', 'Veloci']
                    ]
                  }
                ] as const
              ).map((row) => (
                <div key={row.key} className="flex items-center justify-between">
                  <span
                    className="font-bold uppercase tracking-wider"
                    style={{ fontSize: 13, color: '#a0aec0' }}
                  >
                    {row.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {row.options.map(([value, text]) => {
                      const active = settings[row.key] === value;
                      return (
                        <button
                          key={value}
                          disabled={!isHost}
                          onClick={() => updateSettings({ [row.key]: value } as Partial<RoomSettings>)}
                          className={`font-semibold px-3 py-1 rounded-lg transition-colors ${
                            active
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : isHost
                              ? 'text-slate-400 hover:text-slate-100 cursor-pointer bg-slate-900 border border-slate-800'
                              : 'text-slate-600 bg-slate-950'
                          }`}
                          style={{ fontSize: 13 }}
                        >
                          {text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Controlli di Avvio */}
            <div className="flex flex-col gap-2.5">
              {isHost && (
                <>
                  {players.length < 7 && (
                    <button
                      type="button"
                      onClick={handleAddBot}
                      className="w-full py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-700 active:scale-98"
                      style={{
                        backgroundColor: '#1a273f',
                        border: '1px solid #2d3748',
                        color: '#cbd5e1',
                        fontSize: 15
                      }}
                    >
                      <Bot className="w-5 h-5 text-sky-400" />
                      <span>Aggiungi Giocatore Bot (IA)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleStartGame}
                    disabled={players.length < 3}
                    className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all ${
                      players.length >= 3
                        ? 'text-white shadow-xl hover:scale-[1.01] active:scale-98 cursor-pointer'
                        : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                    }`}
                    style={{
                      background:
                        players.length >= 3 ? 'linear-gradient(to right, #b30000, #e60000)' : undefined,
                      boxShadow: players.length >= 3 ? '0 6px 22px rgba(230, 0, 0, 0.45)' : undefined,
                      fontSize: 18
                    }}
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{players.length >= 3 ? 'Inizia la Battaglia!' : 'Servono almeno 3 giocatori'}</span>
                  </button>
                </>
              )}

              {!isHost && (
                <div
                  className="text-center font-medium italic py-2"
                  style={{ fontSize: 15, color: '#a0aec0' }}
                >
                  In attesa che il capostanza avvii la partita...
                </div>
              )}

              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={onOpenRules}
                  className="font-semibold text-slate-400 hover:text-amber-400 hover:underline flex items-center gap-2 transition-colors cursor-pointer"
                  style={{ fontSize: 15 }}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Leggi il Regolamento Ufficiale</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
