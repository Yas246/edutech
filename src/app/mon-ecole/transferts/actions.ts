"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, etablissements, inscriptions, transferts, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import type { Retour } from "@/components/ui/alerte";

/** L'établissement dirigé par le compte courant. */
async function monEtablissement() {
  const utilisateur = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, utilisateur.id))
    .limit(1);
  return ecole ?? null;
}

/**
 * La demande de transfert d'entrée : la direction d'ACCUEIL l'ouvre
 * après examen du dossier de l'élève, et c'est l'école d'origine qui
 * l'acceptera. Tant que l'origine n'a pas dit oui, aucune inscription
 * n'est créée.
 */
export async function demanderTransfert(_prec: Retour, donnees: FormData): Promise<Retour> {
  const monEcole = await monEtablissement();
  if (!monEcole) return { erreur: "Aucun établissement rattaché à votre compte." };

  const email = String(donnees.get("email") ?? "").trim().toLowerCase();
  const classeId = Number(donnees.get("classeId"));
  const statutArrivee = String(donnees.get("statutArrivee") ?? "");
  const motif = String(donnees.get("motif") ?? "").trim();

  if (!email) return { erreur: "Indiquez l'email du compte élève." };
  const [eleve] = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(users)
    .where(and(eq(users.email, email), eq(users.role, "eleve")))
    .limit(1);
  if (!eleve) return { erreur: "Aucun compte élève n'existe avec cet email." };

  const [classe] = await db
    .select({ id: classes.id, nom: classes.nom })
    .from(classes)
    .where(and(eq(classes.id, classeId), eq(classes.etablissementId, monEcole.id)))
    .limit(1);
  if (!classe) return { erreur: "Choisissez une classe d'accueil de votre établissement." };
  if (statutArrivee !== "redoublant" && statutArrivee !== "passant") {
    return { erreur: "Précisez si l'élève arrive comme redoublant ou passant." };
  }

  // L'école d'origine : celle de l'inscription actuelle de l'élève.
  const [origine] = await db
    .select({
      etablissementId: classes.etablissementId,
      nom: etablissements.nom,
      classe: classes.nom,
    })
    .from(inscriptions)
    .innerJoin(classes, eq(classes.id, inscriptions.classeId))
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(inscriptions.eleveUserId, eleve.id))
    .limit(1);
  if (!origine) {
    return {
      erreur:
        "Cet élève n'est inscrit dans aucun établissement : inscrivez-le directement, sans transfert.",
    };
  }
  if (origine.etablissementId === monEcole.id) {
    return { erreur: "Cet élève est déjà inscrit chez vous." };
  }

  const enCours = await db
    .select({ id: transferts.id })
    .from(transferts)
    .where(
      and(
        eq(transferts.eleveUserId, eleve.id),
        eq(transferts.etablissementArrivee, monEcole.id),
        eq(transferts.statut, "demande"),
      ),
    )
    .limit(1);
  if (enCours.length > 0) {
    return { erreur: "Une demande de transfert est déjà en attente pour cet élève." };
  }

  const utilisateur = await exiger("direction");
  await db.insert(transferts).values({
    eleveUserId: eleve.id,
    etablissementDepart: origine.etablissementId,
    etablissementArrivee: monEcole.id,
    statutArrivee,
    classeArriveeId: classe.id,
    motif,
    statut: "demande",
    demandePar: utilisateur.id,
  });

  revalidatePath("/mon-ecole/transferts");
  return {
    message: `Demande ouverte : ${eleve.prenom} ${eleve.nom}, de ${origine.nom} (${origine.classe}) vers ${classe.nom}. L'école d'origine doit maintenant l'accepter — le papier que l'élève lui porte correspond à cette étape.`,
  };
}

/**
 * La décision de l'école d'ORIGINE : c'est elle qui exécute le
 * transfert numérique (accepter = libérer l'élève et créer son
 * inscription dans la classe d'accueil) ou le refuse. L'inscription
 * d'origine reste, l'historique est préservé.
 */
export async function statuerTransfertOrigine(donnees: FormData): Promise<void> {
  const monEcole = await monEtablissement();
  if (!monEcole) return;

  const id = Number(donnees.get("transfertId"));
  const decision = String(donnees.get("decision") ?? "");
  if (decision !== "valide" && decision !== "refuse") return;

  const [demande] = await db
    .select()
    .from(transferts)
    .where(and(eq(transferts.id, id), eq(transferts.statut, "demande")))
    .limit(1);
  if (!demande || demande.etablissementDepart !== monEcole.id) return;

  const utilisateur = await exiger("direction");
  await db
    .update(transferts)
    .set({ statut: decision, decidePar: utilisateur.id })
    .where(eq(transferts.id, id));

  if (decision === "valide" && demande.classeArriveeId) {
    await db
      .insert(inscriptions)
      .values({
        classeId: demande.classeArriveeId,
        eleveUserId: demande.eleveUserId,
      })
      .onConflictDoNothing();
  }

  revalidatePath("/mon-ecole/transferts");
}
