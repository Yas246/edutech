import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  devoirs,
  evaluations,
  factures,
  frais,
  inscriptions,
  liensFamille,
  matieres,
  notes,
  periodes,
  presences,
  tranches,
  users,
} from "@/db/schema";
import { libelleFrais } from "@/lib/finances";
import { orienter } from "@/lib/orientation";
import type { CompteOutil, Outil } from "./types";

/**
 * Les outils de la famille : le parent suit SES enfants, l'élève se
 * suit lui-même. Les montants restent réservés au parent ; l'élève qui
 * les demande reçoit un refus clair, pas un chiffre.
 */

/** Les enfants suivis par le compte (l'élève se suit lui-même). */
async function enfantsDe(compte: CompteOutil): Promise<number[]> {
  if (compte.role === "eleve") return [compte.id];
  const liens = await db
    .select({ eleveUserId: liensFamille.eleveUserId })
    .from(liensFamille)
    .where(eq(liensFamille.parentUserId, compte.id));
  return liens.map((l) => l.eleveUserId);
}

export type SituationEnfant = {
  enfant: string;
  classe: string;
  moyenne: number | null;
  absences: number;
  retards: number;
  devoirsSemaine: { matiere: string; titre: string; aRendreLe: string }[];
};

/** La situation d'un enfant (ou de tous) : moyenne, présences, devoirs. */
export async function situationEnfant(
  compte: CompteOutil,
  eleveUserId?: number,
): Promise<SituationEnfant[]> {
  let ids = await enfantsDe(compte);
  if (eleveUserId && ids.includes(eleveUserId)) ids = [eleveUserId];

  const situations: SituationEnfant[] = [];
  for (const id of ids) {
    const [eleve] = await db
      .select({ prenom: users.prenom, nom: users.nom })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!eleve) continue;

    const [classe] = await db
      .select({ nom: classes.nom })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(inscriptions.eleveUserId, id))
      .limit(1);

    const moyenne = await moyenneEleve(id);
    const [comptePresences] = await db
      .select({
        absences: sql<number>`count(*) FILTER (WHERE statut = 'absent')`,
        retards: sql<number>`count(*) FILTER (WHERE statut = 'retard')`,
      })
      .from(presences)
      .where(eq(presences.eleveUserId, id));
    const devoirsSemaine = await db
      .select({ matiere: matieres.nom, titre: devoirs.titre, aRendreLe: devoirs.aRendreLe })
      .from(devoirs)
      .innerJoin(inscriptions, eq(inscriptions.classeId, devoirs.classeId))
      .innerJoin(matieres, eq(matieres.id, devoirs.matiereId))
      .where(and(eq(inscriptions.eleveUserId, id), sql`${devoirs.aRendreLe} >= CURRENT_DATE`))
      .limit(5);

    situations.push({
      enfant: `${eleve.prenom} ${eleve.nom}`,
      classe: classe?.nom ?? "—",
      moyenne,
      absences: Number(comptePresences?.absences ?? 0),
      retards: Number(comptePresences?.retards ?? 0),
      devoirsSemaine,
    });
  }
  return situations;
}

/** La moyenne générale de l'élève, règle des bulletins appliquée. */
async function moyenneEleve(idEleve: number): Promise<number | null> {
  const [ligne] = await db
    .select({
      moyenne: sql<number | null>`round(AVG(CASE WHEN ${notes.absent} AND ${notes.justifie} THEN NULL
        WHEN ${notes.absent} THEN 0
        ELSE ${notes.valeur} / ${evaluations.bareme} * 20 END)::numeric, 2)`,
    })
    .from(notes)
    .innerJoin(evaluations, eq(evaluations.id, notes.evaluationId))
    .where(eq(notes.eleveUserId, idEleve));
  return ligne?.moyenne === null || ligne?.moyenne === undefined ? null : Number(ligne.moyenne);
}

export type Echeance = {
  enfant: string;
  frais: string;
  montant: number;
  echeance: string;
};

/** Les échéances à venir sur des factures non soldées : PARENT uniquement. */
export async function prochainesEcheances(compte: CompteOutil): Promise<Echeance[]> {
  const ids = await enfantsDe(compte);
  if (ids.length === 0) return [];

  const noms = await db
    .select({ id: users.id, identite: sql<string>`prenom || ' ' || nom` })
    .from(users)
    .where(inArray(users.id, ids));

  const lignes = await db
    .select({
      eleveUserId: factures.eleveUserId,
      categorie: frais.categorie,
      libelle: frais.libelle,
      periodeNom: periodes.nom,
      montant: tranches.montant,
      echeance: tranches.echeance,
    })
    .from(tranches)
    .innerJoin(factures, eq(factures.id, tranches.factureId))
    .innerJoin(frais, eq(frais.id, factures.fraisId))
    .leftJoin(periodes, eq(periodes.id, factures.periodeId))
    .where(
      and(
        inArray(factures.eleveUserId, ids),
        sql`${tranches.echeance} >= CURRENT_DATE`,
        sql`EXISTS (
          SELECT 1 FROM factures f2
          WHERE f2.id = ${factures.id}
            AND COALESCE((SELECT sum(p.montant) FROM paiements p
                WHERE p.facture_id = f2.id AND p.annule = false), 0)
              < (SELECT sum(t.montant) FROM tranches t WHERE t.facture_id = f2.id)
        )`,
      ),
    )
    .orderBy(tranches.echeance)
    .limit(20);

  return lignes.map((l) => ({
    enfant: noms.find((n) => n.id === l.eleveUserId)?.identite ?? "—",
    frais: libelleFrais({
      categorie: l.categorie,
      libelle: l.libelle,
      periodeNom: l.periodeNom,
    }),
    montant: l.montant,
    echeance: l.echeance,
  }));
}

export type LigneNote = {
  matiere: string;
  titre: string;
  note: number;
  date: string;
};

/** Les notes de l'élève : ramenées sur 20, la plus récente d'abord. */
export async function mesNotes(compte: CompteOutil): Promise<LigneNote[]> {
  const lignes = await db
    .select({
      matiere: matieres.nom,
      titre: evaluations.titre,
      valeur: notes.valeur,
      bareme: evaluations.bareme,
      absent: notes.absent,
      justifie: notes.justifie,
      date: evaluations.date,
    })
    .from(notes)
    .innerJoin(evaluations, eq(evaluations.id, notes.evaluationId))
    .innerJoin(matieres, eq(matieres.id, evaluations.matiereId))
    .where(eq(notes.eleveUserId, compte.id))
    .orderBy(desc(evaluations.date))
    .limit(20);
  return lignes.map((l) => ({
    matiere: l.matiere,
    titre: l.titre,
    note: l.absent && !l.justifie ? 0 : Number(((Number(l.valeur) / l.bareme) * 20).toFixed(2)),
    date: l.date,
  }));
}

export type MesAbsences = {
  absences: number;
  absencesJustifiees: number;
  retards: number;
  recentes: { date: string; statut: string; motif: string }[];
};

/** Les absences et retards de l'élève, compte et liste récente. */
export async function mesAbsences(compte: CompteOutil): Promise<MesAbsences> {
  const lignes = await db
    .select({ date: presences.date, statut: presences.statut, motif: presences.motif })
    .from(presences)
    .where(
      and(
        eq(presences.eleveUserId, compte.id),
        sql`${presences.statut} <> 'present'`,
      ),
    )
    .orderBy(desc(presences.date))
    .limit(15);
  const [tous] = await db
    .select({
      absences: sql<number>`count(*) FILTER (WHERE statut = 'absent')`,
      justifiees: sql<number>`count(*) FILTER (WHERE statut = 'absent_justifie')`,
      retards: sql<number>`count(*) FILTER (WHERE statut = 'retard')`,
    })
    .from(presences)
    .where(eq(presences.eleveUserId, compte.id));
  return {
    absences: Number(tous?.absences ?? 0),
    absencesJustifiees: Number(tous?.justifiees ?? 0),
    retards: Number(tous?.retards ?? 0),
    recentes: lignes,
  };
}

/** La boussole d'orientation : les intérêts de l'élève face aux familles de métiers. */
export async function monOrientation(compte: CompteOutil) {
  const resultats = orienter(compte.interets);
  if (resultats.length === 0) {
    return {
      message:
        "Aucun centre d'intérêt connu pour l'instant : les parcours « premiers pas » permettent de les déclarer, puis la boussole propose des familles de métiers, des filières et des établissements.",
      resultats: [],
    };
  }
  return { message: "", resultats };
}

export const outilsFamille: Outil[] = [
  {
    nom: "situation_enfant",
    description:
      "Pour un parent : la situation de son enfant (ou de chacun de ses enfants) : moyenne, absences, retards, devoirs à rendre. Pour un élève : sa propre situation.",
    roles: ["parent", "eleve"],
    parametres: [
      { nom: "eleveUserId", description: "Identifiant de l'enfant visé. Absent = tous les enfants.", type: "nombre", obligatoire: false },
    ],
    executer: async (compte, args) =>
      situationEnfant(compte, args.eleveUserId ? Number(args.eleveUserId) : undefined),
  },
  {
    nom: "prochaines_echeances",
    description:
      "Les échéances de paiement à venir sur les factures non soldées de mes enfants, avec le montant et la date. Réservé au parent.",
    roles: ["parent"],
    parametres: [],
    executer: async (compte) => prochainesEcheances(compte),
  },
  {
    nom: "mes_notes",
    description: "Mes dernières notes, ramenées sur 20, matière par matière.",
    roles: ["eleve"],
    parametres: [],
    executer: async (compte) => mesNotes(compte),
  },
  {
    nom: "mes_absences",
    description: "Mes absences et mes retards, avec le détail des quinze dernières.",
    roles: ["eleve"],
    parametres: [],
    executer: async (compte) => mesAbsences(compte),
  },
  {
    nom: "mon_orientation",
    description:
      "Ma boussole d'orientation : à partir de mes centres d'intérêts, les familles de métiers, les filières et les établissements du Bénin.",
    roles: ["eleve"],
    parametres: [],
    executer: async (compte) => monOrientation(compte),
  },
];
