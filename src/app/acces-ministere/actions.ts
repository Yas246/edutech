"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accesMinistere, users } from "@/db/schema";
import { creerSession, hasher } from "@/lib/auth";
import { genererPseudo } from "@/lib/codes";

export type EtatAcces = { erreur?: string };

const emailsValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * La création d'un compte ministère : le code d'accès à usage unique
 * vaut preuve de l'institution. En cas d'échec, le message ne dit pas
 * si le code existe — ni s'il est déjà dépensé.
 */
export async function creerCompteMinistere(
  _etatPrecedent: EtatAcces,
  donnees: FormData,
): Promise<EtatAcces> {
  const code = String(donnees.get("code") ?? "").trim().toUpperCase();
  const organisation = String(donnees.get("organisation") ?? "").trim().slice(0, 120);
  const prenom = String(donnees.get("prenom") ?? "").trim();
  const nom = String(donnees.get("nom") ?? "").trim();
  const email = String(donnees.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(donnees.get("motDePasse") ?? "");

  if (!code || !organisation || !prenom || !nom) {
    return { erreur: "Renseignez le code d'accès, votre organisation, votre prénom et votre nom." };
  }
  if (!emailsValide.test(email)) return { erreur: "Cet email ne semble pas valide." };
  if (motDePasse.length < 8) {
    return { erreur: "Le mot de passe doit compter au moins 8 caractères." };
  }

  const [acces] = await db
    .select({ organisation: accesMinistere.organisation, utilisePar: accesMinistere.utilisePar })
    .from(accesMinistere)
    .where(eq(accesMinistere.code, code))
    .limit(1);
  if (!acces || acces.utilisePar) {
    return { erreur: "Ce code d'accès n'est pas recevable." };
  }

  const [existant] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existant) {
    return { erreur: "Un compte existe déjà avec cet email. Connectez-vous." };
  }

  const empreinte = await hasher(motDePasse);
  const pseudo = await genererPseudo(prenom, nom, async (candidat) =>
    Boolean(
      await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.pseudo, candidat))
        .limit(1)
        .then((r) => r.length),
    ),
  );

  const [utilisateur] = await db
    .insert(users)
    .values({
      email,
      passwordHash: empreinte,
      nom,
      prenom,
      telephone: "",
      sexe: "",
      pseudo,
      role: "ministere",
    })
    .returning({ id: users.id });

  await db
    .update(accesMinistere)
    .set({ utilisePar: utilisateur.id, organisation })
    .where(eq(accesMinistere.code, code));

  await creerSession(utilisateur.id);
  redirect("/tableau-de-bord");
}
