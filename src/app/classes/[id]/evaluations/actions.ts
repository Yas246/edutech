"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { evaluations, inscriptions, matieres, notes } from "@/db/schema";
import { gardeClasse } from "@/lib/garde-classe";
import { exiger } from "@/lib/auth";

export type Retour = { erreur?: string; message?: string };

/** Créer une évaluation dans une matière de la classe. */
export async function creerEvaluation(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idClasse = Number(donnees.get("classeId"));
  const contexte = await gardeClasse(idClasse);
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
  const contexte = await gardeClasse(evaluation.classeId);
  if (!contexte) return { erreur: "Vous ne faites pas partie de l'équipe de cette classe." };

  // Champs par élève : note_<id>, absent_<id>, justifie_<id>.
  // Absent non justifiée = zéro compté ; absente justifiée = exclue.
  // Le champ note d'un élève absent étant désactivé, les identifiants
  // se collectent aussi depuis les cases à cocher.
  type Ligne = { eleveUserId: number; valeur: string; absent: boolean; justifie: boolean };
  const lignes: Ligne[] = [];
  const ids = new Set<number>();
  for (const [cle] of donnees.entries()) {
    for (const prefixe of ["note_", "absent_"]) {
      if (cle.startsWith(prefixe)) {
        const id = Number(cle.slice(prefixe.length));
        if (Number.isInteger(id)) ids.add(id);
      }
    }
  }
  for (const id of ids) {
    const absent = donnees.get(`absent_${id}`) !== null;
    const justifie = absent && donnees.get(`justifie_${id}`) !== null;
    const brutTexte = String(donnees.get(`note_${id}`) ?? "").trim();
    // Note vide sans absence : l'élève n'a pas de note, on passe.
    if (!absent && brutTexte === "") continue;
    lignes.push({
      eleveUserId: id,
      valeur: absent ? "0" : brutTexte,
      absent,
      justifie,
    });
  }
  if (lignes.length === 0) {
    return { erreur: "Aucune note saisie pour cette classe." };
  }

  // Vérification et conversion (virgule française acceptée).
  const valeurComposee = new Map<number, Ligne>();
  for (const l of lignes) {
    if (!l.absent) {
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
      valeurComposee.set(l.eleveUserId, { ...l, valeur: nombre.toFixed(2) });
    } else {
      valeurComposee.set(l.eleveUserId, l);
    }
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

  for (const [eleveUserId, ligne] of valeurComposee) {
    await db
      .insert(notes)
      .values({
        evaluationId: idEvaluation,
        eleveUserId,
        valeur: ligne.valeur,
        absent: ligne.absent,
        justifie: ligne.justifie,
      })
      .onConflictDoUpdate({
        target: [notes.evaluationId, notes.eleveUserId],
        set: {
          valeur: ligne.valeur,
          absent: ligne.absent,
          justifie: ligne.justifie,
        },
      });
  }

  revalidatePath(`/classes/${evaluation.classeId}/evaluations`);
  return { message: `Notes de « ${evaluation.titre} » enregistrées pour ${valeurComposee.size} élève${valeurComposee.size > 1 ? "s" : ""}.` };
}
