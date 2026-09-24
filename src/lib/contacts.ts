import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  conversations,
  enseignements,
  etablissements,
  inscriptions,
  liensFamille,
  users,
} from "@/db/schema";

/** Qui l'utilisateur peut contacter : ses relations scolaires réelles. */
export async function contactsAutorises(
  idUtilisateur: number,
  role: string,
): Promise<{ id: number; prenom: string; nom: string; role: string }[]> {
  if (role === "ministere") return [];

  const ids = new Set<number>();

  const collecte: { id: number; prenom: string; nom: string; role: string }[] = [];

  const classesDe = async (idEleve: number | null) => {
    if (!idEleve) return [];
    return db
      .select({ id: classes.id, etablissementId: classes.etablissementId })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(inscriptions.eleveUserId, idEleve));
  };

  if (role === "parent" || role === "direction" || role === "enseignant") {
    // Les élèves visés : ceux du parent, ou ceux des classes de l'enseignant,
    // ou ceux de l'école de la direction.
    let idsEleves: number[] = [];
    let idsEcoles: number[] = [];
    let idsClasses: number[] = [];

    if (role === "parent") {
      const enfants = await db
        .select({ eleveUserId: liensFamille.eleveUserId })
        .from(liensFamille)
        .where(eq(liensFamille.parentUserId, idUtilisateur));
      idsEleves = enfants.map((e) => e.eleveUserId);
      const classesLignes = idsEleves.length
        ? await db
            .select({ id: classes.id, etablissementId: classes.etablissementId })
            .from(inscriptions)
            .innerJoin(classes, eq(classes.id, inscriptions.classeId))
            .where(inArray(inscriptions.eleveUserId, idsEleves))
        : [];
      idsClasses = classesLignes.map((c) => c.id);
      idsEcoles = [...new Set(classesLignes.map((c) => c.etablissementId))];
    } else if (role === "enseignant") {
      const lignes = await db
        .select({ id: classes.id, etablissementId: classes.etablissementId })
        .from(enseignements)
        .innerJoin(classes, eq(classes.id, enseignements.classeId))
        .where(eq(enseignements.enseignantUserId, idUtilisateur));
      idsClasses = [...new Set(lignes.map((l) => l.id))];
      idsEcoles = [...new Set(lignes.map((l) => l.etablissementId))];
    } else {
      const [ecole] = await db
        .select({ id: etablissements.id })
        .from(etablissements)
        .where(eq(etablissements.directionUserId, idUtilisateur))
        .limit(1);
      idsEcoles = ecole ? [ecole.id] : [];
      const classesLignes = idsEcoles.length
        ? await db
            .select({ id: classes.id })
            .from(classes)
            .where(inArray(classes.etablissementId, idsEcoles))
        : [];
      idsClasses = classesLignes.map((c) => c.id);
    }

    // Les enseignants des classes visées.
    if (idsClasses.length) {
      const profs = await db
        .selectDistinct({ id: users.id, prenom: users.prenom, nom: users.nom, role: users.role })
        .from(enseignements)
        .innerJoin(users, eq(users.id, enseignements.enseignantUserId))
        .where(inArray(enseignements.classeId, idsClasses));
      collecte.push(...profs);
    }

    // La direction des écoles visées.
    if (idsEcoles.length) {
      const directions = await db
        .select({ id: users.id, prenom: users.prenom, nom: users.nom, role: users.role })
        .from(etablissements)
        .innerJoin(users, eq(users.id, etablissements.directionUserId))
        .where(inArray(etablissements.id, idsEcoles));
      collecte.push(...directions);
    }

    // Les parents et les élèves des classes visées (pour l'équipe).
    if (role !== "parent" && idsClasses.length) {
      const eleves = await db
        .selectDistinct({ id: users.id, prenom: users.prenom, nom: users.nom, role: users.role })
        .from(inscriptions)
        .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
        .where(inArray(inscriptions.classeId, idsClasses));
      collecte.push(...eleves);
      const idsElevesClasses = eleves.map((e) => e.id);
      if (idsElevesClasses.length) {
        const parents = await db
          .selectDistinct({ id: users.id, prenom: users.prenom, nom: users.nom, role: users.role })
          .from(liensFamille)
          .innerJoin(users, eq(users.id, liensFamille.parentUserId))
          .where(inArray(liensFamille.eleveUserId, idsElevesClasses));
        collecte.push(...parents);
      }
    }
  }

  if (role === "eleve") {
    const classesLignes = await classesDe(idUtilisateur);
    const idsClasses = classesLignes.map((c) => c.id);
    if (idsClasses.length) {
      const profs = await db
        .selectDistinct({ id: users.id, prenom: users.prenom, nom: users.nom, role: users.role })
        .from(enseignements)
        .innerJoin(users, eq(users.id, enseignements.enseignantUserId))
        .where(inArray(enseignements.classeId, idsClasses));
      collecte.push(...profs);
    }
  }

  const vus = new Set<number>();
  const resultat: { id: number; prenom: string; nom: string; role: string }[] = [];
  for (const c of collecte) {
    if (c.id === idUtilisateur || vus.has(c.id)) continue;
    vus.add(c.id);
    resultat.push(c);
  }
  return resultat.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

/** La conversation à deux, retrouvée ou créée (paire triée). */
export async function conversationDeux(userA: number, userB: number): Promise<number> {
  const [petit, grand] = userA < userB ? [userA, userB] : [userB, userA];
  const [existante] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.userA, petit), eq(conversations.userB, grand)))
    .limit(1);
  if (existante) return existante.id;
  const [cree] = await db
    .insert(conversations)
    .values({ userA: petit, userB: grand })
    .returning({ id: conversations.id });
  return cree.id;
}
