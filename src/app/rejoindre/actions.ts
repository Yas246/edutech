"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  codesClasse,
  codesEquipe,
  equipes,
  etablissements,
  inscriptions,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { remettreCompteur, saisieAutorisee, compterEchec } from "@/lib/codes";
import type { Retour } from "@/components/ui/alerte";

/**
 * L'enseignant rejoint l'école dont il porte le code d'invitation.
 * Le code vaut preuve de l'école : le rattachement naît confirmé.
 */
export async function rejoindreEcole(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("enseignant", "direction");
  const brut = String(donnees.get("code") ?? "").trim().toUpperCase();
  if (!brut) return { erreur: "Saisissez le code que l'école vous a donné." };
  if (!(await saisieAutorisee(utilisateur.id))) {
    return { erreur: "Trop d'essais erronés aujourd'hui : réessayez demain." };
  }

  const [entree] = await db
    .select({ etablissementId: codesEquipe.etablissementId, nom: etablissements.nom })
    .from(codesEquipe)
    .innerJoin(etablissements, eq(etablissements.id, codesEquipe.etablissementId))
    .where(eq(codesEquipe.code, brut))
    .limit(1);

  if (!entree) {
    await compterEchec(utilisateur.id);
    return { erreur: "Code inconnu. Vérifiez auprès de la direction de l'école." };
  }

  const [deja] = await db
    .select({ statut: equipes.statut })
    .from(equipes)
    .where(
      and(eq(equipes.etablissementId, entree.etablissementId), eq(equipes.userId, utilisateur.id)),
    )
    .limit(1);
  if (deja) {
    return {
      message:
        deja.statut === "confirme"
          ? `Vous faites déjà partie de l'équipe de ${entree.nom}.`
          : `Votre rattachement à ${entree.nom} est confirmé.`,
    };
  }

  await db
    .insert(equipes)
    .values({
      etablissementId: entree.etablissementId,
      userId: utilisateur.id,
      statut: "confirme",
    })
    .onConflictDoUpdate({
      target: [equipes.etablissementId, equipes.userId],
      set: { statut: "confirme" },
    });
  await remettreCompteur(utilisateur.id);
  revalidatePath("/mon-ecole/equipe");
  return { message: `Bienvenue dans l'équipe de ${entree.nom}.` };
}

/**
 * L'élève rejoint sa classe par son code : c'est l'inscription réelle,
 * la même que pose la direction — jamais un doublon.
 */
export async function rejoindreClasse(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("eleve");
  const brut = String(donnees.get("code") ?? "").trim().toUpperCase();
  if (!brut) return { erreur: "Saisissez le code de la classe." };
  if (!(await saisieAutorisee(utilisateur.id))) {
    return { erreur: "Trop d'essais erronés aujourd'hui : réessayez demain." };
  }

  const [entree] = await db
    .select({ classeId: codesClasse.classeId })
    .from(codesClasse)
    .where(eq(codesClasse.code, brut))
    .limit(1);
  if (!entree) {
    await compterEchec(utilisateur.id);
    return { erreur: "Code inconnu. Vérifiez auprès du professeur de la classe." };
  }

  const [deja] = await db
    .select({ id: inscriptions.id })
    .from(inscriptions)
    .where(
      and(
        eq(inscriptions.classeId, entree.classeId),
        eq(inscriptions.eleveUserId, utilisateur.id),
      ),
    )
    .limit(1);
  if (deja) {
    await remettreCompteur(utilisateur.id);
    return { message: "Vous êtes déjà inscrit dans cette classe." };
  }

  await db
    .insert(inscriptions)
    .values({ classeId: entree.classeId, eleveUserId: utilisateur.id })
    .onConflictDoNothing();
  await remettreCompteur(utilisateur.id);
  revalidatePath("/tableau-de-bord");
  return { message: "Inscription enregistrée : bienvenue dans la classe." };
}
