import { create } from 'zustand';
import { api, setAccessToken } from '@/lib/api';
import type { AuthUser } from '@/lib/types';
import type { PermissionKey } from '@/lib/permissions';

interface AuthState {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  can: (...permissions: PermissionKey[]) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',
  error: null,

  async login(email, password) {
    set({ error: null });
    try {
      const { accessToken } = await api.post<{ accessToken: string }>('/auth/login', {
        email,
        password,
      });
      setAccessToken(accessToken);
      const user = await api.get<AuthUser>('/auth/me');
      set({ user, status: 'authenticated' });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Connexion impossible' });
      throw error;
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      set({ user: null, status: 'anonymous' });
    }
  },

  /** Au chargement : tente un refresh silencieux via le cookie httpOnly. */
  async bootstrap() {
    const token = await api.refresh();
    if (!token) return set({ user: null, status: 'anonymous' });
    try {
      const user = await api.get<AuthUser>('/auth/me');
      set({ user, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'anonymous' });
    }
  },

  can(...permissions) {
    const user = get().user;
    if (!user) return false;
    return permissions.every((p) => user.permissions.includes(p));
  },
}));
