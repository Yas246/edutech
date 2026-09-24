"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { etablissements, users } from "@/db/schema";
import { creerSession, hasher, type Role } from "@/lib/auth";
import { roles } from "@/lib/roles";

export type EtatInscription = { erreur?: string };

const emailsValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inscrire(
  _etatPrecedent: EtatInscription,
  donnees: FormData,
): Promise<EtatInscription> {
  const role = String(donnees.get("role") ?? "");
  const prenom = String(donnees.get("prenom") ?? "").trim();
  const nom = String(donnees.get("nom") ?? "").trim();
  const email = String(donnees.get("email") ?? "").trim().toLowerCase();
  const telephone = String(donnees.get("telephone") ?? "").trim();
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const sexeBrut = String(donnees.get("sexe") ?? "").trim().toUpperCase();
  const sexe = sexeBrut === "F" || sexeBrut === "M" ? sexeBrut : "";

  if (!roles.some((r) => r.valeur === role)) {
    return { erreur: "Choisissez votre place sur la plateforme." };
  }
  if (!prenom || !nom) return { erreur: "Indiquez votre prénom et votre nom." };
  if (!emailsValide.test(email)) return { erreur: "Cet email ne semble pas valide." };
  if (motDePasse.length < 8) {
    return { erreur: "Le mot de passe doit compter au moins 8 caractères." };
  }

  // Les champs d'établissement ne concernent que la direction.
  let nomEtablissement = "";
  let communeEtablissement = "";
  let typeEtablissement = "";
  let statutEtablissement = "";
  if (role === "direction") {
    nomEtablissement = String(donnees.get("etablissementNom") ?? "").trim();
    communeEtablissement = String(donnees.get("etablissementCommune") ?? "").trim();
    typeEtablissement = String(donnees.get("etablissementType") ?? "autre");
    statutEtablissement = String(donnees.get("etablissementStatut") ?? "public");
    if (!nomEtablissement || !communeEtablissement) {
      return {
        erreur: "Indiquez le nom et la commune de votre établissement.",
      };
    }
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

  await db.transaction(async (tx) => {
    const [utilisateur] = await tx
      .insert(users)
      .values({
        email,
        passwordHash: empreinte,
        nom,
        prenom,
        telephone,
        sexe,
        role: role as Role,
      })
      .returning({ id: users.id });

    if (role === "direction") {
      await tx.insert(etablissements).values({
        nom: nomEtablissement,
        commune: communeEtablissement,
        departement: "",
        type: typeEtablissement,
        statutAdmin: statutEtablissement,
        statut: "en_attente",
        source: "inscription",
        directionUserId: utilisateur.id,
      });
    }
  });

  const [nouveau] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  await creerSession(nouveau.id);
  redirect("/premiers-pas");
}
