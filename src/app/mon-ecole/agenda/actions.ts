"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { etablissements, evenements } from "@/db/schema";
import { exiger } from "@/lib/auth";
import type { Retour } from "@/components/ui/alerte";

async function ecoleDeLaDirection() {
  const direction = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, direction.id))
    .limit(1);
  return ecole ?? null;
}

export async function creerEvenement(_prec: Retour, donnees: FormData): Promise<Retour> {
  const ecole = await ecoleDeLaDirection();
  if (!ecole) return { erreur: "Aucun établissement rattaché à votre compte." };
  const direction = await exiger("direction");

  const titre = String(donnees.get("titre") ?? "").trim();
  const description = String(donnees.get("description") ?? "").trim();
  const date = String(donnees.get("date") ?? "").trim();
  const portee = String(donnees.get("portee") ?? "etablissement");
  const classeId = Number(donnees.get("classeId")) || null;

  if (!titre) return { erreur: "Donnez un titre à l'événement." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: "Choisissez la date." };
  if (!["etablissement", "classe"].includes(portee)) {
    return { erreur: "Choisissez la portée de l'événement." };
  }
  if (portee === "classe" && !classeId) {
    return { erreur: "Choisissez la classe visée." };
  }

  await db.insert(evenements).values({
    etablissementId: ecole.id,
    titre,
    description,
    date,
    portee,
    classeId: portee === "classe" ? classeId : null,
    creePar: direction.id,
  });
  revalidatePath("/mon-ecole/agenda");
  return { message: `« ${titre} » posé au calendrier des familles.` };
}

export async function supprimerEvenement(_prec: Retour, donnees: FormData): Promise<Retour> {
  const ecole = await ecoleDeLaDirection();
  if (!ecole) return { erreur: "Aucun établissement rattaché." };
  const id = Number(donnees.get("evenementId"));
  await db
    .delete(evenements)
    .where(and(eq(evenements.id, id), eq(evenements.etablissementId, ecole.id)));
  revalidatePath("/mon-ecole/agenda");
  return { message: "Événement retiré." };
}
