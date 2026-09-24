"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  classes,
  commentaires,
  enseignements,
  inscriptions,
  notifications,
  publications,
  reactions,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";

/**
 * Les cercles où l'utilisateur peut publier : ses classes (comme élève
 * ou enseignant) et son école (comme direction ou enseignant de l'école).
 */
async function mesCercles(idUtilisateur: number, role: string) {
  const resultats: { type: "etablissement" | "classe"; id: number; nom: string }[] = [];

  if (role === "eleve") {
    const lignes = await db
      .select({ id: classes.id, nom: classes.nom, etablissementId: classes.etablissementId })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(inscriptions.eleveUserId, idUtilisateur));
    for (const l of lignes) {
      resultats.push({ type: "classe", id: l.id, nom: `Classe ${l.nom}` });
    }
    return resultats;
  }

  // Enseignant et direction : via les enseignements / la direction.
  const enseignementsLignes = await db
    .select({ id: classes.id, nom: classes.nom, etablissementId: classes.etablissementId })
    .from(enseignements)
    .innerJoin(classes, eq(classes.id, enseignements.classeId))
    .where(eq(enseignements.enseignantUserId, idUtilisateur));
  for (const l of enseignementsLignes) {
    resultats.push({ type: "classe", id: l.id, nom: `Classe ${l.nom}` });
  }

  if (role === "direction") {
    const { etablissements } = await import("@/db/schema");
    const [ecole] = await db
      .select({ id: etablissements.id, nom: etablissements.nom })
      .from(etablissements)
      .where(eq(etablissements.directionUserId, idUtilisateur))
      .limit(1);
    if (ecole) resultats.unshift({ type: "etablissement", id: ecole.id, nom: ecole.nom });
  }

  return resultats;
}

export async function publier(donnees: FormData) {
  const utilisateur = await exiger();
  const contenu = String(donnees.get("contenu") ?? "").trim();
  const cercle = String(donnees.get("cercle") ?? "").split(":");
  if (!contenu) return;
  if (cercle.length !== 2) return;
  const [type, idTexte] = cercle as [string, string];
  const porteeType = type === "etablissement" ? "etablissement" : "classe";
  const porteeId = Number(idTexte);
  if (!Number.isInteger(porteeId)) return;

  // Vérification : le cercle appartient vraiment à l'utilisateur.
  const cercles = await mesCercles(utilisateur.id, utilisateur.role);
  if (!cercles.some((c) => c.type === porteeType && c.id === porteeId)) return;

  await db.insert(publications).values({
    auteurUserId: utilisateur.id,
    porteeType,
    porteeId,
    contenu: contenu.slice(0, 2000),
  });
  revalidatePath("/fil");
}

export async function commenter(donnees: FormData) {
  const utilisateur = await exiger();
  const publicationId = Number(donnees.get("publicationId"));
  const contenu = String(donnees.get("contenu") ?? "").trim();
  if (!publicationId || !contenu) return;

  const [publication] = await db
    .select()
    .from(publications)
    .where(eq(publications.id, publicationId))
    .limit(1);
  if (!publication) return;

  await db.insert(commentaires).values({
    publicationId,
    auteurUserId: utilisateur.id,
    contenu: contenu.slice(0, 500),
  });

  // L'auteur de la publication est prévenu (sauf auto-commentaire).
  if (publication.auteurUserId !== utilisateur.id) {
    await db.insert(notifications).values({
      userId: publication.auteurUserId,
      texte: `${utilisateur.prenom} ${utilisateur.nom} a commenté votre publication.`,
      lien: "/fil",
    });
  }
  revalidatePath("/fil");
}

export async function reagir(donnees: FormData) {
  const utilisateur = await exiger();
  const publicationId = Number(donnees.get("publicationId"));
  if (!publicationId) return;

  const [deja] = await db
    .select({ id: reactions.id })
    .from(reactions)
    .where(and(eq(reactions.publicationId, publicationId), eq(reactions.userId, utilisateur.id)))
    .limit(1);
  if (deja) {
    await db.delete(reactions).where(eq(reactions.id, deja.id));
  } else {
    await db.insert(reactions).values({ publicationId, userId: utilisateur.id });
  }
  revalidatePath("/fil");
}

export async function cerclesDePublication() {
  const utilisateur = await exiger();
  return mesCercles(utilisateur.id, utilisateur.role);
}
