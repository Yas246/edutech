"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, creneaux, devoirs, enseignements, etablissements, matieres, salles, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { estHeureValide, seChevauchent } from "@/lib/vie-scolaire";
import type { Retour } from "@/components/ui/alerte";

const joursValides = new Set([1, 2, 3, 4, 5, 6]);

/**
 * Qui peut poser un créneau : la direction de l'établissement de la
 * classe (l'espace « emploi du temps » sera délégable plus loin).
 */
async function gardeEdt(idClasse: number) {
  const utilisateur = await exiger("direction", "enseignant");
  const [classe] = await db
    .select({
      id: classes.id,
      nom: classes.nom,
      etablissementId: classes.etablissementId,
      directionUserId: etablissements.directionUserId,
    })
    .from(classes)
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) return null;
  if (utilisateur.role === "direction") {
    if (classe.directionUserId !== utilisateur.id) return null;
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

export async function poserCreneau(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idClasse = Number(donnees.get("classeId"));
  const contexte = await gardeEdt(idClasse);
  if (!contexte) return { erreur: "Vous n'avez pas la main sur cet emploi du temps." };

  const matiereId = Number(donnees.get("matiereId"));
  const enseignantUserId = Number(donnees.get("enseignantUserId"));
  const salleId = Number(donnees.get("salleId"));
  const jour = Number(donnees.get("jour"));
  const heureDebut = String(donnees.get("heureDebut") ?? "").trim();
  const heureFin = String(donnees.get("heureFin") ?? "").trim();

  if (!matiereId || !enseignantUserId || !salleId) {
    return { erreur: "Choisissez la matière, l'enseignant et la salle." };
  }
  if (!joursValides.has(jour)) return { erreur: "Choisissez le jour." };
  if (!estHeureValide(heureDebut) || !estHeureValide(heureFin)) {
    return { erreur: "Les heures sont au format 24 h, par exemple 08:00 et 10:00." };
  }
  if (heureFin <= heureDebut) {
    return { erreur: "L'heure de fin doit être après l'heure de début." };
  }

  const [matiere] = await db
    .select({ nom: matieres.nom })
    .from(matieres)
    .where(and(eq(matieres.id, matiereId), eq(matieres.classeId, idClasse)))
    .limit(1);
  if (!matiere) return { erreur: "Cette matière n'existe pas dans la classe." };

  // L'enseignant doit enseigner cette matière dans cette classe.
  const [attribution] = await db
    .select({ id: enseignements.id })
    .from(enseignements)
    .where(
      and(
        eq(enseignements.classeId, idClasse),
        eq(enseignements.matiereId, matiereId),
        eq(enseignements.enseignantUserId, enseignantUserId),
      ),
    )
    .limit(1);
  if (!attribution) {
    return { erreur: "Cet enseignant n'a pas été confié à cette matière : commencez par la confier." };
  }

  const nouveau = { jour, heureDebut, heureFin };

  // Les créneaux du même jour dans l'établissement, pour les trois conflits.
  const existants = await db
    .select({
      id: creneaux.id,
      classeId: creneaux.classeId,
      enseignantUserId: creneaux.enseignantUserId,
      salleId: creneaux.salleId,
      jour: creneaux.jour,
      heureDebut: creneaux.heureDebut,
      heureFin: creneaux.heureFin,
      classeNom: classes.nom,
      salleNom: salles.nom,
      enseignantPrenom: users.prenom,
      enseignantNom: users.nom,
    })
    .from(creneaux)
    .innerJoin(classes, eq(classes.id, creneaux.classeId))
    .innerJoin(salles, eq(salles.id, creneaux.salleId))
    .innerJoin(users, eq(users.id, creneaux.enseignantUserId))
    .where(and(eq(classes.etablissementId, contexte.classe.etablissementId), eq(creneaux.jour, jour)));

  for (const c of existants) {
    if (!seChevauchent(nouveau, c)) continue;
    const horaire = `${c.heureDebut} à ${c.heureFin}`;
    if (c.salleId === salleId) {
      return {
        erreur: `Conflit : la salle ${c.salleNom} est déjà occupée (${c.classeNom}, ${horaire}).`,
      };
    }
    if (c.enseignantUserId === enseignantUserId) {
      return {
        erreur: `Conflit : cet enseignant a déjà cours (${c.classeNom}, ${horaire}).`,
      };
    }
    if (c.classeId === idClasse) {
      return { erreur: `Conflit : la classe ${c.classeNom} a déjà cours (${horaire}).` };
    }
  }

  await db.insert(creneaux).values({
    classeId: idClasse,
    matiereId,
    enseignantUserId,
    salleId,
    jour,
    heureDebut,
    heureFin,
  });
  revalidatePath(`/classes/${idClasse}/emploi-du-temps`);
  return { message: `Créneau posé : ${matiere.nom}.` };
}

export async function retirerCreneau(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idCreneau = Number(donnees.get("creneauId"));
  const [ligne] = await db
    .select({ classeId: creneaux.classeId })
    .from(creneaux)
    .where(eq(creneaux.id, idCreneau))
    .limit(1);
  if (!ligne) return { erreur: "Créneau introuvable." };
  const contexte = await gardeEdt(ligne.classeId);
  if (!contexte) return { erreur: "Vous n'avez pas la main sur cet emploi du temps." };
  await db.delete(creneaux).where(eq(creneaux.id, idCreneau));
  revalidatePath(`/classes/${ligne.classeId}/emploi-du-temps`);
  return { message: "Créneau retiré." };
}

export async function creerDevoir(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idClasse = Number(donnees.get("classeId"));
  const contexte = await gardeEdt(idClasse);
  if (!contexte) return { erreur: "Vous ne faites pas partie de l'équipe de cette classe." };

  const matiereId = Number(donnees.get("matiereId"));
  const titre = String(donnees.get("titre") ?? "").trim();
  const consigne = String(donnees.get("consigne") ?? "").trim();
  const aRendreLe = String(donnees.get("aRendreLe") ?? "").trim();
  const donneLe = String(donnees.get("donneLe") ?? "").trim();

  const [attribution] = await db
    .select({ id: enseignements.id })
    .from(enseignements)
    .where(
      and(
        eq(enseignements.classeId, idClasse),
        eq(enseignements.matiereId, matiereId),
        eq(enseignements.enseignantUserId, contexte.utilisateur.id),
      ),
    )
    .limit(1);
  if (!attribution && contexte.utilisateur.role !== "direction") {
    return { erreur: "Seul l'enseignant de la matière (ou la direction) donne un devoir." };
  }
  if (!matiereId) return { erreur: "Choisissez la matière." };
  if (!titre) return { erreur: "Donnez un titre au devoir." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(donneLe)) return { erreur: "Choisissez la date à laquelle il est donné." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(aRendreLe)) return { erreur: "Choisissez la date de remise." };
  if (aRendreLe < donneLe) return { erreur: "La remise ne peut pas précéder le jour du don." };

  await db.insert(devoirs).values({
    classeId: idClasse,
    matiereId,
    enseignantUserId: contexte.utilisateur.id,
    titre,
    consigne,
    donneLe,
    aRendreLe,
  });
  revalidatePath(`/classes/${idClasse}/devoirs`);
  return { message: `Devoir « ${titre} » posé : les familles le voient.` };
}

