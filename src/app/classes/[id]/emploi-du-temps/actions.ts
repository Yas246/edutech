"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { annulationsCreneaux, classes, creneaux, devoirs, enseignements, etablissements, inscriptions, liensFamille, matieres, notifications, salles, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { gardeEdtEtablissement } from "@/lib/garde-classe";
import { estHeureValide, seChevauchent } from "@/lib/vie-scolaire";
import type { Retour } from "@/components/ui/alerte";

const joursValides = new Set([1, 2, 3, 4, 5, 6]);

async function gardeEdt(idClasse: number) {
  const [classe] = await db
    .select({
      id: classes.id,
      nom: classes.nom,
      etablissementId: classes.etablissementId,
    })
    .from(classes)
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) return null;
  const utilisateur = await gardeEdtEtablissement(classe.etablissementId);
  if (!utilisateur) return null;
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
  const dateSeance = String(donnees.get("dateSeance") ?? "").trim();

  if (!matiereId || !enseignantUserId || !salleId) {
    return { erreur: "Choisissez la matière, l'enseignant et la salle." };
  }
  if (dateSeance) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateSeance)) {
      return { erreur: "La date de la séance unique n'est pas valide." };
    }
    const jourDeLaDate = new Date(`${dateSeance}T12:00:00`).getDay();
    if (jourDeLaDate === 0 || jourDeLaDate > 6) {
      return { erreur: "La séance unique doit tomber un jour de classe (lundi au samedi)." };
    }
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
      dateSeance: creneaux.dateSeance,
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

  // Les annulations du jour visé : un hebdomadaire annulé ce jour-là
  // libère la salle et l'enseignant.
  const annuleesCeJour = dateSeance
    ? new Set(
        (
          await db
            .select({ creneauId: annulationsCreneaux.creneauId })
            .from(annulationsCreneaux)
            .where(eq(annulationsCreneaux.date, dateSeance))
        ).map((a) => a.creneauId),
      )
    : new Set<number>();

  for (const c of existants) {
    if (!seChevauchent(nouveau, c)) continue;
    if (annuleesCeJour.has(c.id)) continue; // cette séance-là n'existe pas ce jour
    if (dateSeance && c.dateSeance && c.dateSeance !== dateSeance) continue;
    if (!dateSeance && c.dateSeance) {
      // Un hebdomadaire s'oppose à une séance unique si les dates correspondent.
      const js = new Date(`${c.dateSeance}T12:00:00`).getDay();
      if (js !== jour) continue;
    }
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
    ...(dateSeance ? { dateSeance } : {}),
  });
  revalidatePath(`/classes/${idClasse}/emploi-du-temps`);
  return {
    message: dateSeance
      ? `Séance unique posée : ${matiere.nom} le ${dateSeance}.`
      : `Créneau posé : ${matiere.nom}.`,
  };
}

/**
 * L'annulation d'une séance d'un créneau hebdomadaire : élèves et
 * parents de la classe sont prévenus une fois, avec le motif.
 */
export async function annulerSeance(_prec: Retour, donnees: FormData): Promise<Retour> {
  const idCreneau = Number(donnees.get("creneauId"));
  const [ligne] = await db
    .select({ classeId: creneaux.classeId, matiereId: creneaux.matiereId, jour: creneaux.jour })
    .from(creneaux)
    .where(eq(creneaux.id, idCreneau))
    .limit(1);
  if (!ligne) return { erreur: "Créneau introuvable." };
  const contexte = await gardeEdt(ligne.classeId);
  if (!contexte) return { erreur: "Vous n'avez pas la main sur cet emploi du temps." };

  const date = String(donnees.get("date") ?? "").trim();
  const motif = String(donnees.get("motif") ?? "").trim().slice(0, 140);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { erreur: "Choisissez la date de la séance à annuler." };
  }
  const jourDeLaDate = new Date(`${date}T12:00:00`).getDay();
  if (jourDeLaDate !== ligne.jour) {
    return { erreur: "Cette date ne correspond pas au jour du créneau." };
  }
  if (date <= new Date().toISOString().slice(0, 10)) {
    return { erreur: "Seule une séance à venir peut être annulée." };
  }
  const [deja] = await db
    .select({ id: annulationsCreneaux.id })
    .from(annulationsCreneaux)
    .where(
      and(eq(annulationsCreneaux.creneauId, idCreneau), eq(annulationsCreneaux.date, date)),
    )
    .limit(1);
  if (deja) return { erreur: "Cette séance est déjà annulée." };

  const utilisateur = await exiger("direction", "enseignant");
  await db.insert(annulationsCreneaux).values({
    creneauId: idCreneau,
    date,
    motif,
    creePar: utilisateur.id,
  });

  // Prévenir élèves et parents de la classe, une seule fois chacun.
  const [matiere] = await db
    .select({ nom: matieres.nom })
    .from(matieres)
    .where(eq(matieres.id, ligne.matiereId))
    .limit(1);
  const texte = `Cours de ${matiere?.nom ?? "classe"} annulé le ${date}${motif ? ` (${motif})` : ""}`;
  const destinataires = await db
    .select({ parentUserId: liensFamille.parentUserId })
    .from(inscriptions)
    .leftJoin(liensFamille, eq(liensFamille.eleveUserId, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, ligne.classeId));
  const elevesClasse = await db
    .select({ eleveUserId: inscriptions.eleveUserId })
    .from(inscriptions)
    .where(eq(inscriptions.classeId, ligne.classeId));

  const alertes: { userId: number; texte: string; lien: string }[] = [];
  const vus = new Set<number>();
  for (const d of destinataires) {
    if (d.parentUserId && !vus.has(d.parentUserId)) {
      vus.add(d.parentUserId);
      alertes.push({ userId: d.parentUserId, texte, lien: "/calendrier" });
    }
  }
  for (const e of elevesClasse) {
    if (!vus.has(e.eleveUserId)) {
      vus.add(e.eleveUserId);
      alertes.push({ userId: e.eleveUserId, texte, lien: "/calendrier" });
    }
  }
  if (alertes.length > 0) {
    await db.insert(notifications).values(alertes);
  }

  revalidatePath(`/classes/${ligne.classeId}/emploi-du-temps`);
  return { message: `Séance du ${date} annulée : les familles sont prévenues.` };
}

/** Le rétablissement : la séance redevient normale, sans re-notifier. */
export async function retablirSeance(donnees: FormData): Promise<void> {
  const idCreneau = Number(donnees.get("creneauId"));
  const date = String(donnees.get("date") ?? "").trim();
  const [ligne] = await db
    .select({ classeId: creneaux.classeId })
    .from(creneaux)
    .where(eq(creneaux.id, idCreneau))
    .limit(1);
  if (!ligne) return;
  const contexte = await gardeEdt(ligne.classeId);
  if (!contexte) return;
  await db
    .delete(annulationsCreneaux)
    .where(and(eq(annulationsCreneaux.creneauId, idCreneau), eq(annulationsCreneaux.date, date)));
  revalidatePath(`/classes/${ligne.classeId}/emploi-du-temps`);
}

/** Adaptation au formulaire HTML natif. */
export async function annulerSeanceFormulaire(donnees: FormData): Promise<void> {
  await annulerSeance({}, donnees);
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
  let contexte = await gardeEdt(idClasse);
  if (!contexte) {
    // L'ENSEIGNANT de la matière dans cette classe donne aussi les
    // devoirs : c'est même sa voie normale.
    const utilisateur = await exiger("direction", "enseignant");
    const [attr] = await db
      .select({ id: enseignements.id })
      .from(enseignements)
      .where(
        and(
          eq(enseignements.classeId, idClasse),
          eq(enseignements.enseignantUserId, utilisateur.id),
        ),
      )
      .limit(1);
    if (!attr) {
      return { erreur: "Seul l'enseignant d'une matière de la classe (ou la direction) donne un devoir." };
    }
    contexte = {
      utilisateur,
      classe: { id: idClasse, nom: "", etablissementId: 0 },
    };
  }

  const matiereId = Number(donnees.get("matiereId"));
  const titre = String(donnees.get("titre") ?? "").trim();
  const consigne = String(donnees.get("consigne") ?? "").trim();
  const aRendreLe = String(donnees.get("aRendreLe") ?? "").trim();
  const donneLe = String(donnees.get("donneLe") ?? "").trim();

  if (contexte.utilisateur.role === "enseignant") {
    // L'enseignant ne pose des devoirs que sur SES matières de la classe.
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
    if (!attribution) {
      return { erreur: "Seul l'enseignant de la matière (ou la direction) donne un devoir." };
    }
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

  // Les parents des élèves de la classe sont prévenus une fois.
  const [matiere] = await db
    .select({ nom: matieres.nom })
    .from(matieres)
    .where(eq(matieres.id, matiereId))
    .limit(1);
  const familles = await db
    .select({ parentUserId: liensFamille.parentUserId })
    .from(inscriptions)
    .innerJoin(liensFamille, eq(liensFamille.eleveUserId, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, idClasse));
  const texte = `Nouveau devoir en ${matiere?.nom ?? "classe"} : « ${titre} », à rendre le ${aRendreLe}`;
  const dejaLa =
    familles.length > 0
      ? await db
          .select({ userId: notifications.userId, texte: notifications.texte })
          .from(notifications)
          .where(
            and(
              inArray(
                notifications.userId,
                familles.map((f) => f.parentUserId),
              ),
              eq(notifications.texte, texte),
            ),
          )
      : [];
  const alertes = familles
    .filter((f) => !dejaLa.some((d) => d.userId === f.parentUserId))
    .map((f) => ({ userId: f.parentUserId, texte, lien: "/tableau-de-bord" }));
  if (alertes.length > 0) {
    await db.insert(notifications).values(alertes);
  }

  revalidatePath(`/classes/${idClasse}/devoirs`);
  return { message: `Devoir « ${titre} » posé : les familles le voient.` };
}

