"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bilans, enseignements, inscriptions, liensFamille, notifications, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import type { Retour } from "@/components/ui/alerte";

/**
 * Écrire dans le fil de suivi d'un enfant. Le professeur écrit pour
 * les enfants de ses classes ; le parent répond pour ses enfants
 * reliés. Le fil ne dépend pas de l'adhésion aux classes.
 */
export async function ecrireBilan(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("enseignant", "parent");
  const eleveUserId = Number(donnees.get("eleveUserId"));
  const contenu = String(donnees.get("contenu") ?? "").trim().slice(0, 2000);
  if (!eleveUserId || !contenu) {
    return { erreur: "Choisissez l'enfant et écrivez votre message." };
  }

  const [eleve] = await db
    .select({ prenom: users.prenom, nom: users.nom })
    .from(users)
    .where(and(eq(users.id, eleveUserId), eq(users.role, "eleve")))
    .limit(1);
  if (!eleve) return { erreur: "Cet élève n'existe pas." };

  if (utilisateur.role === "enseignant") {
    // L'enfant doit être inscrit dans une classe où j'enseigne.
    const eligibles = await db
      .select({ id: inscriptions.eleveUserId })
      .from(enseignements)
      .innerJoin(inscriptions, eq(inscriptions.classeId, enseignements.classeId))
      .where(eq(enseignements.enseignantUserId, utilisateur.id));
    if (!eligibles.some((e) => e.id === eleveUserId)) {
      return { erreur: "Cet enfant n'est pas dans vos classes." };
    }
  } else {
    // Mon enfant relié, lien famille confirmé.
    const [lien] = await db
      .select({ id: liensFamille.id })
      .from(liensFamille)
      .where(
        and(eq(liensFamille.parentUserId, utilisateur.id), eq(liensFamille.eleveUserId, eleveUserId)),
      )
      .limit(1);
    if (!lien) return { erreur: "Cet enfant n'est pas relié à votre compte." };
  }

  await db.insert(bilans).values({
    eleveUserId,
    auteurUserId: utilisateur.id,
    contenu,
  });

  // Prévenir les autres voix du fil : les parents de l'enfant quand le
  // professeur écrit, les professeurs qui suivent déjà quand le parent
  // répond.
  if (utilisateur.role === "enseignant") {
    const parents = await db
      .select({ parentUserId: liensFamille.parentUserId })
      .from(liensFamille)
      .where(eq(liensFamille.eleveUserId, eleveUserId));
    const texte = `Nouveau bilan pour ${eleve.prenom} ${eleve.nom}.`;
    const cibles = parents.filter((p) => p.parentUserId !== utilisateur.id);
    if (cibles.length > 0) {
      await db.insert(notifications).values(
        cibles.map((p) => ({ userId: p.parentUserId, texte, lien: "/bilans" })),
      );
    }
  } else {
    const classesEnfant = await db
      .select({ classeId: inscriptions.classeId })
      .from(inscriptions)
      .where(eq(inscriptions.eleveUserId, eleveUserId));
    if (classesEnfant.length > 0) {
      const profs = await db
        .selectDistinct({ enseignantUserId: enseignements.enseignantUserId })
        .from(enseignements)
        .where(
          inArray(
            enseignements.classeId,
            classesEnfant.map((c) => c.classeId),
          ),
        );
      const texte = `${eleve.prenom} ${eleve.nom} : le parent a répondu au bilan.`;
      const cibles = profs.filter((p) => p.enseignantUserId !== utilisateur.id);
      if (cibles.length > 0) {
        await db.insert(notifications).values(
          cibles.map((p) => ({ userId: p.enseignantUserId, texte, lien: "/bilans" })),
        );
      }
    }
  }

  revalidatePath("/bilans");
  return {
    message:
      utilisateur.role === "enseignant"
        ? `Bilan envoyé pour ${eleve.prenom} ${eleve.nom}.`
        : "Réponse envoyée.",
  };
}
