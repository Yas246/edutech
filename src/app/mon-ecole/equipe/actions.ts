"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, codesEquipe, enseignements, equipes, etablissements } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { genererCode } from "@/lib/codes";

/** L'établissement dirigé par le compte courant. */
async function monEcole() {
  const utilisateur = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, utilisateur.id))
    .limit(1);
  return ecole ?? null;
}

/** La direction confirme un collègue qui s'est déclaré. */
export async function confirmerMembre(donnees: FormData): Promise<void> {
  const ecole = await monEcole();
  if (!ecole) return;
  const userId = Number(donnees.get("userId"));
  await db
    .update(equipes)
    .set({ statut: "confirme" })
    .where(
      and(
        eq(equipes.etablissementId, ecole.id),
        eq(equipes.userId, userId),
        eq(equipes.statut, "declare"),
      ),
    );
  revalidatePath("/mon-ecole/equipe");
}

/**
 * La révocation retire le membre de l'équipe ET ses attributions de
 * matières dans les classes de l'école : les cours restent, sans
 * enseignant.
 */
export async function revoquerMembre(donnees: FormData): Promise<void> {
  const ecole = await monEcole();
  if (!ecole) return;
  const userId = Number(donnees.get("userId"));
  const classesEcole = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.etablissementId, ecole.id));
  if (classesEcole.length > 0) {
    await db.delete(enseignements).where(
      and(
        eq(enseignements.enseignantUserId, userId),
        inArray(
          enseignements.classeId,
          classesEcole.map((c) => c.id),
        ),
      ),
    );
  }
  await db
    .delete(equipes)
    .where(and(eq(equipes.etablissementId, ecole.id), eq(equipes.userId, userId)));
  revalidatePath("/mon-ecole/equipe");
}

/** Un nouveau code d'invitation : l'ancien ne marche plus. */
export async function regenererCodeEquipe(_donnees: FormData): Promise<void> {
  const ecole = await monEcole();
  if (!ecole) return;
  const code = await genererCode("VME-", async (c) =>
    Boolean(
      await db
        .select({ id: codesEquipe.etablissementId })
        .from(codesEquipe)
        .where(eq(codesEquipe.code, c))
        .limit(1)
        .then((r) => r.length),
    ),
  );
  await db
    .insert(codesEquipe)
    .values({ etablissementId: ecole.id, code })
    .onConflictDoUpdate({
      target: codesEquipe.etablissementId,
      set: { code },
    });
  revalidatePath("/mon-ecole/equipe");
}
