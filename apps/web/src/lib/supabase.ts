import { createClient } from '@supabase/supabase-js';

/**
 * Connexion à Supabase. Les deux valeurs viennent de l'environnement de
 * compilation : Project URL et clé « anon » (publique par conception — elle
 * n'ouvre que ce que les règles d'accès de la base autorisent).
 */
const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    'Supabase non configuré : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Remonte une erreur Supabase sous forme lisible en français. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(translate(result.error.message));
  return result.data as T;
}

function translate(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Identifiants invalides',
    'Email not confirmed': 'Adresse email non confirmée — vérifiez votre boîte mail',
    'User already registered': 'Un compte existe déjà avec cette adresse',
  };
  if (map[message]) return map[message];
  if (message.includes('row-level security') || message.includes('violates row-level')) {
    return "Vous n'avez pas les droits nécessaires pour cette action";
  }
  if (message.includes('duplicate key')) return 'Cet élément existe déjà';
  return message;
}
