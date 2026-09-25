"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { delegues, inscriptions, publications } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { droitsClasse } from "@/lib/espace";
import type { Retour } from "@/components/ui/alerte";

/**
 * Publier sur le mur de la classe : la direction, les professeurs et
 * les délégués. Le droit est recalculé côté serveur.
 */
export async function publierDansClasse(
  _prec: Retour,
  donnees: FormData,
): Promise<Retour> {
  const utilisateur = await exiger();
  const classeId = Number(donnees.get("classeId"));
  const contenu = String(donnees.get("contenu") ?? "").trim();
  if (!classeId || !contenu) return { erreur: "Écrivez votre publication." };

  const droits = await droitsClasse(classeId, utilisateur);
  if (!droits.publier) {
    return { erreur: "Seuls la direction, les professeurs et les délégués publient ici." };
  }

  await db.insert(publications).values({
    auteurUserId: utilisateur.id,
    porteeType: "classe",
    porteeId: classeId,
    contenu: contenu.slice(0, 2000),
  });
  revalidatePath(`/classes/${classeId}`);
  return { message: "Publié dans la classe." };
}

/**
 * Déléguer (ou retirer) un élève : un délégué publie dans la classe et
 * donne les devoirs, en plus des professeurs.
 */
export async function basculerDelegue(donnees: FormData): Promise<void> {
  const utilisateur = await exiger("direction");
  const classeId = Number(donnees.get("classeId"));
  const eleveUserId = Number(donnees.get("eleveUserId"));
  if (!classeId || !eleveUserId) return;

  // Seule la direction de l'établissement de la classe décide.
  const { etablissements, classes } = await import("@/db/schema");
  const [classe] = await db
    .select({ directionUserId: etablissements.directionUserId })
    .from(classes)
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(classes.id, classeId))
    .limit(1);
  if (!classe || classe.directionUserId !== utilisateur.id) return;

  // Le désigné doit être un élève inscrit de la classe.
  const [inscrit] = await db
    .select({ id: inscriptions.id })
    .from(inscriptions)
    .where(
      and(eq(inscriptions.classeId, classeId), eq(inscriptions.eleveUserId, eleveUserId)),
    )
    .limit(1);
  if (!inscrit) return;

  const [existant] = await db
    .select({ id: delegues.id })
    .from(delegues)
    .where(and(eq(delegues.classeId, classeId), eq(delegues.eleveUserId, eleveUserId)))
    .limit(1);
  if (existant) {
    await db.delete(delegues).where(eq(delegues.id, existant.id));
  } else {
    await db.insert(delegues).values({ classeId, eleveUserId, designePar: utilisateur.id });
  }
  revalidatePath(`/classes/${classeId}/delegues`);
  revalidatePath(`/classes/${classeId}`);
}

/** Adaptation au formulaire HTML natif du mur. */
export async function publierDansClasseFormulaire(donnees: FormData): Promise<void> {
  await publierDansClasse({}, donnees);
}
