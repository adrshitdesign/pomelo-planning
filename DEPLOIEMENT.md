# Mettre l'application en ligne — guide sans jargon

Pour quelqu'un qui n'écrit pas de code et qui n'a que son navigateur.

## Ce que contient ce dossier

L'application est faite de trois morceaux :

| Morceau | À quoi ça sert | Où c'est dans le dossier |
|---|---|---|
| L'écran | Ce que vous voyez et cliquez | `apps/web` |
| Le moteur | Décide qui a le droit de faire quoi, range les infos | `apps/api` |
| La mémoire | Stocke tickets, personnes, clients | une base de données, créée automatiquement |

---

## A. Mettre à jour le dépôt GitHub

Le dossier `apps` contient tout le code de l'application. Pour appliquer une
nouvelle version : sur la page du dépôt, **Add file → Upload files**, glisser le
dossier **`apps`**, puis **Commit changes**. Les fichiers portant le même nom
sont remplacés par les nouveaux.

Les fichiers dont le nom commence par un point (`.devcontainer`, `.github`,
`.gitignore`, `.env.example`) ne changent quasiment jamais. Ils sont déjà sur le
dépôt. Si un jour vous repartez de zéro, leur contenu est recopié en clair dans
le dossier `_fichiers-caches-version-visible`.

---

## B. Savoir si vos modifications sont bien enregistrées

Dans un Codespace, il y a **trois états** successifs, et c'est la source de
confusion la plus fréquente :

1. **Tapé mais pas enregistré** — l'onglet du fichier affiche un rond plein.
   `Cmd + S` enregistre.
2. **Enregistré, mais seulement dans le Codespace** — l'icône en forme
   d'embranchement, dans la colonne d'icônes tout à gauche, porte une pastille
   avec un chiffre : c'est le nombre de fichiers modifiés pas encore envoyés sur
   GitHub.
3. **Envoyé sur GitHub** — la pastille a disparu.

Pour passer de 2 à 3 : cliquer sur l'icône d'embranchement, écrire deux mots
dans la case du haut (par exemple « correction affichage »), cliquer **Commit**,
puis **Sync** (ou « Publish Branch » la première fois).

**Vérification définitive** : ouvrir le dépôt sur github.com et regarder le
fichier concerné. Ce qui est affiché là est la seule version qui compte — c'est
elle qui sera déployée.

> Un Codespace est un ordinateur prêté, temporaire. Tout ce qui n'a pas été
> envoyé sur GitHub disparaît avec lui.

---

## C. Tester dans le navigateur (Codespaces)

1. Page du dépôt → bouton vert **Code** → onglet **Codespaces** →
   **Create codespace on main**.
2. Laisser travailler 5 à 10 minutes : installation et préparation automatiques.
3. Onglet **PORTS** en bas → ligne « Application » (port 5173) → icône de globe
   (« Ouvrir dans le navigateur »).
4. Connexion : `admin@exemple.fr` / `Admin123!`

Données de démonstration incluses (clients, tickets, événements fictifs).
La fenêtre d'aperçu intégrée à l'éditeur (« Navigateur simple ») fonctionne mal :
toujours ouvrir dans un vrai onglet.

---

## D. Mettre en ligne pour de vrai (Render)

Une adresse web permanente, accessible de partout, partageable.

1. Créer un compte sur <https://render.com> (connexion possible avec GitHub).
2. **New** → **Blueprint** → autoriser l'accès au dépôt → choisir
   `pomelo-planning`.
3. Render lit le fichier `render.yaml` et propose de créer l'application et sa
   base de données. Il demande deux valeurs :
   - `SEED_ADMIN_EMAIL` : votre adresse email
   - `SEED_ADMIN_PASSWORD` : le mot de passe du premier compte administrateur
     (10 caractères minimum, à choisir maintenant)
4. **Apply**. Le premier démarrage prend une dizaine de minutes : Render
   installe, compile, crée les tables et crée votre compte.
5. Render affiche une adresse du type `https://pomelo-planning.onrender.com`.

**Ce qui est normal au premier démarrage** : les journaux (« Logs ») défilent
longtemps. L'application est prête quand apparaît « API prête sur le port ».

**Limites de l'offre gratuite**, à connaître avant de montrer ça à quelqu'un :

- l'application s'endort après 15 minutes sans visite ; le réveil prend ~30 s ;
- la base de données gratuite expire au bout de 30 jours ;
- l'adresse est publique : ne pas y mettre de vraies données clients.

Pour un usage quotidien réel, il faudra une offre payante (environ 7 $/mois pour
l'application + 7 $/mois pour la base) ou un hébergement interne.

**Mises à jour** : chaque fois que le dépôt GitHub change, Render redéploie tout
seul en quelques minutes.

---

## Le premier compte

- Codespaces : `admin@exemple.fr` / `Admin123!`, avec données de démo.
- Render : les identifiants saisis à l'étape 3, base vide — tout se crée depuis
  l'écran Administration.

Dans les deux cas ce compte est administrateur : il crée les utilisateurs et
règle les rôles, les équipes et les statuts.

---

## Changer les couleurs

Toute la charte tient dans un seul fichier :
`apps/web/src/styles/tokens.css`. Six lignes marquées ★ suffisent à changer
l'identité complète de l'application. Rien n'est codé en dur ailleurs.
