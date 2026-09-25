"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { exiger, hasher } from "@/lib/auth";

export type Retour = { erreur?: string; message?: string };

/** Les trois niveaux de droits d'un compte ministère. */
const NIVEAUX = ["admin", "validation", "lecture"] as const;
type Niveau = (typeof NIVEAUX)[number];

/**
 * Le compte courant doit être un agent de niveau admin : seul l'admin
 * crée, retire ou regrade les autres comptes du ministère.
 */
async function exigerAdminMinistere() {
  const courant = await exiger("ministere");
  if ((courant.permissions ?? "admin") !== "admin") {
    return null;
  }
  return courant;
}

/** Créer un compte employé du ministère, avec son niveau de droits. */
export async function creerEmployeMinistere(
  _prec: Retour,
  donnees: FormData,
): Promise<Retour> {
  if (!(await exigerAdminMinistere())) {
    return { erreur: "Seul un agent de niveau administrateur crée des comptes." };
  }
  const prenom = String(donnees.get("prenom") ?? "").trim();
  const nom = String(donnees.get("nom") ?? "").trim();
  const email = String(donnees.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const niveauBrut = String(donnees.get("niveau") ?? "lecture");
  const niveau = (NIVEAUX as readonly string[]).includes(niveauBrut)
    ? (niveauBrut as Niveau)
    : "lecture";

  if (!prenom || !nom) return { erreur: "Indiquez le prénom et le nom de l'agent." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { erreur: "Cet email ne semble pas valide." };
  }
  if (motDePasse.length < 8) {
    return { erreur: "Le mot de passe initial doit compter au moins 8 caractères." };
  }

  const [existant] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existant) return { erreur: "Un compte existe déjà avec cet email." };

  await db.insert(users).values({
    email,
    passwordHash: await hasher(motDePasse),
    prenom,
    nom,
    role: "ministere",
    permissions: niveau,
  });
  revalidatePath("/ministere");
  return {
    message: `${prenom} ${nom} rejoint le ministère — niveau ${niveau}.`,
  };
}

/** Retirer un compte employé : admin seulement, jamais soi-même. */
export async function supprimerEmployeMinistere(
  _prec: Retour,
  donnees: FormData,
): Promise<Retour> {
  const courant = await exigerAdminMinistere();
  if (!courant) return { erreur: "Seul un agent administrateur retire des comptes." };
  const id = Number(donnees.get("employeId"));
  if (id === courant.id) {
    return { erreur: "Vous ne pouvez pas retirer votre propre compte." };
  }
  const [employe] = await db
    .select({ prenom: users.prenom, nom: users.nom })
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "ministere")))
    .limit(1);
  if (!employe) return { erreur: "Compte employé introuvable." };

  await db.delete(users).where(and(eq(users.id, id), eq(users.role, "ministere")));
  revalidatePath("/ministere");
  return { message: `Compte de ${employe.prenom} ${employe.nom} retiré.` };
}

/** Changer le niveau de droits d'un agent : admin seulement. */
export async function changerNiveauEmploye(donnees: FormData): Promise<void> {
  const courant = await exigerAdminMinistere();
  if (!courant) return;
  const employeId = Number(donnees.get("employeId"));
  const niveauBrut = String(donnees.get("niveau") ?? "");
  if (!employeId || employeId === courant.id) return;
  if (!(NIVEAUX as readonly string[]).includes(niveauBrut)) return;

  await db
    .update(users)
    .set({ permissions: niveauBrut })
    .where(and(eq(users.id, employeId), eq(users.role, "ministere")));
  revalidatePath("/ministere");
}
