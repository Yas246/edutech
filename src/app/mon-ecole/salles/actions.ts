"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { etablissements, salles } from "@/db/schema";
import { exiger } from "@/lib/auth";
import type { Retour } from "@/components/ui/alerte";

/** L'établissement dirigé par l'utilisateur courant. */
async function ecoleDeLaDirection() {
  const direction = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, direction.id))
    .limit(1);
  return ecole ?? null;
}

export async function creerSalle(_prec: Retour, donnees: FormData): Promise<Retour> {
  const ecole = await ecoleDeLaDirection();
  if (!ecole) return { erreur: "Aucun établissement rattaché à votre compte." };

  const nom = String(donnees.get("nom") ?? "").trim();
  const capacite = Number(donnees.get("capacite") ?? 0);
  if (!nom) return { erreur: "Donnez un nom à la salle." };
  if (!Number.isInteger(capacite) || capacite < 0) {
    return { erreur: "La capacité doit être un nombre entier positif." };
  }

  const [existe] = await db
    .select({ id: salles.id })
    .from(salles)
    .where(and(eq(salles.etablissementId, ecole.id), eq(salles.nom, nom)))
    .limit(1);
  if (existe) return { erreur: `La salle « ${nom} » existe déjà.` };

  await db.insert(salles).values({ etablissementId: ecole.id, nom, capacite });
  revalidatePath("/mon-ecole/salles");
  return { message: `Salle « ${nom} » créée.` };
}

export async function supprimerSalle(_prec: Retour, donnees: FormData): Promise<Retour> {
  const ecole = await ecoleDeLaDirection();
  if (!ecole) return { erreur: "Aucun établissement rattaché." };
  const id = Number(donnees.get("salleId"));
  await db.delete(salles).where(and(eq(salles.id, id), eq(salles.etablissementId, ecole.id)));
  revalidatePath("/mon-ecole/salles");
  return { message: "Salle retirée." };
}
