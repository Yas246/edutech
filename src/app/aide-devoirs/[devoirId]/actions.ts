"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { devoirs, inscriptions, messagesTuteur } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { repondreTuteur } from "@/lib/tuteur";
import type { Retour } from "@/components/ui/alerte";

/**
 * Poser une question au tuteur sur un devoir. La question est rangée
 * d'abord ; si le moteur est indisponible, elle reste dans le fil et
 * un message clair l'explique — rien ne se perd.
 */
export async function poserQuestion(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("eleve");
  const devoirId = Number(donnees.get("devoirId"));
  const question = String(donnees.get("question") ?? "").trim().slice(0, 2000);
  if (!devoirId || !question) return { erreur: "Écrivez votre question." };

  // Le devoir doit être celui d'une classe où je suis inscrit.
  const [devoir] = await db
    .select({ id: devoirs.id })
    .from(devoirs)
    .innerJoin(inscriptions, eq(inscriptions.classeId, devoirs.classeId))
    .where(and(eq(devoirs.id, devoirId), eq(inscriptions.eleveUserId, utilisateur.id)))
    .limit(1);
  if (!devoir) return { erreur: "Ce devoir n'est pas dans vos classes." };

  await db.insert(messagesTuteur).values({
    devoirId,
    eleveUserId: utilisateur.id,
    auteurUserId: utilisateur.id,
    duTuteur: false,
    contenu: question,
  });

  const reponse = await repondreTuteur(devoirId);
  if (!reponse) {
    revalidatePath(`/aide-devoirs/${devoirId}`);
    return {
      erreur:
        "Le tuteur est momentanément indisponible : votre question est conservée, il y répondra dès son retour. Réessayez dans un instant.",
    };
  }

  await db.insert(messagesTuteur).values({
    devoirId,
    eleveUserId: utilisateur.id,
    auteurUserId: utilisateur.id,
    duTuteur: true,
    contenu: reponse,
  });

  revalidatePath(`/aide-devoirs/${devoirId}`);
  return { message: "Le tuteur a répondu." };
}
