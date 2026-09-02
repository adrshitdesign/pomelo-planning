import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? window.location.origin;

let socket: Socket | null = null;

/** Connexion unique au namespace /realtime, authentifiée par l'access token. */
export function connectRealtime(): Socket {
  const token = getAccessToken();
  if (socket?.connected) return socket;

  socket?.disconnect();
  socket = io(`${BASE_URL}/realtime`, {
    auth: { token },
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
