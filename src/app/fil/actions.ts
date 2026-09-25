"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  communautes,
  communautesMembres,
  commentaires,
  etablissements,
  notifications,
  publications,
  reactions,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import {
  droitsPortee,
  mesClassesMembre,
  mesEtablissementsMembre,
} from "@/lib/espace";

export type Cercle = { type: "etablissement" | "classe" | "communaute"; id: number; nom: string };

/**
 * Les cercles où la personne peut PUBLIER : la direction publie dans
 * son école et les espaces de ses classes, l'enseignant dans ses
 * classes (et dans l'école de son équipe confirmée), l'élève délégué
 * dans sa classe ; chacun dans les communautés ouvertes qu'il a
 * rejointes. Élèves simples et parents commentent ou lisent : ils
 * n'ouvrent pas le composer pour les cercles scolaires.
 */
export async function cerclesDePublication(): Promise<Cercle[]> {
  const utilisateur = await exiger();
  const resultats: Cercle[] = [];

  if (utilisateur.role === "direction") {
    const ecoles = await db
      .select({ id: etablissements.id, nom: etablissements.nom })
      .from(etablissements)
      .where(eq(etablissements.directionUserId, utilisateur.id));
    for (const e of ecoles) {
      resultats.push({ type: "etablissement", id: e.id, nom: e.nom });
    }
  }
  if (utilisateur.role === "enseignant") {
    const { equipes, etablissements } = await import("@/db/schema");
    const ecoles = await db
      .select({ id: etablissements.id, nom: etablissements.nom })
      .from(equipes)
      .innerJoin(etablissements, eq(etablissements.id, equipes.etablissementId))
      .where(and(eq(equipes.userId, utilisateur.id), eq(equipes.statut, "confirme")));
    for (const e of ecoles) {
      resultats.push({ type: "etablissement", id: e.id, nom: e.nom });
    }
  }

  if (utilisateur.role !== "parent") {
    for (const c of await mesClassesMembre(utilisateur)) {
      // L'élève simple lit et commente : seul le délégué publie,
      // place calculée plus bas.
      if (utilisateur.role === "eleve") {
        const { placeDansClasse } = await import("@/lib/espace");
        if (await placeDansClasse(c.id, utilisateur) !== "moderateur") continue;
      }
      resultats.push({ type: "classe", id: c.id, nom: `Classe ${c.nom}` });
    }
  }

  const mesCommunautes = await db
    .select({ id: communautes.id, nom: communautes.nom })
    .from(communautesMembres)
    .innerJoin(communautes, eq(communautes.id, communautesMembres.communauteId))
    .where(eq(communautesMembres.userId, utilisateur.id));
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

  // Le droit de publier dans ce cercle, recalculé côté serveur.
  const droits = await droitsPortee(porteeType, porteeId, utilisateur);
  if (!droits.publier) return;

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

  const droits = await droitsPortee(publication.porteeType, publication.porteeId, utilisateur);
  if (!droits.commenter) return;

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

  const [publication] = await db
    .select()
    .from(publications)
    .where(eq(publications.id, publicationId))
    .limit(1);
  if (!publication) return;

  const droits = await droitsPortee(publication.porteeType, publication.porteeId, utilisateur);
  if (!droits.reagir) return;

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

/**
 * Les cercles de LECTURE : les murs des espaces dont je suis membre.
 * Pour un parent, une classe ne parle que s'il l'a rejointe par son
 * code ; les annonces de l'école suivent les enfants.
 */
export async function cerclesDeLecture(utilisateur: Awaited<ReturnType<typeof exiger>>) {
  const classesMembre = await mesClassesMembre(utilisateur);
  const ecolesIds = await mesEtablissementsMembre(utilisateur);
  const communautesIds = (
    await db
      .select({ id: communautes.id })
      .from(communautesMembres)
      .innerJoin(communautes, eq(communautes.id, communautesMembres.communauteId))
      .where(eq(communautesMembres.userId, utilisateur.id))
  ).map((c) => c.id);

  return {
    classesIds: classesMembre.map((c) => c.id),
    ecolesIds: [...new Set(ecolesIds)],
    communautesIds: [...new Set(communautesIds)],
  };
}
