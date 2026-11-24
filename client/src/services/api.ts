import { io, Socket } from 'socket.io-client';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Conexión única de Socket.io para sincronización en tiempo real (ej. pizarra Playbook)
export const socket: Socket = io(API_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

// Helper genérico para peticiones REST
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error ${res.status}: ${errorText || res.statusText}`);
  }

  // Si es 204 No Content, devolver vacío
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Healthcheck
  health: () => request<{ status: string; database: string; service: string }>('/api/health'),

  // 1. Playbook (SavedPlay)
  plays: {
    getAll: () => request<any[]>('/api/plays'),
    create: (data: any) =>
      request<any>('/api/plays', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/api/plays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/plays/${id}`, { method: 'DELETE' }),
  },

  // 2. Scrims (ScrimMatch)
  scrims: {
    getAll: () => request<any[]>('/api/scrims'),
    create: (data: any) =>
      request<any>('/api/scrims', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/api/scrims/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/scrims/${id}`, { method: 'DELETE' }),
  },

  // 3. Scouting (ScoutingProfile)
  scouting: {
    getAll: () => request<any[]>('/api/scouting'),
    create: (data: any) =>
      request<any>('/api/scouting', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/api/scouting/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/scouting/${id}`, { method: 'DELETE' }),
  },

  // 4. Roster / Plantilla (RosterPlayer)
  roster: {
    getAll: () => request<any[]>('/api/roster'),
    create: (data: any) =>
      request<any>('/api/roster', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/api/roster/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/roster/${id}`, { method: 'DELETE' }),
  },

  // 5. VODs (VodNote)
  vods: {
    getAll: () => request<any[]>('/api/vods'),
    create: (data: any) =>
      request<any>('/api/vods', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/api/vods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/vods/${id}`, { method: 'DELETE' }),
  },
};