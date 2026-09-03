import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { AuthUser } from '@/lib/types';
import type { PermissionKey } from '@/lib/permissions';

interface AuthState {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<'signed-in' | 'confirm-email'>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  can: (...permissions: PermissionKey[]) => boolean;
}

/** Les réponses d'authentification n'ont pas la même forme que les requêtes. */
function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(translateAuthError(result.error.message));
  return result.data;
}

/** Erreur ou non, la session est nulle tant que la connexion n'a pas abouti. */
type SessionResult = { session: { access_token: string } | null };

function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Adresse email ou mot de passe incorrect',
    'Email not confirmed': 'Adresse email non confirmée — vérifiez votre boîte mail',
    'User already registered': 'Un compte existe déjà avec cette adresse',
    'Password should be at least 6 characters': 'Le mot de passe doit faire au moins 6 caractères',
  };
  return map[message] ?? message;
}

/** Profil + rôles + permissions, en un seul appel à la base. */
async function loadProfile(): Promise<AuthUser | null> {
  const { data, error } = await supabase.rpc('me');
  if (error || !data) return null;
  const profile = data as Omit<AuthUser, 'sessionId'>;
  return { ...profile, sessionId: 'supabase' };
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',
  error: null,

  async login(email, password) {
    set({ error: null });
    try {
      check<SessionResult>(await supabase.auth.signInWithPassword({ email: email.trim(), password }));
      const user = await loadProfile();
      set({ user, status: user ? 'authenticated' : 'anonymous' });
      if (!user) throw new Error('Profil introuvable — contactez un administrateur');
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Connexion impossible' });
      throw error;
    }
  },

  /**
   * Inscription. Le tout premier compte créé devient administrateur (règle
   * posée dans la base). Selon le réglage Supabase, une confirmation par email
   * peut être demandée avant la première connexion.
   */
  async signUp(email, password, name) {
    set({ error: null });
    try {
      const result = check<SessionResult>(
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        }),
      );

      if (!result.session) return 'confirm-email';

      const user = await loadProfile();
      set({ user, status: user ? 'authenticated' : 'anonymous' });
      return 'signed-in';
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Inscription impossible' });
      throw error;
    }
  },

  async logout() {
    await supabase.auth.signOut();
    set({ user: null, status: 'anonymous' });
  },

  async bootstrap() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return set({ user: null, status: 'anonymous' });

    const user = await loadProfile();
    set({ user, status: user ? 'authenticated' : 'anonymous' });
  },

  async refreshProfile() {
    const user = await loadProfile();
    if (user) set({ user });
  },

  can(...permissions) {
    const user = get().user;
    if (!user) return false;
    return permissions.every((p) => user.permissions.includes(p));
  },
}));

// Déconnexion depuis un autre onglet, expiration de session : on suit.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    useAuth.setState({ user: null, status: 'anonymous' });
  }
});
