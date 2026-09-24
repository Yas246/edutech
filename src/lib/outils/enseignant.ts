import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  enseignements,
  evaluations,
  inscriptions,
  matieres,
  notes,
  presences,
  presencesEnseignants,
  users,
} from "@/db/schema";
import type { CompteOutil, Outil } from "./types";

/**
 * Les outils de l'enseignant : ses classes, ses évaluations, ses
 * apprenants — et son propre pointage, visible comme pour tout le monde.
 */

/** Les classes où l'enseignant enseigne. */
async function classesDe(compte: CompteOutil): Promise<number[]> {
  const lignes = await db
    .selectDistinct({ classeId: enseignements.classeId })
    .from(enseignements)
    .where(eq(enseignements.enseignantUserId, compte.id));
  return lignes.map((l) => l.classeId);
}

export type MesClasse = { id: number; nom: string; matieres: string[]; effectifs: number };

/** Les classes de l'enseignant, avec les matières qu'il y porte. */
export async function mesClasses(compte: CompteOutil): Promise<MesClasse[]> {
  const attributions = await db
    .select({
      classeId: classes.id,
      classeNom: classes.nom,
      matiere: matieres.nom,
    })
    .from(enseignements)
    .innerJoin(classes, eq(classes.id, enseignements.classeId))
    .innerJoin(matieres, eq(matieres.id, enseignements.matiereId))
    .where(eq(enseignements.enseignantUserId, compte.id));

  if (attributions.length === 0) return [];
  const ids = [...new Set(attributions.map((a) => a.classeId))];
  const effectifs = await db
    .select({ classeId: inscriptions.classeId, n: sql<number>`count(*)` })
    .from(inscriptions)
    .where(inArray(inscriptions.classeId, ids))
    .groupBy(inscriptions.classeId);

  return ids.map((id) => {
    const lignes = attributions.filter((a) => a.classeId === id);
    return {
      id,
      nom: lignes[0].classeNom,
      matieres: lignes.map((l) => l.matiere),
      effectifs: Number(effectifs.find((e) => e.classeId === id)?.n ?? 0),
    };
  });
}

export type NotesManquantes = {
  evaluation: string;
  classe: string;
  matiere: string;
  date: string;
  attendus: number;
  saisis: number;
  manquants: string[];
};

/** Les élèves notés et manquants d'une évaluation que l'enseignant porte. */
export async function notesManquantes(
  compte: CompteOutil,
  evaluationId: number,
): Promise<NotesManquantes | null> {
  const mesClassesIds = await classesDe(compte);
  if (mesClassesIds.length === 0) return null;

  const [ev] = await db
    .select({
      id: evaluations.id,
      titre: evaluations.titre,
      date: evaluations.date,
      classeId: evaluations.classeId,
      classe: classes.nom,
      matiere: matieres.nom,
    })
    .from(evaluations)
    .innerJoin(classes, eq(classes.id, evaluations.classeId))
    .innerJoin(matieres, eq(matieres.id, evaluations.matiereId))
    .where(and(eq(evaluations.id, evaluationId), inArray(evaluations.classeId, mesClassesIds)))
    .limit(1);
  if (!ev) return null;

  const eleves = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(inscriptions)
    .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, ev.classeId));

  const saisis = await db
    .select({ eleveUserId: notes.eleveUserId })
    .from(notes)
    .where(eq(notes.evaluationId, evaluationId));
  const idsSaisis = new Set(saisis.map((s) => s.eleveUserId));

  return {
    evaluation: ev.titre,
    classe: ev.classe,
    matiere: ev.matiere,
    date: ev.date,
    attendus: eleves.length,
    saisis: idsSaisis.size,
    manquants: eleves
      .filter((e) => !idsSaisis.has(e.id))
      .map((e) => `${e.prenom} ${e.nom}`),
  };
}

export type AbsenceRecente = {
  eleve: string;
  classe: string;
  date: string;
  statut: string;
  motif: string;
};

/** Les absences et retards des quatorze derniers jours dans ses classes. */
export async function absencesRecentes(compte: CompteOutil): Promise<AbsenceRecente[]> {
  const mesClassesIds = await classesDe(compte);
  if (mesClassesIds.length === 0) return [];

  const lignes = await db
    .select({
      prenom: users.prenom,
      nom: users.nom,
      classe: classes.nom,
      date: presences.date,
      statut: presences.statut,
      motif: presences.motif,
    })
    .from(presences)
    .innerJoin(users, eq(users.id, presences.eleveUserId))
    .innerJoin(classes, eq(classes.id, presences.classeId))
    .where(
      and(
        inArray(presences.classeId, mesClassesIds),
        sql`${presences.statut} IN ('absent','absent_justifie','retard')`,
        sql`${presences.date} >= CURRENT_DATE - 14`,
      ),
    )
    .orderBy(sql`${presences.date} DESC`)
    .limit(30);
  return lignes.map((l) => ({
    eleve: `${l.prenom} ${l.nom}`,
    classe: l.classe,
    date: l.date,
    statut: l.statut,
    motif: l.motif,
  }));
}

export type MonAssiduite = {
  presents: number;
  retards: number;
  absents: number;
  taux: number | null;
};

/** Le propre pointage de l'enseignant, sur trente jours : la transparence. */
export async function monAssiduite(compte: CompteOutil): Promise<MonAssiduite> {
  const lignes = await db
    .select({ statut: presencesEnseignants.statut })
    .from(presencesEnseignants)
    .where(
      and(
        eq(presencesEnseignants.enseignantUserId, compte.id),
        sql`${presencesEnseignants.date} >= CURRENT_DATE - 30`,
      ),
    );
  const presents = lignes.filter((l) => l.statut === "present").length;
  const retards = lignes.filter((l) => l.statut === "retard").length;
  const absents = lignes.filter((l) => l.statut === "absent").length;
  const total = lignes.length;
  return {
    presents,
    retards,
    absents,
    taux: total > 0 ? Number(((100 * presents) / total).toFixed(1)) : null,
  };
}

export const outilsEnseignant: Outil[] = [
  {
    nom: "mes_classes",
    description:
      "Les classes où j'enseigne, avec les matières que j'y porte et les effectifs.",
    roles: ["enseignant"],
    parametres: [],
    executer: async (compte) => mesClasses(compte),
  },
  {
    nom: "notes_manquantes",
    description:
      "Les élèves qui n'ont pas encore de note pour une de mes évaluations, avec le total saisi.",
    roles: ["enseignant"],
    parametres: [
      { nom: "evaluationId", description: "Identifiant de l'évaluation.", type: "nombre", obligatoire: true },
    ],
    executer: async (compte, args) => notesManquantes(compte, Number(args.evaluationId)),
  },
  {
    nom: "absences_recentes",
    description:
      "Les absences et retards des quatorze derniers jours dans mes classes, élève par élève.",
    roles: ["enseignant"],
    parametres: [],
    executer: async (compte) => absencesRecentes(compte),
  },
  {
    nom: "mon_assiduite",
    description:
      "Mon propre pointage de présence des trente derniers jours : présents, retards, absents et taux.",
    roles: ["enseignant"],
    parametres: [],
    executer: async (compte) => monAssiduite(compte),
  },
];
