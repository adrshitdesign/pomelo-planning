# Mettre l'application en ligne — guide pas à pas

Résultat visé : une adresse permanente et gratuite, du type
`https://adrshitdesign.github.io/pomelo-planning/`, accessible depuis n'importe
quel navigateur, avec une vraie base de données partagée par toute l'équipe.

Le montage est le même que pour vos autres projets en ligne :

| Morceau | Qui l'héberge | Coût |
|---|---|---|
| L'écran (ce que vous voyez) | GitHub Pages | gratuit |
| La base de données + les comptes | Supabase | gratuit jusqu'à 500 Mo |

Le programme NestJS présent dans `apps/api` **ne sert plus** pour la version en
ligne : c'est la base de données qui vérifie elle-même les droits. Il reste dans
le dossier, dormant, au cas où.

Comptez 20 minutes la première fois. Tout se fait dans le navigateur.

---

## Étape 1 — Créer le projet Supabase

1. Aller sur <https://supabase.com>, créer un compte (connexion possible avec
   GitHub).
2. **New project**. Renseigner :
   - **Name** : `pomelo-planning`
   - **Database password** : cliquer sur *Generate* et **conserver ce mot de
     passe** dans votre gestionnaire — il ne sera plus affiché. Vous n'en aurez
     pas besoin pour l'application, seulement pour un accès direct à la base.
   - **Region** : `Europe (Paris)` ou `Europe (Frankfurt)`.
3. **Create new project**, puis patienter deux minutes pendant la mise en route.

## Étape 2 — Créer les tables

1. Dans le menu de gauche : **SQL Editor** → **New query**.
2. Ouvrir le fichier `supabase/schema.sql` du dossier du projet, copier **tout**
   son contenu, le coller dans l'éditeur, cliquer **Run**.
   → Le message attendu est « Success. No rows returned ».
3. Recommencer avec `supabase/seed.sql` (permissions, rôles, statuts, équipes).

Ces deux scripts peuvent être relancés sans risque : ils ne suppriment rien.

## Étape 3 — Régler l'authentification

Menu **Authentication** → **Providers** → **Email** :

- **Confirm email** : à décider.
  - *Désactivé* (recommandé pour démarrer) : on peut se connecter dès
    l'inscription. Plus simple pour un outil interne.
  - *Activé* : chaque inscription envoie un email de confirmation à cliquer.
- Laisser **Enable email provider** activé.

Menu **Authentication** → **URL Configuration** :

- **Site URL** : `https://<votre-compte>.github.io/pomelo-planning/`
- **Redirect URLs** : ajouter la même adresse.

## Étape 4 — Récupérer les deux valeurs à donner à l'application

Menu **Project Settings** (roue dentée) → **API**. Noter :

- **Project URL** — du type `https://abcdefgh.supabase.co`
- **anon public** — une longue clé commençant par `eyJ...`

> La clé « anon » est **conçue pour être publique** : elle est visible dans le
> code du site, et n'ouvre que ce que les règles de la base autorisent.
> En revanche, la clé **`service_role`**, juste en dessous, ne doit **jamais**
> quitter Supabase : elle contourne toutes les règles.

## Étape 5 — Donner ces valeurs à GitHub

Sur la page du dépôt : **Settings** → **Secrets and variables** → **Actions** →
onglet **Variables** → **New repository variable**. Créer les deux :

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | l'adresse notée à l'étape 4 |
| `VITE_SUPABASE_ANON_KEY` | la clé « anon » |

## Étape 6 — Activer GitHub Pages

**Settings** → **Pages** → **Build and deployment** → **Source** :
choisir **GitHub Actions**.

## Étape 7 — Lancer le déploiement

Onglet **Actions** → workflow **Déployer sur GitHub Pages** → **Run workflow**.
(Il se relance ensuite tout seul à chaque modification du dépôt.)

Au bout de deux à trois minutes, une coche verte apparaît, et l'adresse du site
s'affiche dans **Settings** → **Pages**.

## Étape 8 — Créer le premier compte

1. Ouvrir l'adresse du site.
2. Onglet **Créer un compte**, renseigner nom, email, mot de passe.
3. **Le tout premier compte créé devient automatiquement administrateur.**
   Les suivants sont créés en simple lecteur — c'est à vous, depuis
   Administration → Utilisateurs, de leur attribuer un rôle.

---

## Ajouter un collègue

1. Il ouvre l'adresse du site et crée son compte lui-même.
2. Vous allez dans **Administration → Utilisateurs**, vous lui donnez un rôle
   (Lecteur, Éditeur ou Administrateur) et une équipe.

Sans rôle, une personne connectée ne voit rien : c'est voulu.

---

## Points de vigilance

**L'adresse du site est publique.** N'importe qui connaissant le lien voit
l'écran de connexion — mais rien de plus sans compte. Si vous voulez fermer les
inscriptions une fois l'équipe en place : Supabase → **Authentication** →
**Providers** → **Email** → désactiver **Allow new users to sign up**.

**Le quota gratuit Supabase** couvre largement l'usage visé (500 Mo de base,
50 000 personnes connectées par mois). Un projet gratuit se met en pause après
une semaine sans aucune activité ; un simple passage sur le site le réveille.

**Sauvegardes** : Supabase → Database → Backups. Sur l'offre gratuite, pensez à
exporter la base de temps en temps si les données deviennent importantes.

---

## Et pour développer en local ?

Créer un fichier `apps/web/.env.local` (jamais partagé) contenant :

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

puis `npm install` et `npm run dev --workspace @pomelo/web`. L'application
locale parle alors à la même base que le site en ligne : attention à ne pas
mélanger essais et vraies données.
