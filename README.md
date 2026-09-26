# EduTech, l'écosystème numérique de l'école béninoise

**Site en ligne :** [edutech.qualris.com](https://edutech.qualris.com)
**Code source :** [github.com/Yas246/edutech](https://github.com/Yas246/edutech)

EduTech n'est pas un portail administratif de plus. C'est un écosystème où
chaque acteur de l'école (élève, parent, enseignant, établissement,
ministère) trouve un service qui lui rend vraiment service. Et parce que
chacun l'utilise au quotidien, la donnée scolaire remonte toute seule à
l'État : fiable, continue, exploitable. Zéro ressaisie.

---

## 1. L'écosystème : cinq acteurs, une plateforme

| Acteur | Ce qu'il gagne | Ce que l'État y gagne |
| --- | --- | --- |
| **Élèves** | Notes, devoirs au cahier de textes, fil d'entraide de la classe, assistant d'orientation | La présence et les résultats, en continu |
| **Parents** | Suivi de chaque enfant (résultats, absences, bulletins, échéances), lien prouvé par échange de codes | L'assiduité confirmée par la famille |
| **Enseignants** | Appel en un clic, notes saisies à la masse, moyennes pondérées calculées seules, bilans aux parents | La note saisie au moment de la note |
| **Établissements** | Un LMS : classes, emplois du temps sans conflit, finances transparentes, transferts entre écoles | Bulletins et finances, à la source |
| **Ministère** | La tour de contrôle nationale : carte scolaire, abandon scolaire, besoins d'enseignement, examens | Tout ce que les quatre autres utilisent déjà |

## 2. Les fonctionnalités

### Vie scolaire

- Appel quotidien (présent, retard, absence justifiée ou non ; les parents sont prévenus).
- Évaluations et notes saisies à la masse, moyennes pondérées par les coefficients, ramenées à l'échelle choisie par l'établissement.
- Bulletins trimestriels, publication aux familles, série imprimable, une page par élève.
- Emploi du temps avec **refus des conflits** (salle, enseignant, classe), séances datées et annulations notifiées.
- Devoirs au cahier de textes : chaque devoir rejoint le calendrier des élèves, le fil de la classe et prévient les parents.

### Le pilotage de l'école (LMS)

- Classes et programmes, emplois du temps sans conflit, salles,
  inscriptions par code, finances et transferts entre écoles : la gestion
  de l'établissement réunie dans un seul système.

### La classe comme communauté

- Chaque classe est un **espace privé** : mur de discussion (la direction, les professeurs et les délégués publient ; les élèves commentent), programme, membres par rôle.
- Les **parents rejoignent la classe par son code** : ils reçoivent ses annonces et figurent parmi ses membres.
- **Délégués de classe** : des élèves désignés qui publient et donnent les devoirs, en plus des professeurs.
- Le **fil d'actualité** agrège les murs des espaces suivis : école, classes, communautés ouvertes.
- **Communautés ouvertes** : chaque école recensée a sa communauté ouverte (365 à ce jour), plus les clubs et groupes créés par les utilisateurs.

### Confiance par échange de codes

- VME (école), VMT (classe), VMF (famille), VMP (élève) : un seul réflexe : *on me donne un code, je le saisis*.
- Le suivi d'un parent s'ouvre par le **croisement des codes famille**.
- Aucune ressaisie : de l'appel au bulletin, de l'inscription à la liste d'examen, tout se transmet.

### Finances scolaires

- Frais par catégorie, découpage en tranches, factures et **reçus numérotés**, paiement partiel, annulation motivée.
- **Rappels automatiques** à 14, 7 puis 3 jours avant chaque échéance ; l'élève est informé, sans jamais voir un montant.
- **Délégations** : la direction confie les finances (ou les bulletins) à un membre de l'équipe.

### Transport scolaire

- Lignes réelles avec arrêts et horaires indicatifs dépliables, abonnement par arrêt, **ticket à 200 F** achetable en ligne ou par code USSD `*611#`.

### Orientation et IA

- **Assistant d'orientation post-bac** : relevé du bac (photo lue par IA ou saisie manuelle), barèmes officiels des séries, recommandations de filières et d'établissements calculées côté serveur.
- **Tuteur de devoirs** : un fil par devoir, le tuteur guide par des questions, **jamais la solution**.
- **Assistant des décideurs** : le ministère et la direction interrogent leurs données en langage naturel ; l'assistant consulte les registres réels et recopie les chiffres, sans invention.

### Ministère : la tour de contrôle

- **Carte nationale réelle** des 12 départements (frontières officielles), quatre indicateurs : parité, ratio élèves/enseignant, abandon, besoins.
- **Abandon scolaire** : détection automatique : un élève qui ne figure plus à aucun appel depuis 14 jours pendant que sa classe est encore pointée, ventilé par département et par sexe.
- **Besoins d'enseignement** : matières sans professeur et sans cours posé, commune par commune.
- **File de validation** des établissements, **listes de candidature BEPC/BAC** générées sans ressaisie, **passeport scolaire** de l'élève.
- **Agents et permissions** : trois niveaux (administrateur, validation, lecture), comptes créés par code ou par l'administrateur.

### Pensé pour le Bénin

- Rendu côté serveur, sans gadget : fluide sur les connexions modestes.
- Mobile Money préparé (MTN Moov, Celtiis), code USSD pour les tickets.
- Prêt pour l'interopérabilité **NPI (ANIP)** : la zone de connexion l'affiche, la donnée d'identification existe.

## 3. Socle technique

| Couche | Choix |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Interface | Tailwind CSS 4, composants serveur, icônes Tabler, zéro dépendance UI lourde |
| Données | PostgreSQL + Drizzle ORM, 54 tables |
| IA | API DeepSeek (chat en flux, lecture de relevés par vision, appels d'outils sur registres) |
| Hébergement | Vercel (application) + Neon (Postgres serveur) |

Rendu côté serveur par défaut : la plateforme reste légère et rapide sur
les connexions modestes.

## 4. Lancer le projet en local

```bash
git clone https://github.com/Yas246/edutech.git
cd edutech
npm install
cp .env.example .env        # puis renseigner les variables (voir ci-dessous)
npx drizzle-kit push        # crée les tables
npm run seed                # recensement national + données de démonstration
npm run dev                 # http://localhost:3000
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL (compatible Neon, `prepare: false` déjà en place) |
| `LLM_BASE_URL` | Point d'accès de l'API de l'assistant (`https://api.deepseek.com`) |
| `LLM_API_KEY` | Clé de l'API de l'assistant |
| `LLM_MODELE` | Modèle de dialogue (ex. `deepseek-chat`) |
| `LLM_VISION` | Modèle de lecture des relevés (ex. `deepseek-v4-flash-vision-exp`) |
| `CRON_SECRET` | Facultatif ; protège les tâches planifiées (relances) |

## 5. Vérifications intégrées

- `npm run outils` : plus de **170 vérifications** : chaque instrument de l'assistant est confronté à une vérité recalculée indépendamment en SQL.
- `npm run seed` : idempotent, rejouable sans doublon.
- `npx tsc --noEmit` et `npm run build` : types et build de production.

## 6. Feuille de route

- Paiement **Mobile Money** effectif (MTN Moov, Celtiis) ; le socle finances est en place.
- Interconnexion **NPI/ANIP** : la donnée d'identification est prévue, la zone de connexion l'annonce.
- Notifications **SMS/USSD** pour les familles sans smartphone.
- Relevés papier d'emploi du temps par OCR (adaptation par établissement).

---

*EduTech, plateforme numérique pour l'éducation et la vie scolaire en
République du Bénin. Données d'établissements issues du recensement
national, sources officielles citées.*
