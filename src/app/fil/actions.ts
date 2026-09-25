"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  classes,
  communautes,
  communautesMembres,
  commentaires,
  enseignements,
  inscriptions,
  notifications,
  publications,
  reactions,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";

export type Cercle = { type: "etablissement" | "classe" | "communaute"; id: number; nom: string };

/**
 * Les cercles où l'utilisateur peut publier : ses classes (comme élève
 * ou enseignant), son école (comme direction ou enseignant de l'école)
 * et les communautés dont il est membre.
 */
async function mesCercles(idUtilisateur: number, role: string): Promise<Cercle[]> {
  const resultats: Cercle[] = [];

  if (role === "eleve") {
    const lignes = await db
      .select({ id: classes.id, nom: classes.nom, etablissementId: classes.etablissementId })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(inscriptions.eleveUserId, idUtilisateur));
    for (const l of lignes) {
      resultats.push({ type: "classe", id: l.id, nom: `Classe ${l.nom}` });
    }
  } else {
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
  }

  const mesCommunautes = await db
    .select({ id: communautes.id, nom: communautes.nom })
    .from(communautesMembres)
    .innerJoin(communautes, eq(communautes.id, communautesMembres.communauteId))
    .where(eq(communautesMembres.userId, idUtilisateur));
  for (const c of mesCommunautes) {
    resultats.push({ type: "communaute", id: c.id, nom: c.nom });
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
  const porteeType =
    type === "etablissement" ? "etablissement" : type === "communaute" ? "communaute" : "classe";
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

/** Les cercles de LECTURE : publication, devoirs des classes suivies
 * ET annonces des écoles fréquentées. */
export async function cerclesDeLecture(idUtilisateur: number, role: string) {
  const cercles = await mesCercles(idUtilisateur, role);
  const classesIds: number[] = [];
  const ecolesIds: number[] = [];

  if (role === "parent") {
    const { liensFamille } = await import("@/db/schema");
    const classesEnfants = await db
      .select({
        id: classes.id,
        etablissementId: classes.etablissementId,
      })
      .from(liensFamille)
      .innerJoin(inscriptions, eq(inscriptions.eleveUserId, liensFamille.eleveUserId))
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(liensFamille.parentUserId, idUtilisateur));
    classesIds.push(...classesEnfants.map((c) => c.id));
    ecolesIds.push(...classesEnfants.map((c) => c.etablissementId));
  } else {
    classesIds.push(...cercles.filter((c) => c.type === "classe").map((c) => c.id));
    ecolesIds.push(...cercles.filter((c) => c.type === "etablissement").map((c) => c.id));
    if (role === "eleve") {
      const ecolesEleve = await db
        .selectDistinct({ etablissementId: classes.etablissementId })
        .from(inscriptions)
        .innerJoin(classes, eq(classes.id, inscriptions.classeId))
        .where(eq(inscriptions.eleveUserId, idUtilisateur));
      ecolesIds.push(...ecolesEleve.map((c) => c.etablissementId));
    }
    if (role === "enseignant") {
      const ecolesProf = await db
        .selectDistinct({ etablissementId: classes.etablissementId })
        .from(enseignements)
        .innerJoin(classes, eq(classes.id, enseignements.classeId))
        .where(eq(enseignements.enseignantUserId, idUtilisateur));
      ecolesIds.push(...ecolesProf.map((c) => c.etablissementId));
    }
  }

  return {
    cercles,
    classesIds: [...new Set(classesIds)],
    ecolesIds: [...new Set(ecolesIds)],
  };
}
