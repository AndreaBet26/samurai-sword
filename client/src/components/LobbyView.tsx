import React, { useState, useEffect } from 'react';
import { socket } from '../socket';
import { PlayerPublicState, RoomSettings } from '../../../shared/types';
import { Sword, Users, Bot, Copy, Check, Play, BookOpen, Link2, Trash2 } from 'lucide-react';

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

  useEffect(() => {
    if (playerName.trim()) saveName(playerName.trim());
  }, [playerName]);

  const updateSettings = (patch: Partial<RoomSettings>) => socket.emit('update_settings', patch);
  const removePlayer = (playerId: string) => socket.emit('remove_player', { playerId });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    socket.emit('create_room', { playerName: playerName.trim() || 'Giocatore 1' });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Background Japanese Embellishment */}
      <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center font-jp text-[28vw] leading-none select-none text-red-600">
        侍
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {/* Header Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-950/80 border-2 border-red-600 text-red-500 shadow-xl shadow-red-600/20 mb-3">
            <Sword className="w-9 h-9" />
          </div>
          <h1 className="font-title text-4xl sm:text-5xl font-black text-slate-100 tracking-wider">
            SAMURAI SWORD
          </h1>
          <p className="text-sm text-slate-400 mt-2 font-medium">
            L'epico gioco di carte del Giappone feudale in multiplayer online
          </p>
        </div>

        {notice && !currentRoomCode && <p className="text-center text-sm text-amber-300 mb-4">{notice}</p>}
        {invited && !currentRoomCode && (
          <p className="text-center text-sm text-slate-300 mb-4">
            Sei stato invitato nella stanza <span className="font-mono font-bold text-amber-400">{joinCode}</span>: scrivi il tuo nome e premi Entra.
          </p>
        )}

        {!currentRoomCode ? (
          /* Initial Screen: Create or Join */
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">
                Il tuo Nome Guerriero
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="es. Musashi, Marco, Kenshin..."
                maxLength={20}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <form onSubmit={handleCreate} className="flex flex-col">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl font-title font-bold text-sm bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-xl shadow-red-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sword className="w-4 h-4" />
                  Crea Nuova Stanza
                </button>
              </form>

              <form onSubmit={handleJoin} className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="CODICE"
                    maxLength={6}
                    className="w-28 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-center font-mono font-bold text-amber-400 uppercase tracking-widest focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="flex-1 py-3 px-3 rounded-xl font-title font-bold text-sm bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-amber-400" />
                    Entra
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-center">
              <button
                type="button"
                onClick={onOpenRules}
                className="text-xs text-slate-400 hover:text-amber-400 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                Leggi il Regolamento Ufficiale
              </button>
            </div>
          </div>
        ) : (
          /* Waiting Room Lobby Screen */
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            {/* Room Code Badge */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  Codice Stanza da condividere
                </span>
                <span className="font-mono text-2xl font-black text-amber-400 tracking-widest">
                  {currentRoomCode}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copy(currentRoomCode, 'code')}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Copia il codice della stanza"
                >
                  {copied === 'code' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied === 'code' ? 'Copiato!' : 'Codice'}
                </button>
                <button
                  onClick={() => copy(inviteLink, 'link')}
                  className="py-2 px-3 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-xs font-bold text-slate-950 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Copia il link: chi lo apre entra direttamente nella stanza"
                >
                  {copied === 'link' ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {copied === 'link' ? 'Copiato!' : 'Copia link invito'}
                </button>
              </div>
            </div>

            {/* Players List */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">
                <span>Guerrieri in Attesa ({players.length} / 7)</span>
                <span className="text-slate-500">Minimo 3 giocatori</span>
              </div>

              <div className="space-y-2">
                {players.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{p.isBot ? '🤖' : '👤'}</span>
                      <span className="font-bold text-sm text-slate-200">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.isHost && (
                        <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-700/60 font-bold px-2 py-0.5 rounded-full">
                          Capostanza
                        </span>
                      )}
                      {p.isBot && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          IA
                        </span>
                      )}
                      {isHost && p.id !== myId && !p.isHost && (
                        <button
                          onClick={() => removePlayer(p.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer p-0.5"
                          title={`Togli ${p.name} dalla stanza`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Impostazioni della partita (le sceglie l'host, gli altri le vedono) */}
            <div className="mb-6 space-y-2.5">
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
              ).map(row => (
                <div key={row.key} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">{row.label}</span>
                  <div className="flex items-center gap-1">
                    {row.options.map(([value, text]) => {
                      const active = settings[row.key] === value;
                      return (
                        <button
                          key={value}
                          disabled={!isHost}
                          onClick={() => updateSettings({ [row.key]: value } as Partial<RoomSettings>)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                            active ? 'bg-amber-500 text-slate-950' : isHost ? 'text-slate-400 hover:text-slate-100 cursor-pointer' : 'text-slate-600'
                          }`}
                        >
                          {text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="space-y-3">
              {isHost && (
                <>
                  {players.length < 7 && (
                    <button
                      type="button"
                      onClick={handleAddBot}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Bot className="w-4 h-4 text-blue-400" />
                      Aggiungi Giocatore Bot (IA per test)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleStartGame}
                    disabled={players.length < 3}
                    className={`w-full py-4 px-6 rounded-xl font-title font-bold text-base shadow-xl flex items-center justify-center gap-2 transition-all ${
                      players.length >= 3
                        ? 'bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white shadow-red-600/30 hover:scale-[1.02] cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {players.length >= 3 ? 'Inizia la Battaglia!' : 'Servono almeno 3 giocatori'}
                  </button>
                </>
              )}

              {!isHost && (
                <div className="text-center text-xs text-slate-400 italic py-2">
                  In attesa che il capostanza avvii la partita...
                </div>
              )}

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={onOpenRules}
                  className="text-xs text-slate-400 hover:text-amber-400 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  Regolamento Ufficiale
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
