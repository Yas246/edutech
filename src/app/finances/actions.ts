"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  classes,
  delegations,
  fraisEleves,
  journal,
  etablissements,
  factures,
  frais,
  inscriptions,
  liensFamille,
  notifications,
  paiements,
  periodes,
  tranches,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { elevesVises, prochainNumero } from "@/lib/finances";

export type Retour = { erreur?: string; message?: string };

/**
 * L'accès aux finances : direction de l'établissement, ou membre de
 * l'équipe délégué au rôle « finances ».
 */
async function gardeFinances(idEtablissement: number) {
  const utilisateur = await exiger("direction", "enseignant");
  if (utilisateur.role === "direction") {
    const [ecole] = await db
      .select({ id: etablissements.id })
      .from(etablissements)
      .where(and(eq(etablissements.id, idEtablissement), eq(etablissements.directionUserId, utilisateur.id)))
      .limit(1);
    return ecole ? utilisateur : null;
  }
  const [delegation] = await db
    .select({ id: delegations.id })
    .from(delegations)
    .where(
      and(
        eq(delegations.etablissementId, idEtablissement),
        eq(delegations.userId, utilisateur.id),
        eq(delegations.role, "finances"),
      ),
    )
    .limit(1);
  return delegation ? utilisateur : null;
}

/** L'établissement rattaché à la direction connectée, pour les gardes. */
/** Inscrit un geste financier au journal de l établissement. */
async function inscrireAuJournal(
  idEtablissement: number,
  auteurId: number,
  action: string,
  detail: string,
) {
  await db.insert(journal).values({ etablissementId: idEtablissement, auteurUserId: auteurId, action, detail });
}

async function idEcoleDeLaDirection(): Promise<number | null> {
  const utilisateur = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, utilisateur.id))
    .limit(1);
  return ecole?.id ?? null;
}

/* --------------------------- Frais --------------------------- */

export async function creerFrais(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idEcole = await idEcoleDeLaDirection();
  if (!idEcole) return { erreur: "Aucun établissement rattaché à votre compte." };
  const utilisateur = await exiger("direction");

  const categorie = String(donnees.get("categorie") ?? "scolarite");
  const libelle = String(donnees.get("libelle") ?? "").trim();
  const montant = Number(donnees.get("montant"));
  const cibleType = String(donnees.get("cibleType") ?? "classe");
  const cibleClasseId = Number(donnees.get("cibleClasseId")) || null;
  const cibleNiveau = String(donnees.get("cibleNiveau") ?? "").trim();
  const periodeId = Number(donnees.get("periodeId")) || null;
  const elevesDesignes = donnees
    .getAll("elevesDesignes")
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);

  if (!Number.isInteger(montant) || montant <= 0) {
    return { erreur: "Indiquez un montant en francs CFA entier, supérieur à zéro." };
  }
  if (cibleType === "classe" && !cibleClasseId) return { erreur: "Choisissez la classe visée." };
  if (cibleType === "niveau" && !cibleNiveau) return { erreur: "Indiquez le niveau visé." };
  if (cibleType === "eleves" && elevesDesignes.length === 0) {
    return { erreur: "Cochez au moins un élève." };
  }
  if (categorie === "autre" && !libelle) {
    return { erreur: "Pour un autre frais, donnez son nom libre." };
  }

  // Toute cible doit appartenir à l'établissement.
  if (cibleClasseId) {
    const [classeEcole] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, cibleClasseId), eq(classes.etablissementId, idEcole)))
      .limit(1);
    if (!classeEcole) return { erreur: "Cette classe n'est pas la vôtre." };
  }
  if (cibleType === "eleves") {
    const elevesEcole = await db
      .select({ id: inscriptions.eleveUserId })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(classes.etablissementId, idEcole));
    const valides = new Set(elevesEcole.map((e) => e.id));
    if (!elevesDesignes.every((id) => valides.has(id))) {
      return { erreur: "Un des élèves cochés n'est pas inscrit chez vous." };
    }
  }

  const [nouveauFrais] = await db
    .insert(frais)
    .values({
      etablissementId: idEcole,
      categorie,
      libelle,
      montant,
      cibleType,
      cibleClasseId: cibleType === "classe" ? cibleClasseId : null,
      cibleNiveau: cibleType === "niveau" ? cibleNiveau : "",
      periodeId,
      creePar: utilisateur.id,
    })
    .returning({ id: frais.id });

  if (cibleType === "eleves") {
    await db
      .insert(fraisEleves)
      .values(elevesDesignes.map((eleveUserId) => ({ fraisId: nouveauFrais.id, eleveUserId })))
      .onConflictDoNothing();
  }

  await inscrireAuJournal(
    idEcole,
    utilisateur.id,
    "Frais posé",
    `${categorie === "autre" ? libelle : categorie} : ${montant.toLocaleString("fr-FR")} F CFA`,
  );
  revalidatePath("/finances");
  return { message: `Frais posé : ${montant.toLocaleString("fr-FR")} F CFA.` };
}

/* ------------------------ Facturation ------------------------ */

export async function genererFactures(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idEcole = await idEcoleDeLaDirection();
  if (!idEcole) return { erreur: "Aucun établissement rattaché à votre compte." };
  const utilisateur = await exiger("direction");

  const fraisId = Number(donnees.get("fraisId"));
  const [unFrais] = await db
    .select()
    .from(frais)
    .where(and(eq(frais.id, fraisId), eq(frais.etablissementId, idEcole)))
    .limit(1);
  if (!unFrais) return { erreur: "Frais introuvable dans votre établissement." };

  // Le découpage en tranches : montants + échéances, la somme doit
  // faire le montant du frais.
  const montants = donnees.getAll("trancheMontant").map((v) => Number(v));
  const echeances = donnees.getAll("trancheEcheance").map((v) => String(v));
  const paires = montants
    .map((montant, i) => ({ montant, echeance: echeances[i] ?? "" }))
    .filter((t) => Number.isInteger(t.montant) && t.montant > 0);
  if (paires.length === 0) return { erreur: "Découpez le montant en au moins une tranche." };
  for (const t of paires) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.echeance)) {
      return { erreur: "Chaque tranche a besoin d'une échéance." };
    }
  }
  const somme = paires.reduce((a, t) => a + t.montant, 0);
  if (somme !== unFrais.montant) {
    return {
      erreur: `La somme des tranches (${somme.toLocaleString("fr-FR")} F) doit faire exactement le montant du frais (${unFrais.montant.toLocaleString("fr-FR")} F).`,
    };
  }

  const ids = await elevesVises(unFrais);
  if (ids.length === 0) return { erreur: "Aucun élève visé par ce frais." };

  let creees = 0;
  for (const eleveId of ids) {
    // Regénérer ne double rien : une facture par frais et par élève.
    const [deja] = await db
      .select({ id: factures.id })
      .from(factures)
      .where(and(eq(factures.fraisId, fraisId), eq(factures.eleveUserId, eleveId)))
      .limit(1);
    if (deja) continue;

    const numero = await prochainNumero(idEcole, "factureSeq", "F");
    const [facture] = await db
      .insert(factures)
      .values({
        numero,
        eleveUserId: eleveId,
        fraisId,
        periodeId: unFrais.periodeId,
      })
      .returning({ id: factures.id });
    await db.insert(tranches).values(
      paires.map((t, i) => ({
        factureId: facture.id,
        ordre: i + 1,
        montant: t.montant,
        echeance: t.echeance,
      })),
    );
    creees += 1;
  }

  await inscrireAuJournal(
    idEcole,
    utilisateur.id,
    "Factures générées",
    creees === 0
      ? "Regénération : rien de nouveau"
      : `${creees} facture(s), ${paires.length} tranche(s) par facture`,
  );
  revalidatePath("/finances");
  return {
    message:
      creees === 0
        ? "Tous les élèves visés ont déjà leur facture : rien n'a été doublé."
        : `${creees} facture${creees > 1 ? "s" : ""} générée${creees > 1 ? "s" : ""} en ${paires.length} tranche${paires.length > 1 ? "s" : ""}.`,
  };
}

/** La facture manuelle : un seul élève, un objet libre, une échéance. */
export async function factureManuelle(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idEcole = await idEcoleDeLaDirection();
  if (!idEcole) return { erreur: "Aucun établissement rattaché à votre compte." };
  const utilisateur = await exiger("direction");

  const eleveUserId = Number(donnees.get("eleveUserId"));
  const objet = String(donnees.get("objet") ?? "").trim();
  const montant = Number(donnees.get("montant"));
  const echeance = String(donnees.get("echeance") ?? "").trim();

  if (!Number.isInteger(eleveUserId)) return { erreur: "Choisissez l'élève." };
  if (!objet) return { erreur: "Indiquez l'objet de la facture." };
  if (!Number.isInteger(montant) || montant <= 0) {
    return { erreur: "Indiquez un montant entier supérieur à zéro." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(echeance)) return { erreur: "Choisissez l'échéance." };

  // L'élève doit appartenir à l'établissement.
  const [inscrit] = await db
    .select({ id: inscriptions.eleveUserId })
    .from(inscriptions)
    .innerJoin(classes, eq(classes.id, inscriptions.classeId))
    .where(and(eq(inscriptions.eleveUserId, eleveUserId), eq(classes.etablissementId, idEcole)))
    .limit(1);
  if (!inscrit) return { erreur: "Cet élève n'est pas inscrit chez vous." };

  // Le frais ponctuel porte l'objet de la facture.
  const [fraisPonctuel] = await db
    .insert(frais)
    .values({
      etablissementId: idEcole,
      categorie: "autre",
      libelle: objet,
      montant,
      cibleType: "niveau",
      cibleNiveau: "",
      creePar: utilisateur.id,
    })
    .returning({ id: frais.id });
  await db
    .insert(fraisEleves)
    .values({ fraisId: fraisPonctuel.id, eleveUserId })
    .onConflictDoNothing();

  const numero = await prochainNumero(idEcole, "factureSeq", "F");
  const [facture] = await db
    .insert(factures)
    .values({ numero, eleveUserId, fraisId: fraisPonctuel.id })
    .returning({ id: factures.id });
  await db.insert(tranches).values({
    factureId: facture.id,
    ordre: 1,
    montant,
    echeance,
  });

  await inscrireAuJournal(
    idEcole,
    utilisateur.id,
    "Facture manuelle",
    `${numero} : ${objet}, ${montant.toLocaleString("fr-FR")} F CFA`,
  );
  revalidatePath("/finances");
  return { message: `Facture ${numero} créée pour ${montant.toLocaleString("fr-FR")} F CFA.` };
}

/* ------------------------ Encaissement ------------------------ */

export async function encaisser(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idFacture = Number(donnees.get("factureId"));
  const [facture] = await db
    .select({
      id: factures.id,
      eleveUserId: factures.eleveUserId,
      fraisId: factures.fraisId,
    })
    .from(factures)
    .where(eq(factures.id, idFacture))
    .limit(1);
  if (!facture) return { erreur: "Facture introuvable." };

  const [leFrais] = await db
    .select({ etablissementId: frais.etablissementId })
    .from(frais)
    .where(eq(frais.id, facture.fraisId))
    .limit(1);
  const utilisateur = await gardeFinances(leFrais.etablissementId);
  if (!utilisateur) return { erreur: "Vous n'avez pas accès aux finances de cet établissement." };

  const montant = Number(donnees.get("montant"));
  const mode = String(donnees.get("mode") ?? "especes");
  const note = String(donnees.get("note") ?? "").trim();
  if (!Number.isInteger(montant) || montant <= 0) {
    return { erreur: "Indiquez le montant reçu, en francs CFA entiers." };
  }
  if (!["especes", "virement", "mobile_money"].includes(mode)) {
    return { erreur: "Mode de paiement inconnu." };
  }

  // Le restant dû : on ne dépasse jamais.
  const tranches_ = await db.select().from(tranches).where(eq(tranches.factureId, idFacture));
  const anciens = await db
    .select({ montant: paiements.montant, annule: paiements.annule })
    .from(paiements)
    .where(eq(paiements.factureId, idFacture));
  const paye = anciens.filter((p) => !p.annule).reduce((a, p) => a + p.montant, 0);
  const total = tranches_.reduce((a, t) => a + t.montant, 0);
  const restant = total - paye;
  if (montant > restant) {
    return {
      erreur: `Paiement refusé : le restant dû est de ${restant.toLocaleString("fr-FR")} F CFA (un trop-perçu ne peut pas être enregistré).`,
    };
  }

  const numeroRecu = await prochainNumero(leFrais.etablissementId, "recuSeq", "REC");
  await db.insert(paiements).values({
    factureId: idFacture,
    montant,
    mode,
    note,
    recuNumero: numeroRecu,
    auteurUserId: utilisateur.id,
  });

  // Le parent est prévenu de l'encaissement.
  const [eleve] = await db
    .select({ prenom: users.prenom, nom: users.nom })
    .from(users)
    .where(eq(users.id, facture.eleveUserId))
    .limit(1);
  const liens = await db
    .select({ parentUserId: liensFamille.parentUserId })
    .from(liensFamille)
    .where(eq(liensFamille.eleveUserId, facture.eleveUserId));
  if (liens.length > 0) {
    await db.insert(notifications).values(
      liens.map((l) => ({
        userId: l.parentUserId,
        texte: `Paiement reçu : ${montant.toLocaleString("fr-FR")} F CFA pour ${eleve ? `${eleve.prenom} ${eleve.nom}` : "votre enfant"} (reçu ${numeroRecu}).`,
        lien: "/mes-finances",
      })),
    );
  }

  await inscrireAuJournal(
    leFrais.etablissementId,
    utilisateur.id,
    "Paiement encaissé",
    `${numeroRecu} : ${montant.toLocaleString("fr-FR")} F CFA`,
  );
  revalidatePath(`/finances/factures/${idFacture}`);
  revalidatePath("/finances");
  return { message: `Encaissé ${montant.toLocaleString("fr-FR")} F CFA. Reçu ${numeroRecu}.` };
}

/** Annuler un paiement : jamais effacer, toujours tracer. */
export async function annulerPaiement(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idPaiement = Number(donnees.get("paiementId"));
  const motif = String(donnees.get("motif") ?? "").trim();
  if (!motif) return { erreur: "Un motif est obligatoire pour annuler un paiement." };

  const [paiement] = await db
    .select({
      id: paiements.id,
      factureId: paiements.factureId,
      recuNumero: paiements.recuNumero,
    })
    .from(paiements)
    .where(eq(paiements.id, idPaiement))
    .limit(1);
  if (!paiement) return { erreur: "Paiement introuvable." };

  const [facture] = await db
    .select({ fraisId: factures.fraisId })
    .from(factures)
    .where(eq(factures.id, paiement.factureId))
    .limit(1);
  const [leFrais] = await db
    .select({ etablissementId: frais.etablissementId })
    .from(frais)
    .where(eq(frais.id, facture.fraisId))
    .limit(1);
  const utilisateur = await gardeFinances(leFrais.etablissementId);
  if (!utilisateur) return { erreur: "Accès refusé." };

  await db
    .update(paiements)
    .set({ annule: true, motifAnnulation: motif })
    .where(eq(paiements.id, idPaiement));

  await inscrireAuJournal(
    leFrais.etablissementId,
    utilisateur.id,
    "Paiement annulé",
    `${paiement.recuNumero} — motif : ${motif}`,
  );
  revalidatePath(`/finances/factures/${paiement.factureId}`);
  revalidatePath("/finances");
  return {
    message: `Paiement annulé (reçu ${paiement.recuNumero}). La trace reste dans le dossier.`,
  };
}

/* ------------------------ Délégation ------------------------ */

export async function deleguerFinances(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idEcole = await idEcoleDeLaDirection();
  if (!idEcole) return { erreur: "Aucun établissement rattaché." };
  const idMembre = Number(donnees.get("userId"));
  const [membre] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, idMembre), eq(users.role, "enseignant")))
    .limit(1);
  if (!membre) return { erreur: "Compte membre de l'équipe introuvable." };

  await db
    .insert(delegations)
    .values({ etablissementId: idEcole, userId: idMembre, role: "finances" })
    .onConflictDoNothing();
  const idEcole2 = await idEcoleDeLaDirection();
  if (idEcole2) {
    await inscrireAuJournal(
      idEcole2,
      membre.id,
      "Délégation des finances",
      `posée à ${membre.prenom} ${membre.nom}`,
    );
  }
  revalidatePath("/finances");
  return {
    message: `${membre.prenom} ${membre.nom} peut désormais tenir les finances de votre établissement.`,
  };
}

export async function retirerDelegation(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idEcole = await idEcoleDeLaDirection();
  if (!idEcole) return { erreur: "Aucun établissement rattaché." };
  const idMembre = Number(donnees.get("userId"));
  await db
    .delete(delegations)
    .where(
      and(
        eq(delegations.etablissementId, idEcole),
        eq(delegations.userId, idMembre),
        eq(delegations.role, "finances"),
      ),
    );
  const idEcole3 = await idEcoleDeLaDirection();
  if (idEcole3) {
    const utilisateur3 = await exiger("direction");
    await inscrireAuJournal(idEcole3, utilisateur3.id, "Délégation des finances", "retirée");
  }
  revalidatePath("/finances");
  return { message: "Délégation retirée." };
}

/* ------------------ Paiement Mobile Money (simulé) ------------------ */

/**
 * Le parent paie depuis son espace : écran de paiement simulé (le
 * processeur réel se branchera derrière la même interface).
 */
export async function payerMobileMoney(_prec: Retour, donnees: FormData): Promise<Retour> {
  const parent = await exiger("parent");
  const idFacture = Number(donnees.get("factureId"));
  const montant = Number(donnees.get("montant"));
  const operateur = String(donnees.get("operateur") ?? "mtn");
  const telephone = String(donnees.get("telephone") ?? "").trim();
  const [lien] = await db
    .select({ id: liensFamille.id })
    .from(liensFamille)
    .where(
      and(
        eq(liensFamille.parentUserId, parent.id),
        eq(liensFamille.eleveUserId,
          (await db
            .select({ id: factures.eleveUserId })
            .from(factures)
            .where(eq(factures.id, idFacture))
            .limit(1))[0]?.id ?? -1),
      ),
    )
    .limit(1);
  if (!lien) return { erreur: "Cette facture ne concerne pas vos enfants." };

  if (!Number.isInteger(montant) || montant <= 0) {
    return { erreur: "Indiquez le montant à payer." };
  }
  if (!["mtn", "moov"].includes(operateur)) return { erreur: "Choisissez MTN ou Moov." };
  if (telephone.replace(/\D/g, "").length < 8) {
    return { erreur: "Indiquez le numéro Mobile Money qui paie." };
  }

  // Le même garde-fou que le guichet : jamais plus que le restant dû.
  const tranches_ = await db.select().from(tranches).where(eq(tranches.factureId, idFacture));
  const anciens = await db
    .select({ montant: paiements.montant, annule: paiements.annule })
    .from(paiements)
    .where(eq(paiements.factureId, idFacture));
  const paye = anciens.filter((p) => !p.annule).reduce((a, p) => a + p.montant, 0);
  const restant = tranches_.reduce((a, t) => a + t.montant, 0) - paye;
  if (montant > restant) {
    return {
      erreur: `Montant refusé : le restant dû est de ${restant.toLocaleString("fr-FR")} F CFA.`,
    };
  }

  const [facture] = await db
    .select({ fraisId: factures.fraisId })
    .from(factures)
    .where(eq(factures.id, idFacture))
    .limit(1);
  const [leFrais] = await db
    .select({ etablissementId: frais.etablissementId })
    .from(frais)
    .where(eq(frais.id, facture.fraisId))
    .limit(1);
  const numeroRecu = await prochainNumero(leFrais.etablissementId, "recuSeq", "REC");

  await db.insert(paiements).values({
    factureId: idFacture,
    montant,
    mode: "mobile_money",
    note: `${operateur.toUpperCase()} ${telephone} (paiement en ligne simulé)`,
    recuNumero: numeroRecu,
    auteurUserId: parent.id,
  });

  revalidatePath("/mes-finances");
  return {
    message: `Paiement confirmé : ${montant.toLocaleString("fr-FR")} F CFA. Reçu ${numeroRecu}.`,
  };
}
