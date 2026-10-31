import { io, Socket } from 'socket.io-client';

const URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;

export const socket: Socket = io(URL, {
  autoConnect: true,
  transports: ['websocket', 'polling']
});
