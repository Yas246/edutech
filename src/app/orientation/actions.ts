"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { relevesOrientation } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { extraireReleve } from "@/lib/extraction-releve";
import { BAREMES, composerProfil } from "@/lib/orientation-moteur";
import type { Retour } from "@/components/ui/alerte";

const TAILLE_MAX = 3 * 1024 * 1024;

/**
 * La photo du relevé : lue par le modèle de vision du fournisseur,
 * puis recomposée par la couche déterministe avant d'être montrée à
 * l'élève pour correction. Rien n'est validé à ce stade.
 */
export async function televerserReleve(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("eleve");
  const fichier = donnees.get("photo");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: "Choisissez la photo de votre relevé." };
  }
  if (!fichier.type.startsWith("image/")) {
    return { erreur: "Le relevé doit être une photo (JPEG, PNG ou WebP)." };
  }
  if (fichier.size > TAILLE_MAX) {
    return { erreur: "Photo trop lourde : 3 Mo au maximum." };
  }

  const tampon = Buffer.from(await fichier.arrayBuffer());
  const dataUrl = `data:${fichier.type};base64,${tampon.toString("base64")}`;

  const brut = await extraireReleve(dataUrl).catch((e: Error) => e);
  if (brut instanceof Error) return { erreur: brut.message };

  const matieresBrut: Record<string, { note?: number | null; points?: number | null }> = {};
  for (const m of brut.matieres ?? []) {
    const cle = (m.matiere ?? "").trim();
    if (!cle) continue;
    matieresBrut[cle] = { note: m.note ?? null, points: m.points ?? null };
  }
  const serieLue = (brut.serie ?? "").trim().toUpperCase();
  const serie = BAREMES[serieLue] ? serieLue : "";

  const { profil, controle } = composerProfil({
    serie,
    nom: brut.nom ?? "",
    numTable: brut.num_table ?? "",
    moyenneAnnoncee: brut.moyenne ?? null,
    decision: brut.decision ?? "",
    matieres: matieresBrut,
  });

  const [cree] = await db
    .insert(relevesOrientation)
    .values({
      eleveUserId: utilisateur.id,
      serie: profil.serie,
      nom: profil.nom,
      numTable: profil.numTable,
      moyenne: profil.moyenne !== null ? String(profil.moyenne) : null,
      mention: profil.mention,
      decision: profil.decision,
      matieres: profil.matieres,
      brut: brut as unknown as Record<string, unknown>,
      controle,
      fichier: dataUrl,
      statut: "extrait",
    })
    .returning({ id: relevesOrientation.id });

  redirect(`/orientation/${cree.id}`);
}

/**
 * La saisie directe, sans photo : mêmes calculs, mêmes contrôles, la
 * confirmation reste de mise.
 */
export async function saisirReleve(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("eleve");
  const serie = String(donnees.get("serie") ?? "");
  if (!BAREMES[serie]) return { erreur: "Choisissez votre série." };

  const matieres: Record<string, { note?: number | null; points?: number | null }> = {};
  for (const cle of Object.keys(BAREMES[serie])) {
    const brut = String(donnees.get(`note_${cle}`) ?? "").replace(",", ".").trim();
    if (!brut) continue;
    const note = Number(brut);
    matieres[cle] = { note: Number.isFinite(note) ? note : null, points: null };
  }
  if (Object.keys(matieres).length === 0) {
    return { erreur: "Saisissez au moins une note." };
  }
  const moyenneBrut = String(donnees.get("moyenneAnnoncee") ?? "").replace(",", ".").trim();

  const { profil, controle } = composerProfil({
    serie,
    nom: String(donnees.get("nom") ?? "").trim(),
    moyenneAnnoncee: moyenneBrut ? Number(moyenneBrut) : null,
    matieres,
  });

  const [cree] = await db
    .insert(relevesOrientation)
    .values({
      eleveUserId: utilisateur.id,
      serie: profil.serie,
      nom: profil.nom,
      numTable: "",
      moyenne: profil.moyenne !== null ? String(profil.moyenne) : null,
      mention: profil.mention,
      decision: "",
      matieres: profil.matieres,
      brut: null,
      controle,
      fichier: "",
      statut: "extrait",
    })
    .returning({ id: relevesOrientation.id });

  redirect(`/orientation/${cree.id}`);
}
