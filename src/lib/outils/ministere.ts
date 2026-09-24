import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Outil } from "./types";

/**
 * Les neuf outils du ministère. Lecture seule, jamais de montant : le
 * recouvrement est un pourcentage global. Les mêmes fonctions alimentent
 * les pages du ministère, le coach et le script de contrôle.
 */

export type LigneDepartement = {
  departement: string;
  etablissements: number;
  eleves: number;
  tauxAbsenteisme: number | null;
  tauxRecouvrement: number | null;
};

/** La nation, département par département. */
export async function statistiquesDepartement(
  departement?: string,
): Promise<LigneDepartement[]> {
  const filtre = departement ? sql`WHERE d.departement = ${departement}` : sql``;
  const resultat = await db.execute(sql`
    SELECT
      d.departement,
      (SELECT count(*) FROM etablissements e
        WHERE e.departement = d.departement AND e.statut = 'valide') AS etablissements,
      (SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id
        JOIN etablissements e ON e.id = c.etablissement_id
        WHERE e.departement = d.departement) AS eleves,
      (SELECT round(100.0 * count(*) FILTER (WHERE p.statut = 'absent')
              / GREATEST(count(*), 1), 1)
        FROM presences p
        JOIN classes c ON c.id = p.classe_id
        JOIN etablissements e ON e.id = c.etablissement_id
        WHERE e.departement = d.departement) AS taux_absenteisme,
      (SELECT round(100.0 * COALESCE((
                SELECT sum(pai.montant) FROM paiements pai
                JOIN factures f ON f.id = pai.facture_id
                JOIN frais fr ON fr.id = f.frais_id
                JOIN etablissements e2 ON e2.id = fr.etablissement_id
                WHERE pai.annule = false AND e2.departement = d.departement
              ), 0) / GREATEST(COALESCE((
                SELECT sum(t.montant) FROM tranches t
                JOIN factures f ON f.id = t.facture_id
                JOIN frais fr ON fr.id = f.frais_id
                JOIN etablissements e2 ON e2.id = fr.etablissement_id
                WHERE e2.departement = d.departement
              ), 1), 1), 1)
        WHERE EXISTS (
          SELECT 1 FROM tranches t
          JOIN factures f ON f.id = t.facture_id
          JOIN frais fr ON fr.id = f.frais_id
          JOIN etablissements e2 ON e2.id = fr.etablissement_id
          WHERE e2.departement = d.departement)
      ) AS taux_recouvrement
    FROM (SELECT DISTINCT departement FROM etablissements WHERE departement <> '') d
    ${filtre}
    ORDER BY d.departement
  `);
  return (
    resultat as unknown as {
      departement: string;
      etablissements: unknown;
      eleves: unknown;
      tauxAbsenteisme: unknown;
      tauxRecouvrement: unknown;
    }[]
  ).map((l) => ({
    departement: l.departement,
    etablissements: Number(l.etablissements),
    eleves: Number(l.eleves),
    tauxAbsenteisme: l.tauxAbsenteisme === null ? null : Number(l.tauxAbsenteisme),
    tauxRecouvrement: l.tauxRecouvrement === null ? null : Number(l.tauxRecouvrement),
  }));
}

export type LigneApprenant = {
  eleveId: number;
  classeId: number;
  prenom: string;
  nom: string;
  sexe: string;
  classe: string;
  etablissement: string;
  departement: string;
  moyenne: number | null;
  absences: number;
};

/**
 * La consultation des apprenants : filtres par département,
 * établissement et classe, requêtes prêtes (moyenne au-dessus d'un seuil,
 * élèves les plus absents). La moyenne suit la règle des bulletins :
 * absence non justifiée = 0, absence justifiée exclue.
 */
export async function consulterApprenants(filtres: {
  departement?: string;
  etablissementId?: number;
  classeId?: number;
  /** "excellents" avec seuil (défaut 15) ou "absents". */
  requete?: "excellents" | "absents";
  seuil?: number;
}): Promise<LigneApprenant[]> {
  const conditions = [sql`true`];
  if (filtres.departement) {
    conditions.push(sql`e.departement = ${filtres.departement}`);
  }
  if (filtres.etablissementId) {
    conditions.push(sql`e.id = ${filtres.etablissementId}`);
  }
  if (filtres.classeId) {
    conditions.push(sql`c.id = ${filtres.classeId}`);
  }
  const where = sql.join(conditions, sql` AND `);

  const seuil = filtres.seuil ?? 15;
  const having =
    filtres.requete === "excellents"
      ? sql`HAVING COALESCE(AVG(CASE WHEN n.absent AND n.justifie THEN NULL WHEN n.absent THEN 0 ELSE n.valeur / ev.bareme * 20 END), -1) >= ${seuil}`
      : filtres.requete === "absents"
        ? sql`HAVING count(*) FILTER (WHERE p.statut = 'absent') > 0`
        : sql``;

  const ordre =
    filtres.requete === "absents"
      ? sql`absences DESC, moyenne DESC NULLS LAST`
      : sql`moyenne DESC NULLS LAST`;

  const resultat = await db.execute(sql`
    SELECT
      u.id AS "eleveId",
      u.prenom,
      u.nom,
      u.sexe,
      c.id AS "classeId",
      c.nom AS classe,
      e.nom AS etablissement,
      e.departement,
      round(AVG(CASE WHEN n.absent AND n.justifie THEN NULL WHEN n.absent THEN 0 ELSE n.valeur / ev.bareme * 20 END)::numeric, 2) AS moyenne,
      count(DISTINCT (p.classe_id, p.date)) FILTER (WHERE p.statut = 'absent') AS absences
    FROM users u
    JOIN inscriptions i ON i.eleve_user_id = u.id
    JOIN classes c ON c.id = i.classe_id
    JOIN etablissements e ON e.id = c.etablissement_id
    LEFT JOIN evaluations ev ON ev.classe_id = c.id
    LEFT JOIN notes n ON n.evaluation_id = ev.id AND n.eleve_user_id = u.id
    LEFT JOIN presences p ON p.eleve_user_id = u.id AND p.classe_id = c.id
    WHERE u.role = 'eleve' AND ${where}
    GROUP BY u.id, u.prenom, u.nom, u.sexe, c.id, c.nom, e.nom, e.departement
    ${having}
    ORDER BY ${ordre}
    LIMIT 100
  `);
  // Les nombres du pilote (numeric, count) passent en nombres JavaScript.
  return (resultat as unknown as (LigneApprenant & { moyenne: string | number | null })[]).map(
    (l) => ({
      ...l,
      moyenne: l.moyenne === null || l.moyenne === undefined ? null : Number(l.moyenne),
      absences: Number(l.absences),
    }),
  );
}

export type ProfilEcole = {
  id: number;
  nom: string;
  commune: string;
  departement: string;
  effectifs: number;
  classes: number;
  filles: number;
  garcons: number;
  moyenneGenerale: number | null;
  meilleurEleve: { prenom: string; nom: string; classe: string; moyenne: number } | null;
  tauxAssiduiteEnseignants: number | null;
  classesPubliantBulletins: number;
};

/** La fiche complète d'un établissement, chiffrée. */
export async function profilEcole(etablissementId: number): Promise<ProfilEcole | null> {
  const [ecole] = await db.execute(sql`
    SELECT id, nom, commune, departement FROM etablissements WHERE id = ${etablissementId}
  `).then((r) => r as unknown as { id: number; nom: string; commune: string; departement: string }[]);
  if (!ecole) return null;

  const [compte] = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id
        WHERE c.etablissement_id = ${etablissementId}) AS effectifs,
      (SELECT count(*) FROM classes c WHERE c.etablissement_id = ${etablissementId}) AS classes,
      (SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id
        JOIN users u ON u.id = i.eleve_user_id
        WHERE c.etablissement_id = ${etablissementId} AND u.sexe = 'F') AS filles,
      (SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id
        JOIN users u ON u.id = i.eleve_user_id
        WHERE c.etablissement_id = ${etablissementId} AND u.sexe = 'M') AS garcons,
      (SELECT count(*) FROM publications_bulletins pb
        JOIN classes c ON c.id = pb.classe_id
        WHERE c.etablissement_id = ${etablissementId}) AS publications
  `)) as unknown as {
    effectifs: number;
    classes: number;
    filles: number;
    garcons: number;
    publications: number;
  }[];

  const eleves = await consulterApprenants({ etablissementId });
  const moyenneGenerale = eleves.length
    ? Number(
        (
          eleves
            .map((e) => e.moyenne)
            .filter((m): m is number => m !== null)
            .reduce((a, m, _, tab) => a + m / tab.length, 0)
        ).toFixed(2),
      )
    : null;

  const meilleur = eleves.find((e) => e.moyenne !== null);

  return {
    id: ecole.id,
    nom: ecole.nom,
    commune: ecole.commune,
    departement: ecole.departement,
    effectifs: Number(compte.effectifs),
    classes: Number(compte.classes),
    filles: Number(compte.filles),
    garcons: Number(compte.garcons),
    moyenneGenerale,
    meilleurEleve: meilleur
      ? {
          prenom: meilleur.prenom,
          nom: meilleur.nom,
          classe: meilleur.classe,
          moyenne: Number(meilleur.moyenne),
        }
      : null,
    tauxAssiduiteEnseignants: (await assiduiteEnseignants({ etablissementId })).tauxGlobal,
    classesPubliantBulletins: Math.min(Number(compte.publications), Number(compte.classes)),
  };
}

export type LigneNiveau = { niveau: string; effectifs: number; filles: number; garcons: number };

/** Les effectifs par niveau (6e à terminale), avec la parité. */
export async function effectifsParNiveau(
  departement?: string,
): Promise<LigneNiveau[]> {
  const filtre = departement ? sql`AND e.departement = ${departement}` : sql``;
  const resultat = await db.execute(sql`
    SELECT c.niveau,
      count(*) AS effectifs,
      count(*) FILTER (WHERE u.sexe = 'F') AS filles,
      count(*) FILTER (WHERE u.sexe = 'M') AS garcons
    FROM inscriptions i
    JOIN classes c ON c.id = i.classe_id
    JOIN etablissements e ON e.id = c.etablissement_id
    JOIN users u ON u.id = i.eleve_user_id
    WHERE e.statut = 'valide' ${filtre}
    GROUP BY c.niveau
    ORDER BY c.niveau
  `);
  return (resultat as unknown as { niveau: string; effectifs: unknown; filles: unknown; garcons: unknown }[]).map(
    (l) => ({
      niveau: l.niveau,
      effectifs: Number(l.effectifs),
      filles: Number(l.filles),
      garcons: Number(l.garcons),
    }),
  );
}

export type LigneRatio = { perimetre: string; eleves: number; enseignants: number; ratio: number | null };

/** L'indicateur national ED04 : élèves par enseignant. */
export async function ratioElevesEnseignant(
  departement?: string,
): Promise<LigneRatio[]> {
  const filtre = departement ? sql`WHERE e.departement = ${departement}` : sql``;
  const resultat = await db.execute(sql`
    SELECT e.departement AS perimetre,
      (SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id
        WHERE c.etablissement_id = e.id) AS eleves,
      (SELECT count(DISTINCT en.enseignant_user_id) FROM enseignements en
        JOIN classes c2 ON c2.id = en.classe_id
        WHERE c2.etablissement_id = e.id) AS enseignants
    FROM etablissements e
    WHERE e.statut = 'valide' AND e.departement <> ''
    GROUP BY e.id, e.departement
    ORDER BY e.departement
  `);

  // Agrégation par département : un enseignant peut servir plusieurs
  // écoles, la somme des ratios d'école ne serait pas honnête.
  const parEcole = resultat as unknown as {
    perimetre: string; eleves: number; enseignants: number;
  }[];
  const parDepartement = new Map<string, { eleves: number; enseignants: number }>();
  for (const l of parEcole) {
    const ligne = parDepartement.get(l.perimetre) ?? { eleves: 0, enseignants: 0 };
    ligne.eleves += Number(l.eleves);
    ligne.enseignants += Number(l.enseignants);
    parDepartement.set(l.perimetre, ligne);
  }
  return [...parDepartement.entries()]
    .filter(([perimetre]) => !departement || perimetre === departement)
    .map(([perimetre, l]) => ({
      perimetre,
      eleves: l.eleves,
      enseignants: l.enseignants,
      ratio: l.enseignants > 0 ? Number((l.eleves / l.enseignants).toFixed(1)) : null,
    }));
}

export type Parite = {
  filles: number;
  garcons: number;
  nonRenseigne: number;
  /** Indice de parité genre : filles pour un garçon. */
  indiceParite: number | null;
};

/** La parité fille/garçon (indicateur GPI), filtrable. */
export async function pariteGenre(filtres: {
  departement?: string;
  niveau?: string;
}): Promise<Parite> {
  const conditions = [sql`u.role = 'eleve'`];
  if (filtres.departement) conditions.push(sql`e.departement = ${filtres.departement}`);
  if (filtres.niveau) conditions.push(sql`c.niveau = ${filtres.niveau}`);
  const resultat = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE u.sexe = 'F') AS filles,
      count(*) FILTER (WHERE u.sexe = 'M') AS garcons,
      count(*) FILTER (WHERE u.sexe NOT IN ('F','M')) AS non_renseigne
    FROM users u
    JOIN inscriptions i ON i.eleve_user_id = u.id
    JOIN classes c ON c.id = i.classe_id
    JOIN etablissements e ON e.id = c.etablissement_id
    WHERE ${sql.join(conditions, sql` AND `)}
  `);
  const [ligne] = resultat as unknown as { filles: string; garcons: string; non_renseigne: string }[];
  const filles = Number(ligne.filles);
  const garcons = Number(ligne.garcons);
  return {
    filles,
    garcons,
    nonRenseigne: Number(ligne.non_renseigne),
    indiceParite: garcons > 0 ? Number((filles / garcons).toFixed(2)) : null,
  };
}

export type Assiduite = {
  tauxGlobal: number | null;
  parEnseignant: {
    prenom: string;
    nom: string;
    etablissement: string;
    presents: number;
    retards: number;
    absents: number;
    taux: number;
  }[];
};

/** La présence des enseignants sur les trente derniers jours. */
export async function assiduiteEnseignants(filtres: {
  departement?: string;
  etablissementId?: number;
}): Promise<Assiduite> {
  const conditions = [sql`true`];
  if (filtres.departement) conditions.push(sql`pe2.etablissement_id IN (
    SELECT id FROM etablissements WHERE departement = ${filtres.departement})`);
  if (filtres.etablissementId) conditions.push(sql`pe2.etablissement_id = ${filtres.etablissementId}`);
  const where = sql.join(conditions, sql` AND `);

  const parEnseignant = (await db.execute(sql`
    SELECT u.prenom, u.nom, e.nom AS etablissement,
      count(*) FILTER (WHERE pe2.statut = 'present') AS presents,
      count(*) FILTER (WHERE pe2.statut = 'retard') AS retards,
      count(*) FILTER (WHERE pe2.statut = 'absent') AS absents,
      round(100.0 * count(*) FILTER (WHERE pe2.statut = 'present')
            / GREATEST(count(*), 1), 1) AS taux
    FROM presences_enseignants pe2
    JOIN users u ON u.id = pe2.enseignant_user_id
    JOIN etablissements e ON e.id = pe2.etablissement_id
    WHERE pe2.date >= CURRENT_DATE - 30 AND ${where}
    GROUP BY u.id, u.prenom, u.nom, e.nom
    ORDER BY taux DESC, u.nom
  `)) as unknown as {
    prenom: string; nom: string; etablissement: string;
    presents: string; retards: string; absents: string; taux: string;
  }[];

  const presents = parEnseignant.reduce((a, l) => a + Number(l.presents), 0);
  const total = parEnseignant.reduce(
    (a, l) => a + Number(l.presents) + Number(l.retards) + Number(l.absents),
    0,
  );
  return {
    tauxGlobal: total > 0 ? Number(((100 * presents) / total).toFixed(1)) : null,
    parEnseignant: parEnseignant.map((l) => ({
      prenom: l.prenom,
      nom: l.nom,
      etablissement: l.etablissement,
      presents: Number(l.presents),
      retards: Number(l.retards),
      absents: Number(l.absents),
      taux: Number(l.taux),
    })),
  };
}

export type LigneClasseSansBulletin = {
  etablissement: string;
  departement: string;
  classe: string;
  niveau: string;
};

/** Les classes qui n'ont pas encore publié leurs bulletins. */
export async function classesSansBulletin(
  departement?: string,
): Promise<LigneClasseSansBulletin[]> {
  const filtre = departement ? sql`AND e.departement = ${departement}` : sql``;
  const resultat = await db.execute(sql`
    SELECT e.nom AS etablissement, e.departement, c.nom AS classe, c.niveau
    FROM classes c
    JOIN etablissements e ON e.id = c.etablissement_id
    WHERE e.statut = 'valide'
      AND NOT EXISTS (
        SELECT 1 FROM publications_bulletins pb WHERE pb.classe_id = c.id)
      ${filtre}
    ORDER BY e.nom, c.nom
    LIMIT 100
  `);
  return resultat as unknown as LigneClasseSansBulletin[];
}

/** La résolution d'un établissement par son nom (partiel accepté). */
export async function chercherEtablissement(terme: string): Promise<
  { id: number; nom: string; commune: string; departement: string }[]
> {
  const resultat = await db.execute(sql`
    SELECT id, nom, commune, departement
    FROM etablissements
    WHERE statut = 'valide' AND (nom ILIKE ${"%" + terme + "%"} OR commune ILIKE ${"%" + terme + "%"})
    ORDER BY nom
    LIMIT 10
  `);
  return resultat as unknown as { id: number; nom: string; commune: string; departement: string }[];
}

export const outilsMinistere: Outil[] = [
  {
    nom: "stats_departement",
    description:
      "Statistiques d'un département (ou de toute la nation) : écoles validées, effectifs, absentéisme des élèves, taux de recouvrement global. Jamais de montants.",
    roles: ["ministere"],
    parametres: [
      { nom: "departement", description: "Nom du département (ex. Ouémé). Absent = toute la nation.", type: "texte", obligatoire: false },
    ],
    executer: async (_c, args) => statistiquesDepartement(args.departement as string | undefined),
  },
  {
    nom: "profil_ecole",
    description:
      "La fiche complète d'un établissement : effectifs, classes, parité, moyenne générale, meilleur élève, assiduité des enseignants, publication des bulletins. Chercher d'abord l'école avec chercher_etablissement si l'identifiant est inconnu.",
    roles: ["ministere"],
    parametres: [
      { nom: "etablissementId", description: "Identifiant de l'établissement.", type: "nombre", obligatoire: true },
    ],
    executer: async (_c, args) => profilEcole(Number(args.etablissementId)),
  },
  {
    nom: "chercher_etablissement",
    description:
      "Retrouver un établissement à partir d'une partie de son nom ou de sa commune ; renvoie les identifiants pour les autres outils.",
    roles: ["ministere"],
    parametres: [
      { nom: "terme", description: "Partie du nom ou de la commune.", type: "texte", obligatoire: true },
    ],
    executer: async (_c, args) => chercherEtablissement(String(args.terme ?? "")),
  },
  {
    nom: "effectifs_par_niveau",
    description:
      "Effectifs par niveau (de la 6e à la terminale), filles et garçons séparés, pour un département ou pour la nation.",
    roles: ["ministere"],
    parametres: [
      { nom: "departement", description: "Nom du département. Absent = toute la nation.", type: "texte", obligatoire: false },
    ],
    executer: async (_c, args) => effectifsParNiveau(args.departement as string | undefined),
  },
  {
    nom: "ratio_eleves_enseignant",
    description:
      "Nombre d'élèves par enseignant, département par département (indicateur ED04 du recensement scolaire).",
    roles: ["ministere"],
    parametres: [
      { nom: "departement", description: "Nom du département. Absent = toute la nation.", type: "texte", obligatoire: false },
    ],
    executer: async (_c, args) => ratioElevesEnseignant(args.departement as string | undefined),
  },
  {
    nom: "parite_genre",
    description:
      "Parité fille/garçon (indice de parité genre) avec les effectifs non renseignés, filtrable par département et par niveau.",
    roles: ["ministere"],
    parametres: [
      { nom: "departement", description: "Nom du département. Absent = toute la nation.", type: "texte", obligatoire: false },
      { nom: "niveau", description: "Niveau (ex. Terminale). Absent = tous.", type: "texte", obligatoire: false },
    ],
    executer: async (_c, args) =>
      pariteGenre({
        departement: args.departement as string | undefined,
        niveau: args.niveau as string | undefined,
      }),
  },
  {
    nom: "assiduite_enseignants",
    description:
      "Présence des enseignants sur les trente derniers jours : taux global et détail par enseignant, par école ou par département.",
    roles: ["ministere"],
    parametres: [
      { nom: "departement", description: "Nom du département. Absent = toute la nation.", type: "texte", obligatoire: false },
      { nom: "etablissementId", description: "Identifiant d'établissement pour une école précise.", type: "nombre", obligatoire: false },
    ],
    executer: async (_c, args) =>
      assiduiteEnseignants({
        departement: args.departement as string | undefined,
        etablissementId: args.etablissementId ? Number(args.etablissementId) : undefined,
      }),
  },
  {
    nom: "classes_sans_bulletin",
    description:
      "Les classes qui n'ont pas encore publié leurs bulletins, école par école : le suivi du conseil pédagogique.",
    roles: ["ministere"],
    parametres: [
      { nom: "departement", description: "Nom du département. Absent = toute la nation.", type: "texte", obligatoire: false },
    ],
    executer: async (_c, args) => classesSansBulletin(args.departement as string | undefined),
  },
  {
    nom: "apprenants_excellents",
    description:
      "Les apprenants dont la moyenne générale atteint un seuil (15/20 par défaut), avec leur classe et leur établissement.",
    roles: ["ministere"],
    parametres: [
      { nom: "seuil", description: "Moyenne minimale sur 20 (15 par défaut).", type: "nombre", obligatoire: false },
      { nom: "departement", description: "Nom du département.", type: "texte", obligatoire: false },
      { nom: "etablissementId", description: "Identifiant d'établissement.", type: "nombre", obligatoire: false },
    ],
    executer: async (_c, args) =>
      consulterApprenants({
        requete: "excellents",
        seuil: args.seuil ? Number(args.seuil) : undefined,
        departement: args.departement as string | undefined,
        etablissementId: args.etablissementId ? Number(args.etablissementId) : undefined,
      }),
  },
  {
    nom: "apprenants_absenteisme",
    description:
      "Les apprenants les plus absents, pour cibler le suivi : établissement, classe et nombre d'absences.",
    roles: ["ministere"],
    parametres: [
      { nom: "departement", description: "Nom du département.", type: "texte", obligatoire: false },
      { nom: "etablissementId", description: "Identifiant d'établissement.", type: "nombre", obligatoire: false },
    ],
    executer: async (_c, args) =>
      consulterApprenants({
        requete: "absents",
        departement: args.departement as string | undefined,
        etablissementId: args.etablissementId ? Number(args.etablissementId) : undefined,
      }),
  },
];
