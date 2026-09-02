/**
 * Client HTTP : l'access token vit en mémoire (jamais dans localStorage), le
 * refresh token est un cookie httpOnly posé par l'API. Un 401 déclenche un
 * refresh silencieux puis un rejeu unique de la requête.
 */
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
const listeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
  listeners.forEach((l) => l(token));
}

export function getAccessToken() {
  return accessToken;
}

export function onTokenChange(listener: (token: string | null) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string };
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      // Laisse le temps aux appels concurrents de récupérer la même promesse.
      setTimeout(() => (refreshPromise = null), 0);
    }
  })();
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  retry?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, retry = true, ...init } = options;

  const url = new URL(`${BASE_URL}/api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers = new Headers(init.headers);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(url.toString(), {
    ...init,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && retry) {
    const token = await refreshAccessToken();
    if (token) return request<T>(path, { ...options, retry: false });
    setAccessToken(null);
  }

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    let details: unknown;
    try {
      const payload = (await res.json()) as { message?: string | string[] };
      details = payload;
      if (payload?.message) {
        message = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
      }
    } catch {
      /* réponse non JSON */
    }
    throw new ApiError(res.status, message, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  refresh: refreshAccessToken,
};
