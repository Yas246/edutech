"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { etablissements } from "@/db/schema";
import { exiger } from "@/lib/auth";

export type Retour = { erreur?: string; message?: string };

/** Le ministère valide un établissement de la file. */
export async function validerEcole(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("ministere");
  // L'agent « lecture » consulte : il ne tranche pas.
  if (utilisateur.permissions === "lecture") {
    return { erreur: "Votre niveau de droits ne permet pas de valider un établissement." };
  }
  const id = Number(donnees.get("etablissementId"));
  if (!id) return { erreur: "Établissement inconnu." };
  const [ecole] = await db
    .update(etablissements)
    .set({ statut: "valide" })
    .where(eq(etablissements.id, id))
    .returning({ nom: etablissements.nom });
  if (!ecole) return { erreur: "Établissement introuvable." };
  revalidatePath("/ministere");
  return { message: `« ${ecole.nom} » est validé et ouvert à tous.` };
}

/** Le ministère refuse un établissement. */
export async function invaliderEcole(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("ministere");
  if (utilisateur.permissions === "lecture") {
    return { erreur: "Votre niveau de droits ne permet pas de refuser un établissement." };
  }
  const id = Number(donnees.get("etablissementId"));
  if (!id) return { erreur: "Établissement inconnu." };
  const [ecole] = await db
    .update(etablissements)
    .set({ statut: "refuse" })
    .where(eq(etablissements.id, id))
    .returning({ nom: etablissements.nom });
  if (!ecole) return { erreur: "Établissement introuvable." };
  revalidatePath("/ministere");
  return { message: `« ${ecole.nom} » est retiré de la plateforme.` };
}
