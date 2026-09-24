import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { etablissements } from "@/db/schema";
import type { Utilisateur } from "@/lib/auth";

/**
 * L'établissement dont l'utilisateur de direction a la charge.
 * Les autres rôles sont renvoyés à leur espace.
 */
export async function ecoleDeLaDirection(
  utilisateur: Utilisateur,
): Promise<typeof etablissements.$inferSelect> {
  if (utilisateur.role !== "direction") redirect("/tableau-de-bord");
  const [ecole] = await db
    .select()
    .from(etablissements)
    .where(eq(etablissements.directionUserId, utilisateur.id))
    .limit(1);
  if (!ecole) redirect("/tableau-de-bord");
  return ecole;
}

export async function ecoleParId(id: number) {
  const [ecole] = await db.select().from(etablissements).where(eq(etablissements.id, id)).limit(1);
  return ecole;
}

export { and };
