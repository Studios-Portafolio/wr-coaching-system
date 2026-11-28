import { io } from 'socket.io-client';

const RENDER_URL = 'https://wr-coaching-api.onrender.com';

function resolveServerUrl(): string {
  const envUrl = (import.meta.env.VITE_SERVER_URL || '').trim().replace(/\/+$/, '');
  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
    return envUrl;
  }
  return import.meta.env.PROD ? RENDER_URL : 'http://localhost:4000';
}

const SERVER_URL = resolveServerUrl();

export const socket = io(SERVER_URL, {
  autoConnect: true,
  withCredentials: true,
  transports: ['websocket', 'polling'],
});