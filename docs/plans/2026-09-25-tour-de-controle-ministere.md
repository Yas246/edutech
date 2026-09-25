# Plan d'implémentation — Tour de contrôle ministérielle et chaîne examens

## Contexte du dépôt (à lire avant toute tâche)

- Dépôt : `C:\Users\Administrator\Downloads\edutech` (Next.js 16 App Router, TypeScript, Tailwind v4, Drizzle ORM sur Postgres).
- Base locale : conteneur Docker `edutech-db` (port 5433, utilisateur `edutech`, base `edutech`). Commande SQL : `docker exec -i edutech-db psql -U edutech -d edutech`.
- Le serveur de dev tourne sur http://localhost:3000 (ne pas le relancer, il est déjà lancé par l'utilisateur).
- Commandes : `npx tsc --noEmit` (types), `npm run build` (build), `npm run seed` (seed, idempotent), `npm run outils` (150+ vérifications avec vérités recalculées).
- Style de code : server components par défaut, server actions dans `actions.ts` avec la garde `exiger(...)` de `src/lib/auth.ts`. Composants UI dans `src/components/ui/` (EnTetePage, EtatVide, Bouton, champClasse, Alerte). Icônes Tabler uniquement. Vouvoiement partout dans les textes produits. Français correct, pas d'anglicismes d'interface.
- Schéma Drizzle : `src/db/schema.ts`. Après toute modification de schéma : appliquer la colonne à la main en SQL (drizzle-kit push exige un terminal interactif, il échoue en non-TTY), puis vérifier avec un SELECT.
- Interdits ABSOLUS : aucun commit, aucun push, aucune installation npm (aucune nouvelle dépendance n'est nécessaire), aucune bibliothèque de cartes. Les données d'environnement ne se touchent pas.
- Les instruments du coach ministère vivent dans `src/lib/outils/ministere.ts`, enregistrés dans `src/lib/outils/registry.ts` avec leur garde de rôle. Suivre le style existant de ce fichier.

---

## Tâche 0 — Le ministère sort de l'inscription publique

**But** : plus personne ne peut devenir « ministère » depuis le parcours normal. L'arrivée ministérielle passe par une page dédiée à code d'accès.

1. Dans `src/lib/roles.ts`, garder le type `Role` inchangé (ministere reste un rôle), mais exporter une seconde liste `rolesPublics` sans l'entrée ministère. Vérifier où la liste `roles` est rendue (parcours d'inscription / premiers pas) et remplacer par `rolesPublics` à l'affichage uniquement.
2. Nouvelle table (schéma + SQL à la main) :

```ts
export const accesMinistere = pgTable("acces_ministere", {
  code: text("code").primaryKey(),
  organisation: text("organisation").notNull(),
  utilisePar: integer("utilise_par").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

```sql
CREATE TABLE IF NOT EXISTS acces_ministere (
  code text PRIMARY KEY,
  organisation text NOT NULL,
  utilise_par integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
```

3. Page `/acces-ministere` : formulaire (code d'accès, prénom, nom, organisation libre : « Ministère du Numérique », « MESTFP »..., email, mot de passe). Le code valide ouvre la création du compte rôle `ministere` et marque `utilisePar` (un code sert une fois). Échec : message sans dire si le code existe.
4. Lien discret « Accès ministère » en bas de la page `/connexion`.
5. Seed : créer un code de démonstration (préfixe `VMN-`, même alphabet que `src/lib/codes.ts`) et l'afficher dans la sortie console du seed. Le compte `ministere.test` existant reste fonctionnel.

---

## Tâche 1 — L'abandon scolaire (détection, vues, instrument)

**Définition exacte du signal** (terme produit : « présumé en abandon ») :
- L'élève est inscrit dans une classe.
- Sa dernière présence enregistrée (statut `present` ou `retard` ; les `absent`/`absent_justifie` ne comptent pas comme « vu ») date de PLUS de 14 jours calendaires.
- Il a au moins une présence depuis la rentrée (un élève jamais pointé n'est pas un abandon : c'est un silence, on n'affiche rien).
- Sa classe a été pointée au moins 5 jours distincts dans les 14 derniers jours (sinon c'est le professeur qui ne pointe plus, pas l'élève qui a disparu).

Un élève qui remplit tout cela est « présumé en abandon depuis {date de dernière présence} ».

**Fichiers** :
- `src/lib/outils/ministere.ts` : nouvelles fonctions `elevesAbandonnes()` (liste : nom, prénom, sexe, classe, établissement, commune, département, dernière présence, jours d'absence) et `tauxAbandons()` (par département : présomptions, inscrits, taux, ventilation garçons/filles). La requête s'écrit bien en une passe : dernière présence par élève (MAX sur `presences` filtrée sur present/retard) croisée avec le compte de jours d'appel par classe sur 14 jours.
- Page `/ministere/abandons` : KPI en tête (total national, taux, garçons, filles), tableau par département dépliable (clic) : communes, puis écoles, puis élèves. Reprendre la mise en page de `/ministere/indicateurs`.
- `/ministere` : ajouter une carte KPI « présomptions d'abandon » qui pointe vers cette page.
- `src/lib/outils/registry.ts` : enregistrer les deux instruments pour le rôle ministère.
- `scripts/seed.ts` : créer le cas de démonstration. Dans la Seconde A du Lycée Béhanzin (classe id 2) : deux élèves de seed (un garçon, une fille — créer les comptes si besoin) avec des présences `present` jusqu'à J-25, plus RIEN ensuite ; et pour la même classe, des appels complets les 10 derniers jours ouvrés où les AUTRES élèves sont présents. Résultat attendu après seed : 2 présomptions d'abandon au Béhanzin, département Ouémé.
- `scripts/outils.ts` : vérifications avec vérités recalculées indépendamment (le compte attendu d'abandons, la ventilation par sexe).

**Vérification** : `npm run seed` puis `npm run outils` vert ; la page `/ministere/abandons` consultée avec le compte ministère montre les 2 élèves, leurs dates de dernière présence ; une question au coach « où sont les abandons ? » renvoie les chiffres exacts.

---

## Tâche 2 — Les besoins d'enseignement

**Définition** :
- Une matière du programme d'une classe est « non confiée » quand aucune ligne d'`enseignements` ne la relie à un professeur.
- Une matière est « sans cours posé » quand aucun créneau d'emploi du temps ne la porte.
- Les indicateurs par établissement/commune/département : nombre de matières non confiées, nombre de classes avec au moins une matière non confiée, volume hebdomadaire posé (heures de créneaux) par matière.

**Fichiers** :
- `src/lib/outils/ministere.ts` : `besoinsEnseignement()` retournant l'agrégat département → commune → établissement avec le détail matière par matière.
- Page `/ministere/besoins` : hiérarchie département/commune/école, chaque école avec sa liste de matières non confiées et le volume horaire posé. KPI en tête : matières non confiées au total, classes concernées.
- Instrument coach `besoinsEnseignement` enregistré pour le rôle ministère.
- `scripts/outils.ts` : la vérité recalculée doit valider que le Lycée Béhanzin a exactement 4 matières non confiées en Terminale D (Anglais, Histoire-Géographie, SVT, EPS — tel que le seed les pose).

**Vérification** : `/ministere/besoins` montre le Béhanzin avec ses 4 matières ; le coach répond « où manque-t-il des professeurs ? » avec ces chiffres.

---

## Tâche 3 — La carte des départements

**But** : une carte SVG stylisée du Bénin, 12 départements, colorée selon l'indicateur choisi. Aucune bibliothèque : SVG inline.

- Composant serveur `src/components/carte-departements.tsx` : polygones stylisés ci-dessous (viewBox `0 0 320 500`), chaque département est un `<a>` vers la page détail existante du département dans `/ministere/indicateurs`. Le remplissage prend une couleur selon la valeur : une échelle fixe de 5 paliers, du vert (bon) au rouge (alerte), calculée par quintiles simples sur les valeurs présentes.

```
Alibori     : 60,20 200,10 230,60 235,120 210,150 130,155 95,140 55,100
Atacora     : 55,100 95,140 130,155 125,200 90,215 50,190 35,140
Borgou      : 130,155 210,150 220,200 180,245 130,230 125,200
Donga       : 50,190 90,215 130,230 120,265 75,260 40,230
Collines    : 90,255 140,250 200,260 210,300 160,320 100,310
Couffo      : 70,310 100,310 105,355 75,365 55,340
Zou         : 100,310 160,320 165,360 120,375 100,355
Plateau     : 200,260 235,270 240,320 205,345 175,320 180,285
Mono        : 55,340 75,365 95,375 85,410 60,405 40,370
Atlantique  : 95,375 120,375 125,405 110,425 95,410
Littoral    : 110,425 125,405 140,415 130,440 115,438
Ouémé       : 175,320 205,345 195,385 165,410 150,380 155,340
```

(Carte volontairement stylisée : ajuster les points à la main pour la lisibilité, pas la géodésie.)

- Page `/ministere/carte` avec un sélecteur d'indicateur par liens (query param `?indicateur=`) : parité filles/garçons, ratio élèves/enseignant, taux d'abandon (tâche 1), matières non confiées (tâche 2). Légende sous la carte. Entrée depuis `/ministere`.
- Les valeurs viennent des fonctions déjà présentes (`pariteGenre`, `ratioElevesEnseignant`) et des nouvelles (`tauxAbandons`, `besoinsEnseignement`).

**Vérification** : la carte affiche 12 départements, chaque couleur correspond à la valeur, le clic ouvre le détail du département.

---

## Tâche 4 — Les listes de candidature BEPC / BAC

1. État civil : ajouter à `users` (schéma + SQL à la main) :

```ts
dateNaissance: date("date_naissance"),
lieuNaissance: text("lieu_naissance").default("").notNull(),
```

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_naissance DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lieu_naissance TEXT DEFAULT '' NOT NULL;
```

   Champs demandés à l'inscription des élèves (après le choix du rôle) et modifiables dans `/mon-espace`. Le seed remplit dates et lieux plausibles pour tous les élèves de démonstration (beninois réalistes, 2008-2010 pour les terminales).

2. Page `/classes/[id]/candidatures` (garde : direction de l'établissement, délégation vie scolaire, ministère) :
   - Examen déduit du niveau : contient « 3e » ou « troisième » → BEPC ; contient « Terminale » ou « Tle » → BAC ; sinon message « ce niveau ne mène pas à un examen national ».
   - Liste générée : numéro, nom, prénom, sexe (M/F), né(e) le {date} à {lieu}, moyenne générale de la période en cours (reprendre le calcul du bulletin existant dans `src/app/classes/[id]/bulletins/` — factoriser la fonction de moyenne si besoin, ne pas la dupliquer).
   - En-tête imprimable : « Liste de candidature au {BAC 2027} — {établissement} — {classe} — {effectif} candidats ». Bouton Imprimer (même mécanique d'impression que la série de bulletins). Page A4 propre en `@media print`.

**Vérification** : la page sur Terminale D du Béhanzin sort 6 candidats complets avec moyennes ; l'impression est propre ; une classe de niveau non examiné affiche le message.

---

## Tâche 5 — Le passeport scolaire

- Page `/eleves/[id]/passeport` avec gardes : l'élève lui-même, un parent lié (lien famille confirmé), la direction de l'établissement où il est inscrit, le ministère. Personne d'autre.
- Contenu : identité (nom, prénom, sexe, né(e) le, lieu), le parcours année par année (inscriptions avec classes et années scolaires, transferts avec leurs dates et statuts), les moyennes par période et par matière (réutiliser le calcul des bulletins), le total d'absences par année. Mise en page sobre, imprimable (une feuille).
- Point d'entrée : depuis la fiche d'un élève côté direction (liste des apprenants) et depuis `/mon-espace` de l'élève.

**Vérification** : le passeport d'Awa Dossa montre sa Terminale D, ses moyennes, ses absences ; un compte non autorisé reçoit une 404.

---

## Tâche 6 — La box « Connexion avec NPI » sur la page de connexion

Exactement ceci, sans plus (pas de logique, pas de champ stocké) :
- Sur `/connexion`, sous le formulaire email/mot de passe : un séparateur « ou », puis une carte visuellement présente « Connexion avec NPI » avec un champ « NPI » et un bouton désactivé.
- Sous la carte, la mention : « Non fonctionnel pour le moment. »
- Aucun comportement branché : c'est une promesse assumée, l'explication se fait à l'oral devant le jury.

**Vérification** : la box s'affiche sur /connexion, rien n'est cliquable, le formulaire email continue de fonctionner.

---

## Vérifications finales (à faire dans cet ordre)

1. `npx tsc --noEmit` vert.
2. `npm run seed` rejouable sans doublon.
3. `npm run outils` TOUT vert, y compris les nouvelles vérités (abandons, matières non confiées).
4. `npm run build` vert.
5. Revue navigateur sur http://localhost:3000 : compte ministère (abandons, besoins, carte), direction Béhanzin (candidatures, passeport depuis la liste des apprenants), élève Awa (passeport depuis Mon espace, la box NPI sur /connexion).
6. NE PAS COMMITTER. Faire le rapport des tâches terminées et des écrans vérifiés.
