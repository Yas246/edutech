import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, enseignements, etablissements } from "@/db/schema";
import { exiger, type Utilisateur } from "@/lib/auth";

export type ClasseGardee = {
  id: number;
  nom: string;
  etablissementId: number;
  directionUserId: number | null;
};

/**
 * Garde unique des pages d'équipe de classe (appel, évaluations,
 * bulletins) : la direction de l'établissement, ou un enseignant de la
 * classe. Renvoie null quand l'accès n'est pas légitime.
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
  } else {
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
    if (lie.length === 0) return null;
  }

  return { utilisateur, classe };
}
