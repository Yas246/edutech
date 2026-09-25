import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  delegations,
  delegues,
  enseignements,
  equipes,
  etablissements,
  inscriptions,
  liensFamille,
  users,
} from "@/db/schema";
import type { Utilisateur } from "@/lib/auth";

/**
 * La place d'une personne dans un espace.
 * admin      : la direction de l'établissement — elle publie et gère.
 * moderateur : l'enseignant de la classe, le délégué à la vie scolaire,
 *              l'élève délégué — ils publient.
 * membre     : l'élève inscrit — il lit et commente.
 * lecteur    : le parent qui a rejoint la classe par son code — il lit.
 */
export type PlaceEspace = "admin" | "moderateur" | "membre" | "lecteur";

export type Droits = {
  lire: boolean;
  commenter: boolean;
  reagir: boolean;
  publier: boolean;
};

const DROITS: Record<PlaceEspace, Droits> = {
  admin: { lire: true, commenter: true, reagir: true, publier: true },
  moderateur: { lire: true, commenter: true, reagir: true, publier: true },
  membre: { lire: true, commenter: true, reagir: true, publier: false },
  lecteur: { lire: true, commenter: false, reagir: false, publier: false },
};

const RIEN: Droits = { lire: false, commenter: false, reagir: false, publier: false };

/** La délégation d'un membre de l'équipe dans un établissement. */
async function aDelegation(idEtablissement: number, idUtilisateur: number, role: string) {
  const [ligne] = await db
    .select({ id: delegations.id })
    .from(delegations)
    .where(
      and(
        eq(delegations.etablissementId, idEtablissement),
        eq(delegations.userId, idUtilisateur),
        eq(delegations.role, role),
      ),
    )
    .limit(1);
  return Boolean(ligne);
}

/** La place d'une personne dans l'espace d'une classe, calculée sur-le-champ. */
export async function placeDansClasse(
  idClasse: number,
  utilisateur: Utilisateur,
): Promise<PlaceEspace | null> {
  if (!Number.isInteger(idClasse)) return null;

  const [classe] = await db
    .select({
      id: classes.id,
      etablissementId: classes.etablissementId,
      directionUserId: etablissements.directionUserId,
    })
    .from(classes)
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) return null;

  // La direction de l'établissement (ou un collègue de direction de
  // l'équipe confirmée) tient l'espace.
  if (utilisateur.role === "direction") {
    if (classe.directionUserId === utilisateur.id) return "admin";
    const [equipe] = await db
      .select({ statut: equipes.statut })
      .from(equipes)
      .where(
        and(
          eq(equipes.etablissementId, classe.etablissementId),
          eq(equipes.userId, utilisateur.id),
        ),
      )
      .limit(1);
    if (equipe?.statut === "confirme") return "admin";
  }

  if (utilisateur.role === "enseignant") {
    const [lie] = await db
      .select({ id: enseignements.id })
      .from(enseignements)
      .where(
        and(
          eq(enseignements.classeId, idClasse),
          eq(enseignements.enseignantUserId, utilisateur.id),
        ),
      )
      .limit(1);
    if (lie) return "moderateur";
    if (await aDelegation(classe.etablissementId, utilisateur.id, "vie_scolaire")) {
      return "moderateur";
    }
  }

  // L'élève inscrit lit et commente ; le délégué publie en plus.
  if (utilisateur.role === "eleve") {
    const [inscrit] = await db
      .select({ id: inscriptions.id })
      .from(inscriptions)
      .where(
        and(eq(inscriptions.classeId, idClasse), eq(inscriptions.eleveUserId, utilisateur.id)),
      )
      .limit(1);
    if (!inscrit) return null;

    const [delegue] = await db
      .select({ id: delegues.id })
      .from(delegues)
      .where(and(eq(delegues.classeId, idClasse), eq(delegues.eleveUserId, utilisateur.id)))
      .limit(1);
    return delegue ? "moderateur" : "membre";
  }

  // Le parent d'un enfant inscrit lit la classe (en lecture seule).
  // La révocation de l'élève coupe l'accès de sa famille ; l'adhésion
  // par code, elle, reste ce qui ouvre les notifications.
  if (utilisateur.role === "parent") {
    const [enfantInscrit] = await db
      .select({ id: liensFamille.id })
      .from(liensFamille)
      .innerJoin(inscriptions, eq(inscriptions.eleveUserId, liensFamille.eleveUserId))
      .where(
        and(
          eq(liensFamille.parentUserId, utilisateur.id),
          eq(inscriptions.classeId, idClasse),
        ),
      )
      .limit(1);
    return enfantInscrit ? "lecteur" : null;
  }

  return null;
}

/** Les droits d'une personne sur l'espace d'une classe. */
export async function droitsClasse(idClasse: number, utilisateur: Utilisateur): Promise<Droits> {
  const place = await placeDansClasse(idClasse, utilisateur);
  return place ? DROITS[place] : RIEN;
}

/**
 * Les droits d'une personne sur le mur d'un établissement : la
 * direction publie, l'équipe et les élèves inscrits commentent, les
 * parents des élèves lisent.
 */
export async function droitsEtablissement(
  idEtablissement: number,
  utilisateur: Utilisateur,
): Promise<Droits> {
  const [ecole] = await db
    .select({ id: etablissements.id, directionUserId: etablissements.directionUserId })
    .from(etablissements)
    .where(eq(etablissements.id, idEtablissement))
    .limit(1);
  if (!ecole) return RIEN;

  if (utilisateur.role === "direction" && ecole.directionUserId === utilisateur.id) {
    return DROITS.admin;
  }
  if (utilisateur.role === "enseignant") {
    const [equipe] = await db
      .select({ statut: equipes.statut })
      .from(equipes)
      .where(
        and(
          eq(equipes.etablissementId, idEtablissement),
          eq(equipes.userId, utilisateur.id),
        ),
      )
      .limit(1);
    if (equipe?.statut === "confirme") return DROITS.moderateur;
    const lie = await db
      .select({ id: enseignements.id })
      .from(enseignements)
      .innerJoin(classes, eq(classes.id, enseignements.classeId))
      .where(
        and(
          eq(classes.etablissementId, idEtablissement),
          eq(enseignements.enseignantUserId, utilisateur.id),
        ),
      )
      .limit(1);
    if (lie.length > 0) return DROITS.membre;
  }
  if (utilisateur.role === "eleve") {
    const inscrit = await db
      .select({ id: inscriptions.id })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(
        and(eq(classes.etablissementId, idEtablissement), eq(inscriptions.eleveUserId, utilisateur.id)),
      )
      .limit(1);
    if (inscrit.length > 0) return DROITS.membre;
  }
  if (utilisateur.role === "parent") {
    const lie = await db
      .select({ id: liensFamille.id })
      .from(liensFamille)
      .innerJoin(inscriptions, eq(inscriptions.eleveUserId, liensFamille.eleveUserId))
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(
        and(
          eq(classes.etablissementId, idEtablissement),
          eq(liensFamille.parentUserId, utilisateur.id),
        ),
      )
      .limit(1);
    if (lie.length > 0) return DROITS.lecteur;
  }
  return RIEN;
}

/** Les droits sur le mur d'une communauté ouverte : les membres publient. */
export async function droitsCommunaute(
  idCommunaute: number,
  idUtilisateur: number,
): Promise<Droits> {
  const { communautesMembres } = await import("@/db/schema");
  const [membre] = await db
    .select({ role: communautesMembres.role })
    .from(communautesMembres)
    .where(
      and(
        eq(communautesMembres.communauteId, idCommunaute),
        eq(communautesMembres.userId, idUtilisateur),
      ),
    )
    .limit(1);
  if (!membre) return { lire: true, commenter: false, reagir: false, publier: false };
  return DROITS.admin;
}

/** Les droits d'une personne sur une portée de publication donnée. */
export async function droitsPortee(
  porteeType: string,
  porteeId: number,
  utilisateur: Utilisateur,
): Promise<Droits> {
  if (porteeType === "classe") return droitsClasse(porteeId, utilisateur);
  if (porteeType === "etablissement") return droitsEtablissement(porteeId, utilisateur);
  if (porteeType === "communaute") return droitsCommunaute(porteeId, utilisateur.id);
  return RIEN;
}

/** Les identifiants des classes dont je suis membre, par rôle. */
export async function mesClassesMembre(
  utilisateur: Utilisateur,
): Promise<{ id: number; nom: string; etablissementId: number }[]> {
  if (utilisateur.role === "eleve") {
    return db
      .select({ id: classes.id, nom: classes.nom, etablissementId: classes.etablissementId })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(inscriptions.eleveUserId, utilisateur.id));
  }
  if (utilisateur.role === "enseignant") {
    return db
      .selectDistinct({
        id: classes.id,
        nom: classes.nom,
        etablissementId: classes.etablissementId,
      })
      .from(enseignements)
      .innerJoin(classes, eq(classes.id, enseignements.classeId))
      .where(eq(enseignements.enseignantUserId, utilisateur.id));
  }
  if (utilisateur.role === "direction") {
    return db
      .select({ id: classes.id, nom: classes.nom, etablissementId: classes.etablissementId })
      .from(classes)
      .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
      .where(eq(etablissements.directionUserId, utilisateur.id));
  }
  if (utilisateur.role === "parent") {
    // Les classes où sont SES enfants : ce sont les communautés de
    // sa famille. La révocation de l'élève les retire.
    return db
      .selectDistinct({
        id: classes.id,
        nom: classes.nom,
        etablissementId: classes.etablissementId,
      })
      .from(liensFamille)
      .innerJoin(inscriptions, eq(inscriptions.eleveUserId, liensFamille.eleveUserId))
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(liensFamille.parentUserId, utilisateur.id));
  }
  return [];
}

/** Les établissements fréquentés, par rôle (annonces de l'école). */
export async function mesEtablissementsMembre(
  utilisateur: Utilisateur,
): Promise<number[]> {
  if (utilisateur.role === "direction") {
    const lignes = await db
      .select({ id: etablissements.id })
      .from(etablissements)
      .where(eq(etablissements.directionUserId, utilisateur.id));
    return lignes.map((l) => l.id);
  }
  if (utilisateur.role === "enseignant") {
    const parEquipe = await db
      .select({ id: equipes.etablissementId })
      .from(equipes)
      .where(and(eq(equipes.userId, utilisateur.id), eq(equipes.statut, "confirme")));
    const parCours = await db
      .selectDistinct({ id: classes.etablissementId })
      .from(enseignements)
      .innerJoin(classes, eq(classes.id, enseignements.classeId))
      .where(eq(enseignements.enseignantUserId, utilisateur.id));
    return [...new Set([...parEquipe.map((l) => l.id), ...parCours.map((l) => l.id)])];
  }
  if (utilisateur.role === "eleve") {
    const lignes = await db
      .selectDistinct({ id: classes.etablissementId })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(inscriptions.eleveUserId, utilisateur.id));
    return lignes.map((l) => l.id);
  }
  if (utilisateur.role === "parent") {
    const lignes = await db
      .selectDistinct({ id: classes.etablissementId })
      .from(liensFamille)
      .innerJoin(inscriptions, eq(inscriptions.eleveUserId, liensFamille.eleveUserId))
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(liensFamille.parentUserId, utilisateur.id));
    return lignes.map((l) => l.id);
  }
  return [];
}

/** Les élèves inscrits d'une classe (pour l'écran Délégués). */
export async function elevesDeClasse(idClasse: number) {
  return db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(inscriptions)
    .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, idClasse))
    .orderBy(users.nom);
}
