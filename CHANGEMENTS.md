# Ce qui a changé dans cette version

⚠️ **Avant tout : lancer `supabase/migrations/002-types-de-mission-et-etiquettes.sql`**
dans Supabase → SQL Editor → New query → Run. Sans ça, les nouveautés
ci-dessous n'ont pas de quoi fonctionner et l'application affichera des erreurs.

## 1. Les objets deviennent des types de mission

Un objet ne dépend plus d'un client : c'est la **nature du travail** — calage,
montage, contrôle des livrables, corrections, exécution. Créé une fois, il est
proposé pour tous les clients.

- **Administration → Types de mission** : créer, renommer, recolorer, archiver.
- **Les éditeurs y ont accès**, plus seulement les administrateurs. Ils peuvent
  aussi créer des clients.
- Un type peut malgré tout être **réservé à un client** si c'est une mission
  qui n'existe que chez lui. Dans ce cas, choisir ce type impose ce client.
- Les objets déjà créés pour un client restent en place, sous
  « Réservés à un client ». Rien n'est perdu.

Cinq types sont créés d'office : calage, montage, contrôle des livrables,
corrections, exécution. À renommer ou compléter selon vos habitudes.

## 2. Le planning suit le temps réel

Dès qu'un temps réel est saisi sur un ticket, **c'est lui qui commande la taille
du bloc dans le planning**. Une tâche prévue 4 h mais faite en 3 h n'occupe plus
que 3 h : la charge affichée devient la charge vraie.

La mention « réel » apparaît sous l'horaire de la carte. Le temps estimé reste
visible dans le détail du ticket, pour la comparaison.

Si on étire un bloc dont le temps réel est déjà saisi, c'est ce temps réel qu'on
corrige — le geste et le chiffre restent cohérents.

## 3. Étiquettes colorées

Une étiquette, c'est **une couleur qui veut dire quelque chose**.

- **Administration → Étiquettes** : nom, couleur, courte explication.
  Accessible aux éditeurs comme aux administrateurs.
- On en pose autant qu'on veut sur un ticket, depuis son panneau de détail.
- Elles apparaissent sous forme de petits traits colorés sur la carte du
  planning, et la première donne sa couleur au bloc.
- Elles servent de filtre sur le planning.

Quatre étiquettes de départ : Urgent client, Relecture, À refacturer, Interne.

## 4. Les cartes du planning en disent plus

Sur chaque carte, sans avoir à l'ouvrir :

- une **pastille de couleur du statut** devant le titre ;
- **client · type de mission** en dessous ;
- **!!** pour une tâche urgente, **!** pour une priorité haute ;
- les horaires, avec la mention « réel » le cas échéant ;
- les traits colorés des étiquettes.

## 5. Filtres du planning

La barre du planning permet maintenant de filtrer par **équipe, personne,
client, type de mission, statut, priorité, étiquette**, et de n'afficher que les
tâches **sans personne assignée**.

Le nombre de filtres actifs s'affiche, avec un bouton pour tout effacer d'un
coup. Choisir un client restreint automatiquement la liste des types de mission.

## 6. Tableau de bord de pilotage

Quatre questions, dans cet ordre.

**Ce qui demande une décision** — en retard, sans personne, non planifiées,
terminées sans temps réel saisi. Les cinq premiers retards sont listés
nommément.

**Taux d'occupation** — par personne, heures posées rapportées aux heures
ouvrées de la période (base 7 h/jour). Au-delà de 100 %, la barre passe en
orange : la personne a plus de travail posé que d'heures disponibles.

**Estimé face au réel** — par personne, par client et par type de mission, sur
les seules tâches dont le temps réel a été saisi. Trié par écart décroissant :
la première ligne est celle où l'estimation dérape le plus. Vert quand on tient,
orange quand on dépasse de plus de 15 %.

**Où part le temps** — répartition des heures par client et par type de mission,
en heures et en pourcentage.

Une liste déroulante permet de basculer entre **la semaine, le mois et le
trimestre**.

## 7. Le nom Pomelo-Paradigm a été retiré

C'est une marque déposée et l'application est en test : elle s'appelle
simplement **« Planning »** partout — titre de l'onglet, écran de connexion,
bandeau latéral, documentation. Les adresses email d'exemple ne mentionnent plus
le studio non plus.

---

## Rappel des versions précédentes

- Le **client se choisit directement sur un ticket**, le type de mission étant
  facultatif (mise à jour `001`).
- Vue **journée en frise horizontale**, une ligne par personne.
- **Alt + glisser** pour dupliquer une tâche.
- Hébergement : écran sur GitHub Pages, base et comptes chez Supabase.
