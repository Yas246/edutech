"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { creerSession, verifier } from "@/lib/auth";

export type EtatConnexion = { erreur?: string };

export async function seConnecter(
  _etatPrecedent: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const email = String(donnees.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(donnees.get("motDePasse") ?? "");

  if (!email || !motDePasse) {
    return { erreur: "Indiquez votre email et votre mot de passe." };
  }

  const [utilisateur] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!utilisateur || !(await verifier(motDePasse, utilisateur.passwordHash))) {
    return { erreur: "Email ou mot de passe incorrect." };
  }

  await creerSession(utilisateur.id);
  redirect(utilisateur.onboardingFait ? "/tableau-de-bord" : "/premiers-pas");
}
