import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, delegations, enseignements, etablissements } from "@/db/schema";
import { exiger, type Utilisateur } from "@/lib/auth";

export type ClasseGardee = {
  id: number;
  nom: string;
  etablissementId: number;
  directionUserId: number | null;
};

/** La délégation d'un utilisateur dans un établissement, si posée. */
async function delegationDe(
  idEtablissement: number,
  idUtilisateur: number,
  role: string,
): Promise<boolean> {
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

/**
 * Garde unique des pages d'équipe de classe (appel, évaluations,
 * bulletins) : la direction de l'établissement, le délégué à la vie
 * scolaire, ou un enseignant de la classe. Renvoie null quand l'accès
 * n'est pas légitime.
 */
export async function gardeClasse(
  idClasse: number,
): Promise<{ utilisateur: Utilisateur; classe: ClasseGardee } | null> {
  if (!Number.isInteger(idClasse)) return null;
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
    return { utilisateur, classe };
  }

  const lie = await db
    .select({ id: enseignements.id })
    .from(enseignements)
    .where(
      and(
        eq(enseignements.classeId, idClasse),
        eq(enseignements.enseignantUserId, utilisateur.id),
      ),
    )
    .limit(1);
  if (lie.length > 0) return { utilisateur, classe };

  // Le délégué à la vie scolaire couvre toutes les classes.
  if (await delegationDe(classe.etablissementId, utilisateur.id, "vie_scolaire")) {
    return { utilisateur, classe };
  }
  return null;
}

/** Le droit de gérer l'emploi du temps : direction ou délégué « edt ». */
export async function gardeEdtEtablissement(
  idEtablissement: number,
): Promise<Utilisateur | null> {
  const utilisateur = await exiger("direction", "enseignant");
  if (utilisateur.role === "direction") {
    const [ecole] = await db
      .select({ id: etablissements.id })
      .from(etablissements)
      .where(
        and(
          eq(etablissements.id, idEtablissement),
          eq(etablissements.directionUserId, utilisateur.id),
        ),
      )
      .limit(1);
    return ecole ? utilisateur : null;
  }
  return (await delegationDe(idEtablissement, utilisateur.id, "edt")) ? utilisateur : null;
}
