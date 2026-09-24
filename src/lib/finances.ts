import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, etablissements, factures, frais, fraisEleves, inscriptions, paiements, periodes, tranches, users } from "@/db/schema";

export type EtatFacture =
  | "a_payer"
  | "partiellement_paye"
  | "paye"
  | "en_retard"
  | "annule";

export type FactureDetail = {
  id: number;
  numero: string;
  eleveUserId: number;
  eleveNom: string;
  etablissementId: number;
  fraisLibelle: string;
  montantTotal: number;
  paye: number;
  restant: number;
  etat: EtatFacture;
  tranches: {
    id: number;
    ordre: number;
    montant: number;
    echeance: string;
    couvert: number;
    couverte: boolean;
    echue: boolean;
  }[];
  paiements: {
    id: number;
    montant: number;
    mode: string;
    note: string;
    recuNumero: string;
    auteur: string;
    annule: boolean;
    motifAnnulation: string;
    date: string;
  }[];
};

/** Le libellé complet d'un frais : catégorie ou nom libre. */
export function libelleFrais(f: {
  categorie: string;
  libelle: string;
  periodeNom: string | null;
}) {
  const categories: Record<string, string> = {
    inscription: "Frais d'inscription",
    scolarite: "Scolarité",
    td: "Travaux dirigés",
    tenue: "Tenue scolaire",
    examen: "Frais d'examen",
    cantine: "Cantine",
    transport: "Transport",
    fournitures: "Fournitures",
    etude_dossier: "Étude de dossier",
    autre: "Autre frais",
  };
  const base = f.categorie === "autre" && f.libelle ? f.libelle : (categories[f.categorie] ?? f.categorie);
  return f.periodeNom ? `${base} (${f.periodeNom})` : base;
}

/**
 * Les statuts sont recalculés à chaque lecture, jamais stockés :
 * impossible qu'ils dérivent tout seuls.
 */
export function calculerEtat(
  tranches_: { montant: number; echeance: string }[],
  montantPaye: number,
): EtatFacture {
  const total = tranches_.reduce((a, t) => a + t.montant, 0);
  if (montantPaye >= total) return "paye";
  if (montantPaye > 0) return "partiellement_paye";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (tranches_.some((t) => t.echeance < aujourdhui)) return "en_retard";
  return "a_payer";
}

export const libellesEtat: Record<EtatFacture, string> = {
  a_payer: "À payer",
  partiellement_paye: "Partiellement payé",
  paye: "Payé",
  en_retard: "En retard",
  annule: "Annulée",
};

/** La facture complète d'un élève : tranches couvertes et paiements. */
export async function detailFacture(idFacture: number): Promise<FactureDetail | null> {
  const [ligne] = await db
    .select({
      id: factures.id,
      numero: factures.numero,
      eleveUserId: factures.eleveUserId,
      elevePrenom: users.prenom,
      eleveNom: users.nom,
      etablissementId: frais.etablissementId,
      categorie: frais.categorie,
      libelle: frais.libelle,
      periodeNom: periodes.nom,
    })
    .from(factures)
    .innerJoin(users, eq(users.id, factures.eleveUserId))
    .innerJoin(frais, eq(frais.id, factures.fraisId))
    .leftJoin(periodes, eq(periodes.id, factures.periodeId))
    .where(eq(factures.id, idFacture))
    .limit(1);
  if (!ligne) return null;

  const tranches_ = await db
    .select()
    .from(tranches)
    .where(eq(tranches.factureId, idFacture))
    .orderBy(tranches.ordre);

  const paiements_ = await db
    .select({
      id: paiements.id,
      montant: paiements.montant,
      mode: paiements.mode,
      note: paiements.note,
      recuNumero: paiements.recuNumero,
      annule: paiements.annule,
      motifAnnulation: paiements.motifAnnulation,
      date: paiements.createdAt,
      auteurPrenom: users.prenom,
      auteurNom: users.nom,
    })
    .from(paiements)
    .innerJoin(users, eq(users.id, paiements.auteurUserId))
    .where(eq(paiements.factureId, idFacture))
    .orderBy(paiements.id);

  // Affectation : l'argent couvre d'abord la tranche la plus ancienne
  // non couverte (l'annulation retire sa couverture).
  const valide = paiements_.filter((p) => !p.annule);
  const paye = valide.reduce((a, p) => a + p.montant, 0);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let reste = paye;
  const tranchesDetaillees = tranches_.map((t) => {
    const couvert = Math.min(reste, t.montant);
    reste -= couvert;
    return {
      id: t.id,
      ordre: t.ordre,
      montant: t.montant,
      echeance: t.echeance,
      couvert,
      couverte: couvert >= t.montant,
      echue: t.echeance < aujourdhui && couvert < t.montant,
    };
  });

  return {
    id: ligne.id,
    numero: ligne.numero,
    eleveUserId: ligne.eleveUserId,
    eleveNom: `${ligne.elevePrenom} ${ligne.eleveNom}`,
    etablissementId: ligne.etablissementId,
    fraisLibelle: libelleFrais({
      categorie: ligne.categorie,
      libelle: ligne.libelle,
      periodeNom: ligne.periodeNom,
    }),
    montantTotal: tranches_.reduce((a, t) => a + t.montant, 0),
    paye,
    restant: 0,
    etat: calculerEtat(tranches_, paye),
    tranches: tranchesDetaillees,
    paiements: paiements_.map((p) => ({
      id: p.id,
      montant: p.montant,
      mode: p.mode,
      note: p.note,
      recuNumero: p.recuNumero,
      annule: p.annule,
      motifAnnulation: p.motifAnnulation,
      date: p.date.toISOString().slice(0, 10),
      auteur: `${p.auteurPrenom} ${p.auteurNom}`,
    })),
  };
}

/** Les élèves visés par un frais, selon sa cible. */
export async function elevesVises(f: {
  id: number;
  cibleType: string;
  cibleClasseId: number | null;
  cibleNiveau: string;
}): Promise<number[]> {
  if (f.cibleType === "eleves") {
    const lignes = await db
      .select({ id: fraisEleves.eleveUserId })
      .from(fraisEleves)
      .where(eq(fraisEleves.fraisId, f.id));
    return lignes.map((l) => l.id);
  }
  if (f.cibleType === "classe" && f.cibleClasseId) {
    const lignes = await db
      .select({ id: inscriptions.eleveUserId })
      .from(inscriptions)
      .where(eq(inscriptions.classeId, f.cibleClasseId));
    return lignes.map((l) => l.id);
  }
  if (f.cibleType === "niveau" && f.cibleNiveau) {
    const lignes = await db
      .select({ id: inscriptions.eleveUserId })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(classes.niveau, f.cibleNiveau));
    return lignes.map((l) => l.id);
  }
  return [];
}

/** Le prochain numéro de pièce, numéroté par établissement. */
export async function prochainNumero(
  idEtablissement: number,
  colonne: "factureSeq" | "recuSeq",
  prefixe: string,
): Promise<string> {
  const [ecole] = await db
    .select({ seq: etablissements[colonne] })
    .from(etablissements)
    .where(eq(etablissements.id, idEtablissement))
    .limit(1);
  const suivant = (ecole?.seq ?? 0) + 1;
  await db
    .update(etablissements)
    .set({ [colonne]: suivant })
    .where(eq(etablissements.id, idEtablissement));
  return `${prefixe}-${idEtablissement}-${String(suivant).padStart(4, "0")}`;
}
