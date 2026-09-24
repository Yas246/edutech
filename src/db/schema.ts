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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export const publications = pgTable("publications", {
  id: serial("id").primaryKey(),
  auteurUserId: integer("auteur_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** etablissement | classe */
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
/* Coach                                                               */
/* ------------------------------------------------------------------ */

export const messagesCoach = pgTable("messages_coach", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** user | assistant */
  role: text("role").notNull(),
  contenu: text("contenu").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
