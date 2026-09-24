"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { liensFamille, users } from "@/db/schema";
import { exiger } from "@/lib/auth";

export type Retour = { erreur?: string; message?: string };

/** Relier un enfant (compte élève) à son compte parent. */
export async function lierEnfant(_prec: Retour, donnees: FormData): Promise<Retour> {
  const parent = await exiger("parent");
  const email = String(donnees.get("email") ?? "").trim().toLowerCase();
  if (!email) return { erreur: "Indiquez l'email du compte de votre enfant." };

  const [eleve] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.role, "eleve")))
    .limit(1);
  if (!eleve) return { erreur: `Aucun compte élève avec l'email ${email}.` };

  const [deja] = await db
    .select({ id: liensFamille.id })
    .from(liensFamille)
    .where(
      and(eq(liensFamille.parentUserId, parent.id), eq(liensFamille.eleveUserId, eleve.id)),
    )
    .limit(1);
  if (deja) return { erreur: `${eleve.prenom} ${eleve.nom} est déjà relié à votre compte.` };

  await db.insert(liensFamille).values({ parentUserId: parent.id, eleveUserId: eleve.id });
  revalidatePath("/mes-enfants");
  return {
    message: `${eleve.prenom} ${eleve.nom} suit désormais votre compte : ses notes, absences et échéances arrivent dans votre espace.`,
  };
}
