# Ce qui a changé dans cette version

## 1. L'application passe sur Supabase et GitHub Pages

C'est le gros changement. Jusqu'ici l'application avait besoin d'un serveur
allumé quelque part. Maintenant :

- **l'écran** est un site figé, hébergé gratuitement par GitHub Pages ;
- **la base de données et les comptes** sont chez Supabase ;
- l'écran parle directement à la base, sans intermédiaire.

Conséquence : plus rien à héberger soi-même, une adresse permanente, et les
données partagées par toute l'équipe.

Le programme NestJS de `apps/api` **ne sert plus** pour la version en ligne. Il
reste dans le dossier, dormant. Les vérifications de droits qu'il assurait sont
maintenant écrites dans la base elle-même : chaque table refuse ce que la
personne connectée n'a pas le droit de faire, quoi qu'envoie le navigateur.
C'est une garantie plus forte qu'avant, parce qu'elle ne dépend plus du code de
l'écran.

**Marche à suivre complète dans `METTRE-EN-LIGNE.md`.** Comptez 20 minutes.

### Ce qui change dans l'usage

- **Création des comptes** : chacun crée le sien depuis l'écran de connexion,
  onglet « Créer un compte ». L'administrateur attribue ensuite le rôle et
  l'équipe depuis Administration. Sans rôle, une personne ne voit rien.
- **Le premier compte créé devient automatiquement administrateur.**
- Les mots de passe sont gérés par Supabase — l'application n'y a jamais accès.

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `supabase/schema.sql` | Toutes les tables, les règles d'accès, les déclencheurs |
| `supabase/seed.sql` | Permissions, rôles, statuts et équipes de départ |
| `METTRE-EN-LIGNE.md` | Le guide, étape par étape |
| `.github/workflows/deploy.yml` | Publication automatique à chaque modification |

Le journal d'audit et les notifications d'assignation sont désormais écrits
directement par la base, automatiquement.

## 2. Nouvelle vue « journée » en frise horizontale

La vue **Jour** ne ressemble plus à la vue semaine en plus étroit : c'est une
frise horizontale, une ligne par personne, les heures en abscisse — la lecture
d'un planning d'atelier.

- Colonne de gauche : photo, nom, **total d'heures planifiées** de la journée.
- Bandeau du haut : total pour l'ensemble affiché, et une ligne **« Personnes
  planifiées »** qui compte heure par heure combien de personnes sont occupées.
  C'est ce qui fait apparaître les trous de charge.
- Trait vertical orange à l'heure courante.
- Regroupement **par équipe** : une section par équipe. Une personne présente
  dans deux équipes apparaît deux fois mais n'est comptée qu'une fois dans les
  totaux.
- Mêmes gestes que dans les autres vues : glisser pour décaler, glisser sur la
  ligne d'un collègue pour réassigner, tirer le bord droit pour la durée,
  Alt + glisser pour dupliquer, clic sur une case vide pour créer.

Heures de 00 h à 23 h avec défilement, cadré sur 07 h au chargement, heures
hors 7 h – 19 h grisées.

## 3. La duplication fonctionne

**Avant** : la touche n'était lue qu'au tout début du glisser. Comme on appuie
presque toujours dessus *après* avoir commencé à déplacer la carte, la
duplication ne se déclenchait jamais.

**Maintenant** : la touche est surveillée en permanence. Trois touches
acceptées — **Alt (⌥)**, **Ctrl** ou **Cmd**. Sur Mac, préférer **Alt** :
Ctrl + clic y ouvre le menu contextuel du système. Un bandeau **« Copie —
relâchez pour dupliquer »** confirme que c'est actif.

## 4. Le design reprend l'esprit Pomdoc

Bleu marine institutionnel, corail « pomelo » en accent, neutres froids.
Navigation latérale en bandeau sombre, écran de connexion en deux colonnes.

⚠️ Les codes couleur exacts de Pomdoc n'ont pas pu être récupérés depuis le
site : la palette est une approximation. Pour la caler précisément, ouvrir
`apps/web/src/styles/tokens.css` et remplacer les six valeurs marquées ★.

## 5. Corrections d'affichage

- Les heures de la colonne de gauche étaient décalées d'une ligne par rapport
  aux jours : aligné.
- Grille de la vue semaine resserrée : deux à trois personnes visibles au lieu
  d'une seule.
- Dates en minuscules correctes (« Semaine du 2 septembre »).
- Écran blanc sur une adresse Codespaces : le serveur de développement refusait
  les noms de domaine inconnus, ils sont maintenant autorisés.
