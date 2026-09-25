import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Comptes et accès                                                    */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nom: text("nom").notNull(),
  prenom: text("prenom").notNull(),
  telephone: text("telephone").default("").notNull(),
  /** ministere | direction | enseignant | parent | eleve */
  role: text("role").notNull(),
  /** Le parcours premiers pas a été parcouru ou ignoré. */
  onboardingFait: boolean("onboarding_fait").default(false).notNull(),
  /** Centres d'intérêts de l'élève, séparés par des virgules (le coach les lit). */
  interets: text("interets").default("").notNull(),
  /** F ou M, renseigné quand la personne l'accepte (indicateurs de parité). */
  sexe: text("sexe").default("").notNull(),
  /** L'identifiant public du compte, unique (prenom.nom, suffixé si besoin). */
  pseudo: text("pseudo").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Équipe d'un établissement et codes de rattachement                  */
/* ------------------------------------------------------------------ */

/**
 * Le rattachement d'un compte à l'école : `declare` quand l'enseignant
 * se déclare, `confirme` quand la direction l'accepte ou qu'il est
 * entré par le code de l'école. Une affiliation confirmée n'est jamais
 * rétrogradée.
 */
export const equipes = pgTable(
  "equipes",
  {
    id: serial("id").primaryKey(),
    etablissementId: integer("etablissement_id")
      .notNull()
      .references(() => etablissements.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** declare | confirme */
    statut: text("statut").default("declare").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("equipes_uniques").on(t.etablissementId, t.userId)],
);

/** Le code d'invitation de l'école (un actif, régénération = l'ancien meurt). */
export const codesEquipe = pgTable("codes_equipe", {
  etablissementId: integer("etablissement_id")
    .primaryKey()
    .references(() => etablissements.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
});

/** Le code d'entrée dans une classe (élèves). */
export const codesClasse = pgTable("codes_classe", {
  classeId: integer("classe_id")
    .primaryKey()
    .references(() => classes.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
});

/** Le code personnel de l'élève, à donner à son parent. */
export const codesEleve = pgTable("codes_eleve", {
  eleveUserId: integer("eleve_user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
});

/**
 * La déclaration d'un enfant par un parent. Le suivi ne s'ouvre que
 * quand `eleveUserId` est posé — preuve par croisement du code famille
 * de la déclaration (VMF) et du code personnel de l'élève (VMP).
 */
export const declarationsEnfant = pgTable("declarations_enfant", {
  id: serial("id").primaryKey(),
  parentUserId: integer("parent_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  prenom: text("prenom").notNull(),
  nom: text("nom").notNull(),
  /** pere | mere | tuteur */
  relation: text("relation").notNull(),
  classeId: integer("classe_id").references(() => classes.id, { onDelete: "set null" }),
  /** Posé au croisement des codes : le suivi en découle. */
  eleveUserId: integer("eleve_user_id").references(() => users.id),
  codeFamille: text("code_famille").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Les saisies erronées de codes : 10 par jour et par compte, pas plus. */
export const tentativesCode = pgTable(
  "tentatives_code",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jour: date("jour").notNull(),
    n: integer("n").default(0).notNull(),
  },
  (t) => [unique("tentatives_par_jour").on(t.userId, t.jour)],
);


export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Le lien confirmé entre un parent et un élève (plusieurs enfants possibles). */
export const liensFamille = pgTable(
  "liens_famille",
  {
    id: serial("id").primaryKey(),
    parentUserId: integer("parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eleveUserId: integer("eleve_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("liens_famille_couple").on(t.parentUserId, t.eleveUserId)],
);

/* ------------------------------------------------------------------ */
/* Établissements, classes, matières                                   */
/* ------------------------------------------------------------------ */

export const etablissements = pgTable("etablissements", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  sigle: text("sigle").default("").notNull(),
  /** ceg | college | lycee | technique | superieur | autre */
  type: text("type").default("autre").notNull(),
  /** public | prive | confesse */
  statutAdmin: text("statut_admin").default("").notNull(),
  commune: text("commune").default("").notNull(),
  departement: text("departement").default("").notNull(),
  quartier: text("quartier").default("").notNull(),
  adresse: text("adresse").default("").notNull(),
  telephone: text("telephone").default("").notNull(),
  /** valide | en_attente | refuse */
  statut: text("statut").default("en_attente").notNull(),
  /** recensement (acte du ministère) | inscription (à valider) */
  source: text("source").default("inscription").notNull(),
  /** Etat de la dernière preuve du recensement : ouvert | incertain */
  etatRecensement: text("etat_recensement").default("").notNull(),
  dernierePreuve: text("derniere_preuve").default("").notNull(),
  sources: jsonb("sources").$type<string[]>().default([]).notNull(),
  directionUserId: integer("direction_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  /** Le découpage de l'année : 1 annuel, 2 semestres, 3 trimestres… 6. */
  periodicite: integer('periodicite').default(3).notNull(),
  /** L'échelle des moyennes choisie par l'établissement (20 par défaut). */
  echelle: numeric('echelle', { precision: 5, scale: 1 }).default('20.0').notNull(),
  /** Compteurs des pièces numérotées par établissement. */
  factureSeq: integer("facture_seq").default(0).notNull(),
  recuSeq: integer("recu_seq").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique("etablissements_nom_commune").on(t.nom, t.commune)]);

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  etablissementId: integer("etablissement_id")
    .notNull()
    .references(() => etablissements.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  niveau: text("niveau").default("").notNull(),
  anneeScolaire: text("annee_scolaire").default("2026-2027").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Vie scolaire : salles, emploi du temps, devoirs                     */
/* ------------------------------------------------------------------ */

export const salles = pgTable("salles", {
  id: serial("id").primaryKey(),
  etablissementId: integer("etablissement_id")
    .notNull()
    .references(() => etablissements.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  capacite: integer("capacite").default(0).notNull(),
});

/**
 * Un créneau de l'emploi du temps : les chevauchements sur une même
 * salle, classe ou enseignant sont refusés à la pose.
 */
export const creneaux = pgTable("creneaux", {
  id: serial("id").primaryKey(),
  classeId: integer("classe_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  matiereId: integer("matiere_id")
    .notNull()
    .references(() => matieres.id, { onDelete: "cascade" }),
  enseignantUserId: integer("enseignant_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  salleId: integer("salle_id")
    .notNull()
    .references(() => salles.id, { onDelete: "cascade" }),
  /** 1 = lundi … 6 = samedi */
  jour: integer("jour").notNull(),
  /** Heure de début, format 24 h : « 08:00 » */
  heureDebut: text("heure_debut").notNull(),
  heureFin: text("heure_fin").notNull(),
  /** Une date porte une séance unique ; vide, le créneau est hebdomadaire. */
  dateSeance: date("date_seance"),
});

/**
 * L'annulation d'une séance d'un créneau hebdomadaire, avec motif :
 * les élèves et les parents sont prévenus, les autres semaines ne
 * bougent pas. Le rétablissement supprime la ligne, sans re-notifier.
 */
export const annulationsCreneaux = pgTable(
  "annulations_creneaux",
  {
    id: serial("id").primaryKey(),
    creneauId: integer("creneau_id")
      .notNull()
      .references(() => creneaux.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    motif: text("motif").default("").notNull(),
    creePar: integer("cree_par")
      .notNull()
      .references(() => users.id),
  },
  (t) => [unique("annulations_uniques").on(t.creneauId, t.date)],
);

/** Un événement posé par la direction : conseil de classe, réunion… */
export const evenements = pgTable("evenements", {
  id: serial("id").primaryKey(),
  etablissementId: integer("etablissement_id")
    .notNull()
    .references(() => etablissements.id, { onDelete: "cascade" }),
  titre: text("titre").notNull(),
  description: text("description").default("").notNull(),
  date: date("date").notNull(),
  /** etablissement | classe */
  portee: text("portee").default("etablissement").notNull(),
  classeId: integer("classe_id").references(() => classes.id, { onDelete: "cascade" }),
  creePar: integer("cree_par")
    .notNull()
    .references(() => users.id),
});

export const devoirs = pgTable("devoirs", {
  id: serial("id").primaryKey(),
  classeId: integer("classe_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  matiereId: integer("matiere_id")
    .notNull()
    .references(() => matieres.id, { onDelete: "cascade" }),
  enseignantUserId: integer("enseignant_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  titre: text("titre").notNull(),
  consigne: text("consigne").default("").notNull(),
  donneLe: date("donne_le").notNull(),
  aRendreLe: date("a_rendre_le").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matieres = pgTable(
  "matieres",
  {
    id: serial("id").primaryKey(),
    classeId: integer("classe_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    nom: text("nom").notNull(),
    coefficient: integer("coefficient").default(1).notNull(),
  },
  (t) => [unique("matieres_par_classe").on(t.classeId, t.nom)],
);

/** Un enseignant responsable d'une matière dans une classe. */
export const enseignements = pgTable(
  "enseignements",
  {
    id: serial("id").primaryKey(),
    classeId: integer("classe_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    matiereId: integer("matiere_id")
      .notNull()
      .references(() => matieres.id, { onDelete: "cascade" }),
    enseignantUserId: integer("enseignant_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("enseignements_attribution").on(t.classeId, t.matiereId, t.enseignantUserId),
  ],
);

export const inscriptions = pgTable(
  "inscriptions",
  {
    id: serial("id").primaryKey(),
    classeId: integer("classe_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    eleveUserId: integer("eleve_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("inscriptions_unique").on(t.classeId, t.eleveUserId)],
);

/* ------------------------------------------------------------------ */
/* Vie scolaire                                                        */
/* ------------------------------------------------------------------ */

export const presences = pgTable(
  "presences",
  {
    id: serial("id").primaryKey(),
    classeId: integer("classe_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    eleveUserId: integer("eleve_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** present | retard | absent | absent_justifie */
    statut: text("statut").notNull(),
    motif: text("motif").default("").notNull(),
    saisiPar: integer("saisi_par")
      .notNull()
      .references(() => users.id),
  },
  (t) => [unique("presences_par_jour").on(t.classeId, t.eleveUserId, t.date)],
);

/**
 * La pointage d'un enseignant pour une journée, saisi par la direction
 * (ou son délégué). Unique par enseignant et par date.
 */
export const presencesEnseignants = pgTable(
  "presences_enseignants",
  {
    id: serial("id").primaryKey(),
    etablissementId: integer("etablissement_id")
      .notNull()
      .references(() => etablissements.id, { onDelete: "cascade" }),
    enseignantUserId: integer("enseignant_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** present | retard | absent */
    statut: text("statut").notNull(),
    saisiPar: integer("saisi_par")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("presences_enseignants_par_jour").on(t.enseignantUserId, t.date)],
);

/**
 * Un transfert d'élève entre établissements : il se règle ENTRE ÉCOLES.
 * La direction d'accueil ouvre la demande après examen du dossier ;
 * la direction d'ORIGINE l'accepte (le « transfert numérique ») ou la
 * refuse. Tant que l'origine n'a pas accepté, l'élève n'est pas
 * inscrit dans la classe d'accueil. Le ministère n'est pas juge :
 * il lit les mouvements comme le reste.
 */
export const transferts = pgTable("transferts", {
  id: serial("id").primaryKey(),
  eleveUserId: integer("eleve_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  etablissementDepart: integer("etablissement_depart")
    .notNull()
    .references(() => etablissements.id),
  etablissementArrivee: integer("etablissement_arrivee")
    .notNull()
    .references(() => etablissements.id),
  /** redoublant | passant : l'état de l'élève à son arrivée. */
  statutArrivee: text("statut_arrivee").notNull(),
  classeArriveeId: integer("classe_arrivee_id").references(() => classes.id, {
    onDelete: "set null",
  }),
  motif: text("motif").default("").notNull(),
  /** demande | valide | refuse */
  statut: text("statut").default("demande").notNull(),
  demandePar: integer("demande_par")
    .notNull()
    .references(() => users.id),
  decidePar: integer("decide_par").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const periodes = pgTable("periodes", {
  id: serial("id").primaryKey(),
  etablissementId: integer("etablissement_id")
    .notNull()
    .references(() => etablissements.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  debut: date("debut").notNull(),
  fin: date("fin").notNull(),
  active: boolean("active").default(false).notNull(),
});

/** La publication d'une série de bulletins rend les bulletins visibles. */
export const publicationsBulletins = pgTable(
  "publications_bulletins",
  {
    id: serial("id").primaryKey(),
    classeId: integer("classe_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    periodeId: integer("periode_id")
      .notNull()
      .references(() => periodes.id, { onDelete: "cascade" }),
    publiePar: integer("publie_par")
      .notNull()
      .references(() => users.id),
    publieLe: timestamp("publie_le").defaultNow().notNull(),
  },
  (t) => [unique("publication_bulletins_unique").on(t.classeId, t.periodeId)],
);

export const evaluations = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  classeId: integer("classe_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  matiereId: integer("matiere_id")
    .notNull()
    .references(() => matieres.id, { onDelete: "cascade" }),
  titre: text("titre").notNull(),
  /** interrogation | devoir */
  type: text("type").default("interrogation").notNull(),
  bareme: integer("bareme").default(20).notNull(),
  date: date("date").notNull(),
  creePar: integer("cree_par")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    evaluationId: integer("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    eleveUserId: integer("eleve_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    valeur: numeric("valeur", { precision: 5, scale: 2 }).notNull(),
    /** Absent à l'épreuve : non justifiée = 0, justifiée = exclue. */
    absent: boolean("absent").default(false).notNull(),
    justifie: boolean("justifie").default(false).notNull(),
  },
  (t) => [unique("notes_unique").on(t.evaluationId, t.eleveUserId)],
);


/* ------------------------------------------------------------------ */
/* Finances                                                            */
/* ------------------------------------------------------------------ */

export const frais = pgTable("frais", {
  id: serial("id").primaryKey(),
  etablissementId: integer("etablissement_id")
    .notNull()
    .references(() => etablissements.id, { onDelete: "cascade" }),
  /** inscription | scolarite | td | tenue | examen | cantine | transport |
      fournitures | etude_dossier | autre */
  categorie: text("categorie").notNull(),
  /** Nom libre quand la catégorie est « autre ». */
  libelle: text("libelle").default("").notNull(),
  montant: integer("montant").notNull(),
  /** classe | niveau | eleves */
  cibleType: text("cible_type").notNull(),
  cibleClasseId: integer("cible_classe_id").references(() => classes.id, {
    onDelete: "set null",
  }),
  cibleNiveau: text("cible_niveau").default("").notNull(),
  /** Null = le frais porte sur l'année. */
  periodeId: integer("periode_id").references(() => periodes.id, {
    onDelete: "set null",
  }),
  actif: boolean("actif").default(true).notNull(),
  creePar: integer("cree_par")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


export const fraisEleves = pgTable(
  "frais_eleves",
  {
    fraisId: integer("frais_id")
      .notNull()
      .references(() => frais.id, { onDelete: "cascade" }),
    eleveUserId: integer("eleve_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [unique("frais_eleves_unique").on(t.fraisId, t.eleveUserId)],
);

/** Chaque geste financier est inscrit au journal, avec son auteur. */
export const journal = pgTable("journal", {
  id: serial("id").primaryKey(),
  etablissementId: integer("etablissement_id")
    .notNull()
    .references(() => etablissements.id, { onDelete: "cascade" }),
  auteurUserId: integer("auteur_user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  detail: text("detail").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Une relance envoyée : l'unicité (tranche, parent, jalon) interdit les doublons. */
export const relances = pgTable("relances", {
  id: serial("id").primaryKey(),
  trancheId: integer("tranche_id")
    .notNull()
    .references(() => tranches.id, { onDelete: "cascade" }),
  parentUserId: integer("parent_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Nombre de jours avant l'échéance : 14, 7 ou 3. */
  jalon: integer("jalon").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const factures = pgTable("factures", {
  id: serial("id").primaryKey(),
  numero: text("numero").notNull().unique(),
  eleveUserId: integer("eleve_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fraisId: integer("frais_id")
    .notNull()
    .references(() => frais.id, { onDelete: "cascade" }),
  periodeId: integer("periode_id").references(() => periodes.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tranches = pgTable("tranches", {
  id: serial("id").primaryKey(),
  factureId: integer("facture_id")
    .notNull()
    .references(() => factures.id, { onDelete: "cascade" }),
  ordre: integer("ordre").notNull(),
  montant: integer("montant").notNull(),
  echeance: date("echeance").notNull(),
});

export const paiements = pgTable("paiements", {
  id: serial("id").primaryKey(),
  factureId: integer("facture_id")
    .notNull()
    .references(() => factures.id, { onDelete: "cascade" }),
  montant: integer("montant").notNull(),
  /** especes | virement | mobile_money */
  mode: text("mode").notNull(),
  note: text("note").default("").notNull(),
  /** Reçu numéroté par établissement : REC-<etab>-<seq>. */
  recuNumero: text("recu_numero").default("").notNull(),
  auteurUserId: integer("auteur_user_id")
    .notNull()
    .references(() => users.id),
  annule: boolean("annule").default(false).notNull(),
  motifAnnulation: text("motif_annulation").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** La direction confie le rôle financier à un membre de son équipe. */
export const delegations = pgTable(
  "delegations",
  {
    id: serial("id").primaryKey(),
    etablissementId: integer("etablissement_id")
      .notNull()
      .references(() => etablissements.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** finances */
    role: text("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("delegations_unique").on(t.etablissementId, t.userId, t.role)],
);

/* ------------------------------------------------------------------ */
/* Fil social                                                          */
/* ------------------------------------------------------------------ */

/**
 * Une communauté : le canal social ouvert (matière, groupe de travail,
 * club, communauté thématique). La classe, elle, reste fermée sur code
 * et vit dans les publications à portée classe.
 */
export const communautes = pgTable("communautes", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  description: text("description").default("").notNull(),
  /** matiere | groupe_travail | club | communaute */
  type: text("type").notNull(),
  etablissementId: integer("etablissement_id").references(() => etablissements.id, {
    onDelete: "cascade",
  }),
  creePar: integer("cree_par")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communautesMembres = pgTable(
  "communautes_membres",
  {
    id: serial("id").primaryKey(),
    communauteId: integer("communaute_id")
      .notNull()
      .references(() => communautes.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** membre | admin */
    role: text("role").default("membre").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("communautes_membres_uniques").on(t.communauteId, t.userId)],
);

export const publications = pgTable("publications", {
  id: serial("id").primaryKey(),
  auteurUserId: integer("auteur_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** etablissement | classe | communaute */
  porteeType: text("portee_type").notNull(),
  porteeId: integer("portee_id").notNull(),
  contenu: text("contenu").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commentaires = pgTable("commentaires", {
  id: serial("id").primaryKey(),
  publicationId: integer("publication_id")
    .notNull()
    .references(() => publications.id, { onDelete: "cascade" }),
  auteurUserId: integer("auteur_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contenu: text("contenu").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reactions = pgTable(
  "reactions",
  {
    id: serial("id").primaryKey(),
    publicationId: integer("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [unique("reactions_unique").on(t.publicationId, t.userId)],
);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  texte: text("texte").notNull(),
  lien: text("lien").default("").notNull(),
  lue: boolean("lue").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */


export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userA: integer("user_a")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userB: integer("user_b")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
}, (t) => [unique("conversations_paire").on(t.userA, t.userB)]);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  auteurUserId: integer("auteur_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contenu: text("contenu").notNull(),
  lu: boolean("lu").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lignesTransport = pgTable("lignes_transport", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  ville: text("ville").notNull(),
  destination: text("destination").notNull(),
  horaireDebut: text("horaire_debut").default("06:30").notNull(),
  horaireFin: text("horaire_fin").default("19:00").notNull(),
  active: boolean("active").default(true).notNull(),
});

export const arrets = pgTable("arrets", {
  id: serial("id").primaryKey(),
  ligneId: integer("ligne_id")
    .notNull()
    .references(() => lignesTransport.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  ordre: integer("ordre").notNull(),
});

export const abonnementsTransport = pgTable(
  "abonnements_transport",
  {
    id: serial("id").primaryKey(),
    eleveUserId: integer("eleve_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ligneId: integer("ligne_id")
      .notNull()
      .references(() => lignesTransport.id, { onDelete: "cascade" }),
    arretId: integer("arret_id")
      .notNull()
      .references(() => arrets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("abonnements_unique").on(t.eleveUserId)],
);

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  eleveUserId: integer("eleve_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ligneId: integer("ligne_id")
    .notNull()
    .references(() => lignesTransport.id, { onDelete: "cascade" }),
  montant: integer("montant").default(200).notNull(),
  acheteLe: timestamp("achete_le").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Orientation : le relevé du candidat et son profil canonique          */
/* ------------------------------------------------------------------ */

/**
 * Le relevé de notes du baccalauréat, tel qu'extrait d'une photo puis
 * corrigé par l'élève. Les coefficients viennent toujours du barème
 * officiel de la série ; la moyenne et la mention sont recalculées ici,
 * jamais recopiées. `matieres` : { "MATHEMATIQUES": { note, points } }.
 */
export const relevesOrientation = pgTable("releves_orientation", {
  id: serial("id").primaryKey(),
  eleveUserId: integer("eleve_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  serie: text("serie").default("").notNull(),
  nom: text("nom").default("").notNull(),
  numTable: text("num_table").default("").notNull(),
  moyenne: numeric("moyenne", { precision: 5, scale: 2 }),
  mention: text("mention").default("").notNull(),
  decision: text("decision").default("").notNull(),
  matieres: jsonb("matieres")
    .$type<Record<string, { note: number | null; points: number | null; coeff: number | null }>>()
    .default({})
    .notNull(),
  /** Ce que la lecture de la photo a renvoyé, avant correction. */
  brut: jsonb("brut"),
  /** Les incohérences détectées par le contrôle arithmétique. */
  controle: jsonb("controle").$type<{ champ: string; probleme: string }[]>().default([]).notNull(),
  fichier: text("fichier").default("").notNull(),
  /** extrait | valide */
  statut: text("statut").default("extrait").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Coach                                                               */
/* ------------------------------------------------------------------ */

/** Une discussion du coach, façon fil : titre pris sur la première question. */
export const conversationsCoach = pgTable("conversations_coach", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  titre: text("titre").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messagesCoach = pgTable("messages_coach", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversationsCoach.id, { onDelete: "cascade" }),
  /** user | assistant */
  role: text("role").notNull(),
  contenu: text("contenu").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
