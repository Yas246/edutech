"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { exiger } from "@/lib/auth";

/** Clôturer le parcours : mémoriser les intérêts et marquer comme fait. */
export async function terminer(donnees: FormData) {
  const utilisateur = await exiger();
  const interets = donnees
    .getAll("interets")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0)
    .join(",");

  await db
    .update(users)
    .set({ onboardingFait: true, interets })
    .where(eq(users.id, utilisateur.id));

  redirect("/tableau-de-bord");
}
