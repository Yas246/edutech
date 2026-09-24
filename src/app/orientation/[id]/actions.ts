"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { relevesOrientation } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { BAREMES, composerProfil } from "@/lib/orientation-moteur";
import type { Retour } from "@/components/ui/alerte";

/**
 * La validation par l'élève : les valeurs CORRIGÉES par lui passent de
 * nouveau par le calcul déterministe (coefficients du barème, moyenne
 * et mention recalculées), puis le relevé devient la base de ses
 * pistes d'orientation.
 */
export async function validerReleve(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("eleve");
  const id = Number(donnees.get("releveId"));
  const [releve] = await db
    .select()
    .from(relevesOrientation)
    .where(
      and(eq(relevesOrientation.id, id), eq(relevesOrientation.eleveUserId, utilisateur.id)),
    )
    .limit(1);
  if (!releve) return { erreur: "Relevé introuvable." };

  const serie = String(donnees.get("serie") ?? "");
  if (!BAREMES[serie]) return { erreur: "Choisissez la série du relevé." };

  const matieres: Record<string, { note?: number | null; points?: number | null }> = {};
  let notesRenseignees = 0;
  for (const [cle, ancien] of Object.entries(releve.matieres)) {
    const brut = String(donnees.get(`note_${cle}`) ?? "").replace(",", ".").trim();
    const note = brut === "" ? null : Number(brut);
    const noteValide = note !== null && Number.isFinite(note) ? note : null;
    if (noteValide !== null) notesRenseignees += 1;
    matieres[cle] = { note: noteValide, points: ancien.points ?? null };
  }
  if (notesRenseignees === 0) {
    return { erreur: "Saisissez au moins une note : sans elle, aucune piste n'est calculable." };
  }

  const moyenneBrut = String(donnees.get("moyenneAnnoncee") ?? "").replace(",", ".").trim();
  const { profil, controle } = composerProfil({
    serie,
    nom: String(donnees.get("nom") ?? "").trim(),
    numTable: String(donnees.get("numTable") ?? "").trim(),
    moyenneAnnoncee: moyenneBrut ? Number(moyenneBrut) : null,
    decision: String(donnees.get("decision") ?? "").trim(),
    matieres,
  });

  await db
    .update(relevesOrientation)
    .set({
      serie: profil.serie,
      nom: profil.nom,
      numTable: profil.numTable,
      moyenne: profil.moyenne !== null ? String(profil.moyenne) : null,
      mention: profil.mention,
      decision: profil.decision,
      matieres: profil.matieres,
      controle,
      statut: "valide",
    })
    .where(eq(relevesOrientation.id, id));

  revalidatePath(`/orientation/${id}`);
  revalidatePath("/orientation");
  redirect(`/orientation/${id}`);
}
