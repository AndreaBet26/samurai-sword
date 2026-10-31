import { io, Socket } from 'socket.io-client';

const getSocketUrl = (): string => {
  if (window.location.port === '5173' || window.location.port === '3000') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return window.location.origin;
};

export const socket: Socket = io(getSocketUrl(), {
  autoConnect: true,
  transports: ['websocket', 'polling']
});
