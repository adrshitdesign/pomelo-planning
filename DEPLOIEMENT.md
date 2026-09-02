# Mettre l'application en ligne — guide sans jargon

Ce guide s'adresse à quelqu'un qui n'écrit pas de code et qui n'a **que son
navigateur** (pas d'installation possible sur l'ordinateur).

## Ce que contient ce dossier

L'application est faite de trois morceaux :

| Morceau | À quoi ça sert | Où c'est dans le dossier |
|---|---|---|
| L'écran | Ce que vous voyez et cliquez | `apps/web` |
| Le moteur | Décide qui a le droit de faire quoi, range les infos | `apps/api` |
| La mémoire | Stocke tickets, personnes, clients | une base de données, créée automatiquement |

Un dépôt GitHub sert à **ranger** ce dossier. Pour le **voir fonctionner**, il
faut en plus un endroit qui le fasse tourner. Deux possibilités, toutes les
deux entièrement dans le navigateur.

---

## Étape 1 — Ranger le code sur GitHub

1. Aller sur <https://github.com/new>
2. Nom du dépôt : `pomelo-planning`. Cocher **Private** (personne d'autre ne le
   voit). Ne rien cocher d'autre. Cliquer **Create repository**.
3. Sur la page qui s'affiche, cliquer **uploading an existing file**.
4. Décompresser le zip sur l'ordinateur (clic droit → « Extraire tout » :
   c'est intégré à Windows, rien à installer).
5. Faire glisser le dossier **`apps`** dans la zone de dépôt, attendre la fin,
   puis cliquer **Commit changes**.
6. Recommencer (bouton **Add file → Upload files**) avec le reste : les
   fichiers qui sont directement à la racine du dossier, plus les dossiers
   `.devcontainer` et `.github`.

> GitHub n'accepte que 100 fichiers à la fois, d'où les deux passages.

---

## Étape 2 — Voir l'application tourner

### Possibilité A — Codespaces (le plus simple pour tester)

GitHub prête un ordinateur dans le navigateur. Rien à installer, rien à payer
(60 heures par mois offertes sur un compte personnel).

1. Sur la page du dépôt : bouton vert **Code** → onglet **Codespaces** →
   **Create codespace on main**.
2. Un éditeur s'ouvre dans le navigateur. **Laisser faire pendant 5 à 10
   minutes** : tout s'installe et se prépare tout seul.
3. Quand c'est prêt, une fenêtre d'aperçu s'ouvre. Sinon : onglet **PORTS** en
   bas, ligne « Application » (port 5173), cliquer sur l'icône de globe.
4. Se connecter avec `admin@pomelo-paradigm.fr` / `Admin123!`.

Le lien n'est visible que par vous. Pour arrêter : fermer l'onglet (le
Codespace se met en veille tout seul) ou le supprimer depuis
<https://github.com/codespaces>.

### Possibilité B — Render (une vraie adresse web partageable)

Pour montrer l'application à quelqu'un d'autre, avec un lien qui reste.

1. Créer un compte sur <https://render.com> (connexion possible avec GitHub).
2. **New** → **Blueprint** → choisir le dépôt `pomelo-planning`.
3. Render lit le fichier `render.yaml` et propose de créer l'application et sa
   base de données. Il demande deux valeurs :
   - `SEED_ADMIN_EMAIL` : votre adresse email
   - `SEED_ADMIN_PASSWORD` : le mot de passe du premier compte administrateur
     (10 caractères minimum)
4. **Apply**. Le premier démarrage prend une dizaine de minutes.
5. Render donne une adresse du type `https://pomelo-planning.onrender.com`.

Bon à savoir sur l'offre gratuite : l'application s'endort après 15 minutes
sans visite (le premier chargement suivant prend ~30 secondes), et la base de
données gratuite expire au bout de 30 jours. C'est fait pour tester, pas pour
un usage quotidien réel.

---

## Le premier compte

- Sur Codespaces : `admin@pomelo-paradigm.fr` / `Admin123!` (jeu de
  démonstration avec clients, tickets et événements fictifs).
- Sur Render : l'email et le mot de passe saisis à l'étape 3, sans données de
  démonstration — la base est vide, à remplir depuis l'écran Administration.

Dans les deux cas, ce compte est **administrateur** : il peut créer les
utilisateurs, régler les rôles et les statuts.

---

## Questions fréquentes

**Est-ce que quelqu'un peut tomber dessus par hasard ?**
Le dépôt est privé, le Codespace n'est accessible qu'à vous. Une adresse
Render est publique : n'y mettez pas de vraies données clients tant que c'est
un test.

**Comment mettre à jour l'application plus tard ?**
Remplacer les fichiers modifiés sur GitHub. Render redéploie tout seul ; pour
un Codespace, il suffit d'en recréer un.

**Et la charte graphique Pomelo-Paradigm ?**
Toutes les couleurs sont regroupées dans un seul fichier :
`apps/web/src/styles/tokens.css`. Le jour où la charte est prête, on ne touche
que ce fichier et toute l'application suit.
