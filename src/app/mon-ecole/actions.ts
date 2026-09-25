"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  classes,
  enseignements,
  inscriptions,
  matieres,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { ecoleDeLaDirection } from "@/lib/ecole";

export type Retour = { erreur?: string; message?: string };

async function contexte() {
  const utilisateur = await exiger("direction");
  const ecole = await ecoleDeLaDirection(utilisateur);
  return { utilisateur, ecole, idEcole: ecole.id };
}

/** Créer une classe dans son établissement. */
export async function creerClasse(_prec: Retour, donnees: FormData): Promise<Retour> {
  const { idEcole } = await contexte();
  const nom = String(donnees.get("nom") ?? "").trim();
  const niveau = String(donnees.get("niveau") ?? "").trim();
  if (!nom) return { erreur: "Donnez un nom à la classe." };

  const [existe] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.etablissementId, idEcole), eq(classes.nom, nom)))
    .limit(1);
  if (existe) return { erreur: `La classe « ${nom} » existe déjà.` };

  await db.insert(classes).values({ etablissementId: idEcole, nom, niveau });
  revalidatePath("/mon-ecole");
  return { message: `Classe « ${nom} » créée.` };
}

/** Ajouter une matière à une classe (le doublon est refusé). */
export async function ajouterMatiere(_prec: Retour, donnees: FormData): Promise<Retour> {
  const { idEcole } = await contexte();
  const classeId = Number(donnees.get("classeId"));
  const nom = String(donnees.get("nom") ?? "").trim();
  const coefficient = Number(donnees.get("coefficient") ?? 1);
  if (!classeId) return { erreur: "Choisissez la classe." };
  if (!nom) return { erreur: "Donnez un nom à la matière." };
  if (!Number.isInteger(coefficient) || coefficient < 1 || coefficient > 10) {
    return { erreur: "Le coefficient doit être un nombre entier de 1 à 10." };
  }

  const [classe] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classeId), eq(classes.etablissementId, idEcole)))
    .limit(1);
  if (!classe) return { erreur: "Cette classe n'est pas la vôtre." };

  // Dédoublonnage insensible à la casse, comme le demande l'usage :
  // « mathématiques » et « Mathématiques » sont la même matière.
  const existantes = await db
    .select({ nom: matieres.nom })
    .from(matieres)
    .where(eq(matieres.classeId, classeId));
  if (existantes.some((m) => m.nom.toLowerCase() === nom.toLowerCase())) {
    return { erreur: `« ${nom} » figure déjà dans cette classe.` };
  }

  await db.insert(matieres).values({ classeId, nom, coefficient });
  revalidatePath("/mon-ecole");
  return { message: `Matière « ${nom} » ajoutée à ${classe.nom}.` };
}

/** Retirer une matière d'une classe. */
export async function retirerMatiere(_prec: Retour, donnees: FormData): Promise<Retour> {
  const { idEcole } = await contexte();
  const matiereId = Number(donnees.get("matiereId"));
  const [classe] = await db
    .select({ id: classes.id, nom: classes.nom })
    .from(matieres)
    .innerJoin(classes, eq(matieres.classeId, classes.id))
    .where(and(eq(matieres.id, matiereId), eq(classes.etablissementId, idEcole)))
    .limit(1);
  if (!classe) return { erreur: "Matière introuvable dans votre établissement." };
  await db.delete(matieres).where(eq(matieres.id, matiereId));
  revalidatePath("/mon-ecole");
  return { message: `Matière retirée de ${classe.nom}.` };
}

/** Confier une matière d'une classe à un enseignant. */
export async function affecterEnseignant(_prec: Retour, donnees: FormData): Promise<Retour> {
  const { idEcole } = await contexte();
  const matiereId = Number(donnees.get("matiereId"));
  const enseignantId = Number(donnees.get("enseignantId"));
  if (!matiereId || !enseignantId) return { erreur: "Choisissez la matière et l'enseignant." };

  const [ligne] = await db
    .select({ classeId: classes.id, classeNom: classes.nom, matiereNom: matieres.nom })
    .from(matieres)
    .innerJoin(classes, eq(matieres.classeId, classes.id))
    .where(and(eq(matieres.id, matiereId), eq(classes.etablissementId, idEcole)))
    .limit(1);
  if (!ligne) return { erreur: "Matière introuvable dans votre établissement." };

  const [enseignant] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, enseignantId), eq(users.role, "enseignant")))
    .limit(1);
  if (!enseignant) return { erreur: "Compte enseignant introuvable." };

  await db
    .insert(enseignements)
    .values({
      classeId: ligne.classeId,
      matiereId,
      enseignantUserId: enseignantId,
    })
    .onConflictDoNothing();
  revalidatePath("/mon-ecole");
  return {
    message: `${enseignant.prenom} ${enseignant.nom} en charge de ${ligne.matiereNom} en ${ligne.classeNom}.`,
  };
}

/** Inscrire un élève (par l'email de son compte) dans une classe. */
