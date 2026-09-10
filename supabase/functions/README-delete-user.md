# Déployer le bouton « Supprimer un compte »

Le bouton **Supprimer définitivement** dans Administration → Utilisateurs a besoin
d'une petite fonction serveur chez Supabase. Elle se colle dans le tableau de
bord, **sans terminal**. Cinq minutes, une seule fois.

Tant qu'elle n'est pas déployée, le bouton s'affiche mais renverra une erreur
« fonction introuvable » — c'est normal, il attend cette étape.

---

## Étapes

1. Ouvrir Supabase → projet **planning** → menu de gauche **Edge Functions**.
2. **Create a function** (ou **Deploy a new function** → *Via Editor*).
3. **Nom exact** : `delete-user` (le tiret compte).
4. Effacer le contenu proposé, coller **tout** le contenu du fichier
   `supabase/functions/delete-user/index.ts`.
5. **Deploy**.

C'est tout. La clé secrète dont la fonction a besoin est fournie automatiquement
par Supabase (`SUPABASE_SERVICE_ROLE_KEY`) — rien à copier, rien à régler.

---

## Vérifier

De retour dans l'application, Administration → Utilisateurs → sur une personne
(pas vous-même) → **Supprimer**. Le compte doit disparaître pour de bon.

## Ce que la fonction protège

- Elle ne s'exécute que pour une personne **connectée** et **administratrice**
  (droit `user:manage`) — vérifié côté serveur, impossible à contourner depuis
  le navigateur.
- On ne peut pas supprimer son propre compte.
- La suppression efface le login **et**, en cascade, le profil, les rôles, les
  équipes et les assignations. Les tickets créés par la personne sont conservés,
  leur auteur devient simplement « — ».

> À la différence de **Masquer**, la suppression est **définitive**. Pour un
> départ temporaire ou par prudence, préférez Masquer, qui est réversible.
