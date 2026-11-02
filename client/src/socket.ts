import { io, Socket } from 'socket.io-client';

const getSocketUrl = (): string => {
  if (window.location.port === '5173' || window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return window.location.origin;
};

export const socket: Socket = io(getSocketUrl(), {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  // Riconnessione automatica (es. telefono in standby o Wi-Fi che salta)
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

// --- Sessione salvata nel browser: permette di rientrare in partita dopo un refresh ---

export interface SavedSession {
  token: string;
  roomCode: string;
}

const SESSION_KEY = 'samurai-sword-session';

export function loadSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.token === 'string' && typeof parsed?.roomCode === 'string') return parsed;
  } catch {
    // sessionStorage (una sessione per scheda: puoi aprire più giocatori in più schede) non disponibile (es. impostazioni del browser): si gioca senza rientro automatico
  }
  return null;
}

export function saveSession(session: SavedSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignora */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignora */
  }
}

/** Chiede al server di riprendere la sessione salvata (se esiste). */
export function resumeSavedSession() {
  const s = loadSession();
  if (s) socket.emit('resume_session', { token: s.token });
}
