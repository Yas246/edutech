"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { codesEleve, declarationsEnfant, liensFamille, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { compterEchec, genererCode, remettreCompteur, saisieAutorisee } from "@/lib/codes";
import type { Retour } from "@/components/ui/alerte";

/** Le code personnel de l'élève, créé paresseusement et stable. */
export async function codePersonnel(eleveUserId: number): Promise<string> {
  const [existant] = await db
    .select({ code: codesEleve.code })
    .from(codesEleve)
    .where(eq(codesEleve.eleveUserId, eleveUserId))
    .limit(1);
  if (existant) return existant.code;
  const code = await genererCode("VMP-", async (c) =>
    Boolean(
      await db
        .select({ id: codesEleve.eleveUserId })
        .from(codesEleve)
        .where(eq(codesEleve.code, c))
        .limit(1)
        .then((r) => r.length),
    ),
  );
  await db.insert(codesEleve).values({ eleveUserId, code }).onConflictDoNothing();
  const [relu] = await db
    .select({ code: codesEleve.code })
    .from(codesEleve)
    .where(eq(codesEleve.eleveUserId, eleveUserId))
    .limit(1);
  return relu.code;
}

/** L'élève saisit le code famille d'un parent : le lien se pose. */
export async function lierParent(_prec: Retour, donnees: FormData): Promise<Retour> {
  const eleve = await exiger("eleve");
  const brut = String(donnees.get("code") ?? "").trim().toUpperCase();
  if (!brut) return { erreur: "Saisissez le code famille que votre parent vous a donné." };
  if (!(await saisieAutorisee(eleve.id))) {
    return { erreur: "Trop d'essais erronés aujourd'hui : réessayez demain." };
  }

  const [declaration] = await db
    .select()
    .from(declarationsEnfant)
    .where(eq(declarationsEnfant.codeFamille, brut))
    .limit(1);
  if (!declaration) {
    await compterEchec(eleve.id);
    return { erreur: "Code famille inconnu. Vérifiez auprès de votre parent." };
  }
  if (declaration.eleveUserId && declaration.eleveUserId !== eleve.id) {
    return { erreur: "Ce code est déjà relié à un autre compte élève." };
  }

  await db
    .update(declarationsEnfant)
    .set({ eleveUserId: eleve.id })
    .where(eq(declarationsEnfant.id, declaration.id));
  await db
    .insert(liensFamille)
    .values({ parentUserId: declaration.parentUserId, eleveUserId: eleve.id })
    .onConflictDoNothing();
  await remettreCompteur(eleve.id);
  revalidatePath("/mon-code");
  return { message: "Votre parent est maintenant relié à votre compte." };
}

/** Les parents déjà reliés au compte élève. */
export async function parentsLies(eleveUserId: number) {
  return db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom, pseudo: users.pseudo })
    .from(liensFamille)
    .innerJoin(users, eq(users.id, liensFamille.parentUserId))
    .where(and(eq(liensFamille.eleveUserId, eleveUserId)))
    .orderBy(users.nom);
}

/** Adaptation au formulaire HTML natif (l'état passe par la page). */
export async function lierParentFormulaire(donnees: FormData): Promise<void> {
  await lierParent({}, donnees);
}
