"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { etablissements } from "@/db/schema";
import { exiger } from "@/lib/auth";

export type Retour = { erreur?: string; message?: string };

/** Le ministère valide un établissement de la file. */
export async function validerEcole(_prec: Retour, donnees: FormData): Promise<Retour> {
  await exiger("ministere");
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
  await exiger("ministere");
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
