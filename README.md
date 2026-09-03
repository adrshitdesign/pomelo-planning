# Pomelo-Paradigm — Planning & tickets

Application web de planning et de gestion de tickets. Monorepo npm workspaces :
une API NestJS + Prisma/PostgreSQL, un SPA React/Vite. Le planning est la page
centrale : glisser-déposer, redimensionnement, duplication, sync temps réel.

## Démarrage

```bash
cp .env.example .env          # puis remplacer les secrets
npm install
npm run db:up                 # PostgreSQL via docker compose
npm run db:migrate            # crée la base à partir du schéma Prisma
npm run db:seed               # rôles, permissions, statuts, jeu de démo
npm run dev                   # API :3000 + front :5173
```

Connexion de démonstration : les identifiants sont ceux de `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` dans `.env` (par défaut `admin@pomelo-paradigm.fr` /
`Admin123!` — à changer avant toute mise en ligne).

Documentation API auto-générée (hors production) : <http://localhost:3000/api/docs>

## Structure

```
pomelo-planning/
├─ apps/
│  ├─ api/                    # NestJS
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma     # modèle de données complet
│  │  │  └─ seed.ts           # rôles, permissions, statuts, démo
│  │  └─ src/
│  │     ├─ auth/             # JWT + refresh rotatif, sessions révocables
│  │     ├─ rbac/             # catalogue de permissions, gestion des rôles
│  │     ├─ common/           # guards, décorateurs, types partagés
│  │     ├─ users/ teams/ clients/ statuses/
│  │     ├─ tickets/          # tickets + commentaires
│  │     ├─ events/           # événements (réunion, congé, formation…)
│  │     ├─ planning/         # agrégat ressources + tickets + événements
│  │     ├─ notifications/ audit/ realtime/
│  │     └─ prisma/           # PrismaService
│  └─ web/                    # React + Vite + Tailwind + shadcn/ui
│     └─ src/
│        ├─ features/planning/  # grille, drag & drop, menu contextuel
│        ├─ features/tickets/   # panneau latéral de détail
│        ├─ pages/              # planning, tickets, clients, équipes, admin…
│        ├─ components/ui/      # primitives (button, input, slide-over…)
│        ├─ hooks/              # TanStack Query, temps réel, raccourcis
│        ├─ lib/                # client API, types, permissions, utils
│        └─ styles/tokens.css   # ← charte graphique (voir plus bas)
├─ docker-compose.yml          # PostgreSQL 16
└─ .github/workflows/ci.yml    # generate + validate + typecheck + build
```

## Charte graphique

Les couleurs actuelles (teal / corail / ambre) sont des **placeholders**.
Toute la palette vit dans `apps/web/src/styles/tokens.css` sous forme de
variables CSS ; aucun composant ne code une couleur en dur. Pour appliquer la
charte Pomelo-Paradigm définitive, il suffit de remplacer les valeurs de ce
fichier (`--primary`, `--accent`, `--highlight`, `--category-1..6`…).

Distinction visuelle obligatoire, appliquée partout où un élément de planning
s'affiche : **ticket = bordure gauche pleine colorée**, **événement = bordure
gauche en pointillés** (classes `.planning-item--ticket` / `--event`).

## Sécurité

- Argon2id pour les mots de passe, JWT access court + refresh rotatif ;
  la réutilisation d'un refresh token révoque toutes les sessions du compte.
- Sessions stockées en base et révocables (déconnexion à distance,
  désactivation d'un compte, changement de mot de passe).
- `JwtAuthGuard` puis `PermissionsGuard` sont appliqués **globalement** :
  une route est privée par défaut (`@Public()` pour l'exception) et déclare ses
  permissions atomiques via `@RequirePermissions(...)`.
- Validation systématique des entrées (`class-validator`, `whitelist` +
  `forbidNonWhitelisted`), helmet, CORS restreint aux origines déclarées.
- Aucun `passwordHash` ni donnée sensible renvoyé au frontend.
- Suppression = archivage (`archivedAt`), l'historique est préservé.
- Journal d'audit sur les actions métier et administratives (`AuditLog`).
- Tous les secrets viennent de l'environnement ; `.env` n'est jamais commité.

## Rôles

Trois rôles créés par le seed — `reader`, `editor`, `admin` — composés de
permissions atomiques (`ticket:create`, `planning:move`, `role:manage`…).
Aucun nom de rôle n'est codé en dur dans la logique métier : l'écran
Administration → Rôles & permissions permet d'en créer d'autres et de cocher
les permissions une à une.

## Interactions du planning

La vue **Jour** est une frise horizontale (une ligne par personne, heures en
abscisse, charge par heure) ; les vues **Semaine** et **Mois** sont des grilles.
Les gestes ci-dessous valent dans toutes les vues.

| Geste | Effet |
|---|---|
| Glisser une carte | Déplace la tâche (jour + heure, accroche 30 min) |
| Glisser vers la ligne d'une autre personne | Réassigne la tâche |
| Tirer le bord bas | Change la durée |
| Alt (⌥) / Ctrl / Cmd + glisser | Duplique la tâche — la touche peut être enfoncée avant ou pendant le glisser, un bandeau « Copie » le confirme |
| Clic sur une case vide | Formulaire de création rapide (+ « Détail complet ») |
| Clic droit sur une carte | Dupliquer, changer le statut, assigner, historique, archiver |
| Double-clic | Ouvre le panneau latéral de détail |
| `N` / `T` / `←` `→` / `1` `2` `3` / `Ctrl+Z` | Nouvelle tâche / aujourd'hui / navigation / vue jour-semaine-mois / annuler le dernier déplacement |

Les modifications sont optimistes (la carte bouge avant la réponse serveur,
avec indicateur de synchronisation et restauration en cas d'échec) et
diffusées aux autres sessions via WebSocket.

## Avancement par rapport au brief

MVP (section 9) : **1 à 10 livrés**. Scaffolding, modèle de données,
authentification, RBAC, clients & objets, tickets, planning complet,
événements distincts, recherche/filtres + archivage, synchronisation temps réel.

Sont également présents, en avance sur la phase 2 : notifications, journal
d'audit, tableau de bord d'indicateurs.

Restent à faire (phases 2 et 3) : exports CSV/Excel, notifications email,
intégrations Slack/Teams, pièces jointes S3, recherche globale, vues
personnalisables, PWA/mobile.

## Notes de développement

- `npm run typecheck` exige d'avoir lancé `npx prisma generate` au moins une
  fois (les types du client Prisma sont générés à partir du schéma).
- Le schéma Prisma a été validé ; les migrations sont à générer au premier
  `npm run db:migrate` sur votre machine (aucune migration n'est versionnée
  pour l'instant, la base de référence n'existant pas encore).
