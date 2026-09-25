import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  etablissements,
  evaluations,
  inscriptions,
  matieres,
  notes,
  periodes,
  presences,
  publicationsBulletins,
  users,
} from "@/db/schema";

export type BulletinMatiere = {
  nom: string;
  coefficient: number;
  /** Moyenne de l'élève dans la matière, ramenée sur 20. */
  moyenneSur20: number | null;
  /** Notes ramenées sur 20 qui composent cette moyenne. */
  detailSur20: number[];
};

export type BulletinEleve = {
  eleveId: number;
  prenom: string;
  nom: string;
  matieres: BulletinMatiere[];
  /** Moyenne générale pondérée par les coefficients. */
  moyenneGenerale: number | null;
  /** Rang dans la classe (1 = premier). */
  rang: number | null;
  absencesNonJustifiees: number;
  absencesJustifiees: number;
  retards: number;
};

export type BulletinsClasse = {
  classeId: number;
  classeNom: string;
  etablissementNom: string;
  commune: string;
  departement: string;
  periode: { id: number; nom: string; debut: string; fin: string } | null;
  eleves: BulletinEleve[];
  publie: boolean;
  /** L'échelle des moyennes choisie par l'établissement. */
  echelle: number;
};

/** La période active de l'établissement de la classe, sinon aucune. */
export async function periodeActive(classeId: number) {
  const [ligne] = await db
    .select({
      id: periodes.id,
      nom: periodes.nom,
      debut: periodes.debut,
      fin: periodes.fin,
    })
    .from(periodes)
    .innerJoin(classes, eq(classes.etablissementId, periodes.etablissementId))
    .where(and(eq(classes.id, classeId), eq(periodes.active, true)))
    .limit(1);
  return ligne ?? null;
}

export function periodePubliee(classeId: number, periodeId: number | null) {
  if (!periodeId) return false;
  return db
    .select({ id: publicationsBulletins.id })
    .from(publicationsBulletins)
    .where(
      and(
        eq(publicationsBulletins.classeId, classeId),
        eq(publicationsBulletins.periodeId, periodeId),
      ),
    )
    .limit(1)
    .then((lignes) => lignes.length > 0);
}

/**
 * La source unique des calculs du bulletin : notes ramenées sur 20,
 * moyenne par matière, moyenne générale pondérée par coefficient,
 * rang par moyenne décroissante, absences de la période.
 */
export async function chargerBulletins(classeId: number): Promise<BulletinsClasse> {
  let [classe] = await db
    .select({
      id: classes.id,
      nom: classes.nom,
      etablissementNom: etablissements.nom,
      commune: etablissements.commune,
      departement: etablissements.departement,
      echelle: etablissements.echelle,
    })
    .from(classes)
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(classes.id, classeId))
    .limit(1);
  const echelle = classe ? Number(classe.echelle) || 20 : 20;

  const programme = await db
    .select({ id: matieres.id, nom: matieres.nom, coefficient: matieres.coefficient })
    .from(matieres)
    .where(eq(matieres.classeId, classeId))
    .orderBy(asc(matieres.nom));

  const elevesInscrits = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(inscriptions)
    .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, classeId))
    .orderBy(asc(users.nom));

  const periode = await periodeActive(classeId);

  // Évaluations de la classe, avec les notes de chacun.
  // Règle d'absence (reprise du modèle de référence) : absence non
  // justifiée = 0 dans la moyenne ; absence justifiée = épreuve exclue.
  const lignesNotes = await db
    .select({
      eleveUserId: notes.eleveUserId,
      matiereId: evaluations.matiereId,
      valeur: notes.valeur,
      bareme: evaluations.bareme,
      absent: notes.absent,
      justifie: notes.justifie,
    })
    .from(evaluations)
    .innerJoin(notes, eq(notes.evaluationId, evaluations.id))
    .where(eq(evaluations.classeId, classeId));

  // Présences de la période (ou de l'année si aucune période active).
  const conditionsPresence = [eq(presences.classeId, classeId)];
  if (periode) {
    conditionsPresence.push(gte(presences.date, periode.debut));
    conditionsPresence.push(lte(presences.date, periode.fin));
  }
  const lignesPresences = await db
    .select({ eleveUserId: presences.eleveUserId, statut: presences.statut })
    .from(presences)
    .where(and(...conditionsPresence));

  const resultats: BulletinEleve[] = elevesInscrits.map((eleve) => {
    const matieresEleve: BulletinMatiere[] = programme.map((m) => {
      const notesMatiere = lignesNotes
        .filter((n) => n.eleveUserId === eleve.id && n.matiereId === m.id)
        .filter((n) => !(n.absent && n.justifie))
        .map((n) => (n.absent ? 0 : (Number(n.valeur) / n.bareme) * 20 * (echelle / 20)));
      const moyenne =
        notesMatiere.length > 0
          ? notesMatiere.reduce((a, b) => a + b, 0) / notesMatiere.length
          : null;
      return {
        nom: m.nom,
        coefficient: m.coefficient,
        moyenneSur20: moyenne,
        detailSur20: notesMatiere,
      };
    });

    // Pondération : seules les matières notées comptent dans la somme.
    let sommePonderee = 0;
    let sommeCoefficients = 0;
    for (const m of matieresEleve) {
      if (m.moyenneSur20 === null) continue;
      sommePonderee += m.moyenneSur20 * m.coefficient;
      sommeCoefficients += m.coefficient;
    }

    const abs = lignesPresences.filter((p) => p.eleveUserId === eleve.id);
    return {
      eleveId: eleve.id,
      prenom: eleve.prenom,
      nom: eleve.nom,
      matieres: matieresEleve,
      moyenneGenerale: sommeCoefficients > 0 ? sommePonderee / sommeCoefficients : null,
      rang: null,
      absencesNonJustifiees: abs.filter((p) => p.statut === "absent").length,
      absencesJustifiees: abs.filter((p) => p.statut === "absent_justifie").length,
      retards: abs.filter((p) => p.statut === "retard").length,
    };
  });

  // Rang : moyenne décroissante, ex æquo = même place, sans moyenne = dernier.
  const classees = [...resultats]
    .sort((a, b) => (b.moyenneGenerale ?? -1) - (a.moyenneGenerale ?? -1));
  let rangPrecedent = 0;
  let moyennePrecedente: number | null = null;
  classees.forEach((e, index) => {
    if (e.moyenneGenerale === null) {
      e.rang = null;
      return;
    }
    if (
      moyennePrecedente !== null &&
      Math.abs(e.moyenneGenerale - moyennePrecedente) < 0.005
    ) {
      e.rang = rangPrecedent;
      return;
    }
    rangPrecedent = index + 1;
    moyennePrecedente = e.moyenneGenerale;
    e.rang = rangPrecedent;
  });

  return {
    classeId,
    classeNom: classe?.nom ?? "",
    etablissementNom: classe?.etablissementNom ?? "",
    commune: classe?.commune ?? "",
    departement: classe?.departement ?? "",
    periode,
    eleves: resultats,
    publie: periode ? await periodePubliee(classeId, periode.id) : false,
    echelle,
  };
}

/** Formate une moyenne « 12,35 » (affichage français). */
export function formaterMoyenne(valeur: number | null, decimales = 2): string {
  if (valeur === null || Number.isNaN(valeur)) return "—";
  return valeur.toFixed(decimales).replace(".", ",");
}
