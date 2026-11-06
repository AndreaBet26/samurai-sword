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
  // Riconnessione automatica e rapida (es. telefono in standby o Wi-Fi che salta)
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  timeout: 10000
});

// --- Sessione salvata nel browser: permette di rientrare in partita dopo un refresh o riapertura del link ---

export interface SavedSession {
  token: string;
  roomCode: string;
}

const SESSION_KEY = 'samurai-sword-session';

export function loadSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.token === 'string' && typeof parsed?.roomCode === 'string') return parsed;
  } catch {
    // Storage non disponibile
  }
  return null;
}

export function saveSession(session: SavedSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignora */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignora */
  }
}

/** Chiede al server di riprendere la sessione salvata (se esiste). */
export function resumeSavedSession() {
  const s = loadSession();
  if (s) socket.emit('resume_session', { token: s.token });
}
