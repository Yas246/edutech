"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, enseignements, inscriptions, liensFamille, notifications, presences, users } from "@/db/schema";
import { exiger } from "@/lib/auth";

export type Retour = { erreur?: string; message?: string };

const statutsValides = new Set(["present", "retard", "absent", "absent_justifie"]);

/** Qui a le droit de faire l'appel : direction de l'école ou enseignant de la classe. */
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

/** Enregistre l'appel du jour : une ligne par élève, refait sans doubler. */
export async function enregistrerAppel(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idClasse = Number(donnees.get("classeId"));
  const contexte = await garde(idClasse);
  if (!contexte) return { erreur: "Vous ne faites pas partie de l'équipe de cette classe." };

  const date = String(donnees.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: "Choisissez la date de l'appel." };

  // Les élèves transmis : entries_<id>=statut et motif_<id> pour les absents.
  const lignes: { eleveUserId: number; statut: string; motif: string }[] = [];
  for (const [cle, valeur] of donnees.entries()) {
    if (!cle.startsWith("statut_")) continue;
    const id = Number(cle.slice("statut_".length));
    const statut = String(valeur);
    if (!Number.isInteger(id) || !statutsValides.has(statut)) continue;
    lignes.push({
      eleveUserId: id,
      statut,
      motif:
        statut === "absent" || statut === "absent_justifie"
          ? String(donnees.get(`motif_${id}`) ?? "").trim()
          : "",
    });
  }
  if (lignes.length === 0) return { erreur: "Aucun élève à enregistrer." };

  // Vérification : tous ces élèves sont bien inscrits dans cette classe.
  const inscrits = await db
    .select({ eleveUserId: inscriptions.eleveUserId })
    .from(inscriptions)
    .where(
      and(
        eq(inscriptions.classeId, idClasse),
        inArray(inscriptions.eleveUserId, lignes.map((l) => l.eleveUserId)),
      ),
    );
  if (inscrits.length !== lignes.length) {
    return { erreur: "Un des élèves transmis n'appartient pas à cette classe." };
  }

  // Une seule ligne par élève et par jour : l'appel refait met à jour.
  for (const l of lignes) {
    await db
      .insert(presences)
      .values({
        classeId: idClasse,
        eleveUserId: l.eleveUserId,
        date,
        statut: l.statut,
        motif: l.motif,
        saisiPar: contexte.utilisateur.id,
      })
      .onConflictDoUpdate({
        target: [presences.classeId, presences.eleveUserId, presences.date],
        set: { statut: l.statut, motif: l.motif, saisiPar: contexte.utilisateur.id },
      });
  }

  // Alerte des parents pour les retards et absences non justifiées.
  const aAlerter = lignes.filter((l) => l.statut === "retard" || l.statut === "absent");
  if (aAlerter.length > 0) {
    const eleves = await db
      .select({ id: users.id, prenom: users.prenom, nom: users.nom })
      .from(users)
      .where(inArray(users.id, aAlerter.map((l) => l.eleveUserId)));
    const liens = await db
      .select({ parentUserId: liensFamille.parentUserId, eleveUserId: liensFamille.eleveUserId })
      .from(liensFamille)
      .where(inArray(liensFamille.eleveUserId, aAlerter.map((l) => l.eleveUserId)));

    const alertes: { userId: number; texte: string; lien: string }[] = [];
    for (const lien of liens) {
      const ligne = aAlerter.find((l) => l.eleveUserId === lien.eleveUserId);
      const eleve = eleves.find((e) => e.id === lien.eleveUserId);
      if (!ligne || !eleve) continue;
      alertes.push({
        userId: lien.parentUserId,
        texte:
          ligne.statut === "absent"
            ? `Absence de ${eleve.prenom} ${eleve.nom} signalée en ${contexte.classe.nom} le ${date}`
            : `Retard de ${eleve.prenom} ${eleve.nom} signalé en ${contexte.classe.nom} le ${date}`,
        lien: "/tableau-de-bord",
      });
    }
    if (alertes.length > 0) {
      await db.insert(notifications).values(alertes);
    }
  }

  revalidatePath(`/classes/${idClasse}/appel`);
  const absents = lignes.filter((l) => l.statut !== "present").length;
  const pluriel = lignes.length > 1 ? "s" : "";
  return {
    message: `Appel enregistré pour ${lignes.length} élève${pluriel}${absents > 0 ? ` (${absents} non présent${absents > 1 ? "s" : ""}, parents prévenus)` : ", tous présents"}.`,
  };
}
