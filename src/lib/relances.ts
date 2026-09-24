import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  etablissements,
  factures,
  frais,
  liensFamille,
  notifications,
  paiements,
  relances,
  tranches,
  users,
} from "@/db/schema";

const JALONS = [14, 7, 3];

/**
 * Les relances d'échéances : à 14, 7 et 3 jours avant chaque échéance
 * non couverte, une seule fois par (tranche, parent, jalon). Rien
 * après l'échéance. Rejouer la fonction ne renvoie jamais deux fois
 * la même relance.
 */
export async function envoyerRelances(): Promise<{ envoyees: number; jalons: number[] }> {
  const aujourdhui = new Date();
  let envoyees = 0;

  // Toutes les tranches avec leur facture et le frais associé.
  const lignes = await db
    .select({
      trancheId: tranches.id,
      ordre: tranches.ordre,
      montant: tranches.montant,
      echeance: tranches.echeance,
      factureId: factures.id,
      eleveUserId: factures.eleveUserId,
      etablissementId: frais.etablissementId,
      categorie: frais.categorie,
      libelle: frais.libelle,
    })
    .from(tranches)
    .innerJoin(factures, eq(factures.id, tranches.factureId))
    .innerJoin(frais, eq(frais.id, factures.fraisId));

  for (const ligne of lignes) {
    const joursRestants = Math.ceil(
      (new Date(ligne.echeance).getTime() - aujourdhui.getTime()) / (24 * 3600 * 1000),
    );
    // Rien après l'échéance, rien pour un jalon qui n'est pas l'un des trois.
    if (!JALONS.includes(joursRestants)) continue;

    // Couverture de la tranche (paiements non annulés, tranche la plus
    // ancienne d'abord) — même calcul que partout ailleurs.
    const fratriesTranches = await db
      .select({ id: tranches.id, montant: tranches.montant })
      .from(tranches)
      .where(eq(tranches.factureId, ligne.factureId))
      .orderBy(tranches.ordre);
    const paiementsFaits = await db
      .select({ montant: paiements.montant, annule: paiements.annule })
      .from(paiements)
      .where(eq(paiements.factureId, ligne.factureId));
    const paye = paiementsFaits.filter((p) => !p.annule).reduce((a, p) => a + p.montant, 0);
    let reste = paye;
    let couverte = false;
    for (const t of fratriesTranches) {
      const couvert = Math.min(reste, t.montant);
      reste -= couvert;
      if (t.id === ligne.trancheId) couverte = couvert >= t.montant;
    }
    if (couverte) continue;

    // Les parents de l'élève.
    const parents = await db
      .select({ id: liensFamille.parentUserId })
      .from(liensFamille)
      .where(eq(liensFamille.eleveUserId, ligne.eleveUserId));
    if (parents.length === 0) continue;

    const [eleve] = await db
      .select({ prenom: users.prenom, nom: users.nom })
      .from(users)
      .where(eq(users.id, ligne.eleveUserId))
      .limit(1);
    const [ecole] = await db
      .select({ nom: etablissements.nom })
      .from(etablissements)
      .where(eq(etablissements.id, ligne.etablissementId))
      .limit(1);

    const parentsDejaPrevenus = await db
      .select({ parentUserId: relances.parentUserId })
      .from(relances)
      .where(and(eq(relances.trancheId, ligne.trancheId), eq(relances.jalon, joursRestants)));
    const deja = new Set(parentsDejaPrevenus.map((p) => p.parentUserId));

    const aPrevenir = parents.filter((p) => !deja.has(p.id));
    for (const parent of aPrevenir) {
      await db.insert(relances).values({
        trancheId: ligne.trancheId,
        parentUserId: parent.id,
        jalon: joursRestants,
      });
      await db.insert(notifications).values({
        userId: parent.id,
        texte: `${ecole.nom} : il reste ${ligne.montant.toLocaleString("fr-FR")} F CFA à payer pour ${eleve ? `${eleve.prenom} ${eleve.nom}` : "votre enfant"}, échéance dans ${joursRestants} jours.`,
        lien: "/mes-finances",
      });
      envoyees += 1;
    }
  }

  return { envoyees, jalons: JALONS };
}
