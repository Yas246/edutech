"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { periodes, publicationsBulletins } from "@/db/schema";
import { gardeClasse } from "@/lib/garde-classe";

export type Retour = { erreur?: string; message?: string };

/** La direction publie (ou republie) les bulletins de la classe. */
export async function publierBulletins(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idClasse = Number(donnees.get("classeId"));
  const contexte = await gardeClasse(idClasse);
  if (!contexte || contexte.utilisateur.role !== "direction") {
    return { erreur: "Seule la direction de l'établissement publie les bulletins." };
  }
  const idEcole = contexte.classe.etablissementId;

  const [periode] = await db
    .select({ id: periodes.id, nom: periodes.nom })
    .from(periodes)
    .where(and(eq(periodes.etablissementId, idEcole), eq(periodes.active, true)))
    .limit(1);
  if (!periode) return { erreur: "Aucune période active dans votre établissement." };

  await db
    .insert(publicationsBulletins)
    .values({
      classeId: idClasse,
      periodeId: periode.id,
      publiePar: contexte.utilisateur.id,
    })
    .onConflictDoUpdate({
      target: [publicationsBulletins.classeId, publicationsBulletins.periodeId],
      set: { publiePar: contexte.utilisateur.id, publieLe: new Date() },
    });

  revalidatePath(`/classes/${idClasse}/bulletins`);
  return {
    message: `Bulletins de ${contexte.classe.nom} publiés : les familles les voient dans leur espace.`,
  };
}
