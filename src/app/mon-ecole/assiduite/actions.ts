"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { delegations, etablissements, presencesEnseignants } from "@/db/schema";
import { exiger } from "@/lib/auth";
import type { Retour } from "@/components/ui/alerte";

const STATUTS = ["present", "retard", "absent"];

/**
 * L'établissement dont le compte tient le pointage : la direction, ou
 * le délégué à l'emploi du temps.
 */
async function ecoleDuPointage() {
  const utilisateur = await exiger("direction", "enseignant");
  if (utilisateur.role === "direction") {
    const [ecole] = await db
      .select({ id: etablissements.id, nom: etablissements.nom })
      .from(etablissements)
      .where(eq(etablissements.directionUserId, utilisateur.id))
      .limit(1);
    return ecole ?? null;
  }
  const [delegue] = await db
    .select({ id: delegations.etablissementId })
    .from(delegations)
    .where(and(eq(delegations.userId, utilisateur.id), eq(delegations.role, "edt")))
    .limit(1);
  if (!delegue) return null;
  const [ecole] = await db
    .select({ id: etablissements.id, nom: etablissements.nom })
    .from(etablissements)
    .where(eq(etablissements.id, delegue.id))
    .limit(1);
  return ecole ?? null;
}

/**
 * Le pointage d'une journée : un statut par enseignant, posé en une
 * seule fois. Repointer le même jour met à jour, jamais ne duplique.
 */
export async function pointerAssiduite(
  _prec: Retour,
  donnees: FormData,
): Promise<Retour> {
  const ecole = await ecoleDuPointage();
  if (!ecole) return { erreur: "Aucun établissement rattaché à votre compte." };

  const utilisateur = await exiger("direction", "enseignant");
  const date = String(donnees.get("date") ?? "").trim();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { erreur: "Choisissez la date du pointage." };
  }
  if (date > aujourdhui) {
    return { erreur: "Impossible de pointer un jour à venir." };
  }

  let poses = 0;
  for (const [cle, valeur] of donnees.entries()) {
    const match = /^statut-(\d+)$/.exec(cle);
    if (!match) continue;
    const statut = String(valeur);
    if (!STATUTS.includes(statut)) continue;
    const enseignantUserId = Number(match[1]);
    await db
      .insert(presencesEnseignants)
      .values({
        etablissementId: ecole.id,
        enseignantUserId,
        date,
        statut,
        saisiPar: utilisateur.id,
      })
      // Un enseignant ne porte qu'un pointage par jour : le suivant
      // remplace le précédent.
      .onConflictDoUpdate({
        target: [presencesEnseignants.enseignantUserId, presencesEnseignants.date],
        set: { statut, saisiPar: utilisateur.id, etablissementId: ecole.id },
      });
    poses += 1;
  }

  if (poses === 0) return { erreur: "Cochez au moins un enseignant." };

  revalidatePath("/mon-ecole/assiduite");
  return { message: `Pointage du ${date} enregistré pour ${poses} enseignant${poses > 1 ? "s" : ""}.` };
}
