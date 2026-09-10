// ===========================================================================
// Fonction serveur « delete-user »
// ---------------------------------------------------------------------------
// Supprime DÉFINITIVEMENT un compte : le login et tout ce qui lui est rattaché.
//
// Pourquoi une fonction serveur ? Effacer un login exige la clé secrète
// (service_role), qui ne doit JAMAIS se trouver dans le code du site. Elle ne
// vit qu'ici, côté serveur, hors de portée du navigateur.
//
// Garde-fous : l'appelant doit être connecté ET avoir le droit « user:manage »
// (administrateur). On ne peut pas se supprimer soi-même.
//
// Déploiement : voir supabase/functions/README-delete-user.md
// ===========================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Non authentifié.' });

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Client « au nom de l'appelant » : pour savoir qui il est.
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await caller.auth.getUser();
    const callerId = userData?.user?.id;
    if (!callerId) return json(401, { error: 'Session invalide.' });

    // 2. Vérifier ses droits, tels que la base les connaît.
    const { data: perms, error: permError } = await caller.rpc('current_permissions');
    if (permError) return json(500, { error: permError.message });
    if (!Array.isArray(perms) || !perms.includes('user:manage')) {
      return json(403, { error: "Vous n'avez pas le droit de supprimer un compte." });
    }

    // 3. La cible.
    const { userId } = await req.json().catch(() => ({ userId: null }));
    if (!userId || typeof userId !== 'string') {
      return json(400, { error: 'Compte à supprimer non précisé.' });
    }
    if (userId === callerId) {
      return json(400, { error: 'On ne peut pas supprimer son propre compte.' });
    }

    // 4. La suppression elle-même : la seule opération qui exige la clé secrète.
    //    Elle efface le login ; la base efface en cascade profil, rôles,
    //    équipes et assignations.
    const admin = createClient(url, serviceKey);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json(400, { error: error.message });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
