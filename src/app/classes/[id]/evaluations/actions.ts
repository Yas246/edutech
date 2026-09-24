"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, enseignements, evaluations, inscriptions, matieres, notes } from "@/db/schema";
import { exiger } from "@/lib/auth";

export type Retour = { erreur?: string; message?: string };

/** Même garde que l'appel : direction de l'école ou enseignant de la classe. */
async function garde(idClasse: number) {
  const utilisateur = await exiger("direction", "enseignant");
  const [classe] = await db
    .select({ id: classes.id, nom: classes.nom, etablissementId: classes.etablissementId })
    .from(classes)
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) return null;
  if (utilisateur.role === "direction") {
    if (classe.etablissementId !== utilisateur.id) return null;
  } else {
    const lie = await db
      .select({ id: enseignements.id })
      .from(enseignements)
      .where(
        and(eq(enseignements.classeId, idClasse), eq(enseignements.enseignantUserId, utilisateur.id)),
      )
      .limit(1);
    if (lie.length === 0) return null;
  }
  return { utilisateur, classe };
}

/** Créer une évaluation dans une matière de la classe. */
export async function creerEvaluation(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idClasse = Number(donnees.get("classeId"));
  const contexte = await garde(idClasse);
  if (!contexte) return { erreur: "Vous ne faites pas partie de l'équipe de cette classe." };

  const matiereId = Number(donnees.get("matiereId"));
  const titre = String(donnees.get("titre") ?? "").trim();
  const type = String(donnees.get("type") ?? "interrogation");
  const bareme = Number(donnees.get("bareme") ?? 20);
  const date = String(donnees.get("date") ?? "").trim();

  if (!matiereId) return { erreur: "Choisissez la matière." };
  if (!titre) return { erreur: "Donnez un titre, même court : « Interrogation n°2 »." };
  if (!["interrogation", "devoir"].includes(type)) return { erreur: "Type d'évaluation inconnu." };
  if (!Number.isInteger(bareme) || bareme < 1 || bareme > 100) {
    return { erreur: "Le barème doit être un nombre entier (20 pour une note sur 20)." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: "Choisissez la date de l'évaluation." };

  const [matiere] = await db
    .select({ id: matieres.id })
    .from(matieres)
    .where(and(eq(matieres.id, matiereId), eq(matieres.classeId, idClasse)))
    .limit(1);
  if (!matiere) return { erreur: "Cette matière n'existe pas dans la classe." };

  await db.insert(evaluations).values({
    classeId: idClasse,
    matiereId,
    titre,
    type,
    bareme,
    date,
    creePar: contexte.utilisateur.id,
  });
  revalidatePath(`/classes/${idClasse}/evaluations`);
  return { message: `« ${titre} » créée. Saisissez les notes.` };
}

/** Enregistrer les notes d'une évaluation (virgule acceptée, barème contrôlé). */
export async function enregistrerNotes(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idEvaluation = Number(donnees.get("evaluationId"));
  if (!idEvaluation) return { erreur: "Évaluation inconnue." };

  const [evaluation] = await db
    .select({
      id: evaluations.id,
      bareme: evaluations.bareme,
      classeId: evaluations.classeId,
      titre: evaluations.titre,
    })
    .from(evaluations)
    .where(eq(evaluations.id, idEvaluation))
    .limit(1);
  if (!evaluation) return { erreur: "Évaluation introuvable." };
  const contexte = await garde(evaluation.classeId);
  if (!contexte) return { erreur: "Vous ne faites pas partie de l'équipe de cette classe." };

  // Champs note_<idEleve> : vides = pas de note (élève absent à l'épreuve).
  const lignes: { eleveUserId: number; valeur: string }[] = [];
  for (const [cle, brut] of donnees.entries()) {
    if (!cle.startsWith("note_")) continue;
    const brutTexte = String(brut).trim();
    if (!brutTexte) continue;
    const id = Number(cle.slice("note_".length));
    if (!Number.isInteger(id)) continue;
    lignes.push({ eleveUserId: id, valeur: brutTexte });
  }
  if (lignes.length === 0) {
    return { erreur: "Aucune note saisie. Laissez vide les élèves absents à l'épreuve." };
  }

  // Vérification et conversion (virgule française acceptée).
  const valeurComposee = new Map<number, number>();
  for (const l of lignes) {
    const nombre = Number(l.valeur.replace(",", "."));
    if (!Number.isFinite(nombre)) {
      return { erreur: `« ${l.valeur} » n'est pas un nombre.` };
    }
    if (nombre < 0) return { erreur: "Une note ne peut pas être négative." };
    if (nombre > evaluation.bareme) {
      return {
        erreur: `Note ${l.valeur} refusée : le barème de « ${evaluation.titre} » est ${evaluation.bareme}.`,
      };
    }
    valeurComposee.set(l.eleveUserId, nombre);
  }

  // Tous les élèves notés doivent appartenir à la classe.
  const inscrits = await db
    .select({ eleveUserId: inscriptions.eleveUserId })
    .from(inscriptions)
    .where(eq(inscriptions.classeId, evaluation.classeId));
  const idsClasse = new Set(inscrits.map((i) => i.eleveUserId));
  for (const id of valeurComposee.keys()) {
    if (!idsClasse.has(id)) return { erreur: "Un des élèves notés n'appartient pas à cette classe." };
  }

  for (const [eleveUserId, nombre] of valeurComposee) {
    await db
      .insert(notes)
      .values({ evaluationId: idEvaluation, eleveUserId, valeur: nombre.toFixed(2) })
      .onConflictDoUpdate({
        target: [notes.evaluationId, notes.eleveUserId],
        set: { valeur: nombre.toFixed(2) },
      });
  }

  revalidatePath(`/classes/${evaluation.classeId}/evaluations`);
  return { message: `Notes de « ${evaluation.titre} » enregistrées pour ${valeurComposee.size} élève${valeurComposee.size > 1 ? "s" : ""}.` };
}
