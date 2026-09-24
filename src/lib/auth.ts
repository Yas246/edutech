import { compare, hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

export type Utilisateur = typeof users.$inferSelect;

export type { Role } from "./roles";
import type { Role } from "./roles";

const COOKIE = "session";
const DUREE_JOURS = 30;

export function hasher(motDePasse: string) {
  return hash(motDePasse, 10);
}

export function verifier(motDePasse: string, empreinte: string) {
  return compare(motDePasse, empreinte);
}

export async function creerSession(userId: number) {
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + DUREE_JOURS * 24 * 3600 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const lignes = await db
    .select({ utilisateur: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return lignes[0]?.utilisateur ?? null;
}

export async function deconnecter() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
    jar.delete(COOKIE);
  }
}

/** Exige un compte connecté, et éventuellement l'un des rôles donnés. */
export async function exiger(...rolesExiges: Role[]): Promise<Utilisateur> {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) redirect("/connexion");
  if (rolesExiges.length > 0 && !rolesExiges.includes(utilisateur.role as Role)) {
    redirect("/tableau-de-bord");
  }
  return utilisateur;
}

export function nomComplet(u: { prenom: string; nom: string }) {
  return `${u.prenom} ${u.nom}`;
}
