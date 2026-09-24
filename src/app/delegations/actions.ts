"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { delegations, etablissements, journal, users } from "@/db/schema";
import { exiger } from "@/lib/auth";

const rolesValides = new Set(["finances", "vie_scolaire", "edt"]);

async function ecoleDeLaDirection() {
  const direction = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, direction.id))
    .limit(1);
  return ecole;
}

export async function poserDelegation(donnees: FormData) {
  const ecole = await ecoleDeLaDirection();
  if (!ecole) return;
  const direction = await exiger("direction");
  const idMembre = Number(donnees.get("userId"));
  const role = String(donnees.get("role") ?? "");
  if (!rolesValides.has(role)) return;

  const [membre] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, idMembre), eq(users.role, "enseignant")))
    .limit(1);
  if (!membre) return;

  await db
    .insert(delegations)
    .values({ etablissementId: ecole.id, userId: idMembre, role })
    .onConflictDoNothing();
  await db.insert(journal).values({
    etablissementId: ecole.id,
    auteurUserId: direction.id,
    action: "Délégation",
    detail: `${role} posée à ${membre.prenom} ${membre.nom}`,
  });
  revalidatePath("/delegations");
  revalidatePath("/finances");
}

export async function retirerDelegation(donnees: FormData) {
  const ecole = await ecoleDeLaDirection();
  if (!ecole) return;
  const direction = await exiger("direction");
  const idMembre = Number(donnees.get("userId"));
  const role = String(donnees.get("role") ?? "");
  if (!rolesValides.has(role)) return;

  await db
    .delete(delegations)
    .where(
      and(
        eq(delegations.etablissementId, ecole.id),
        eq(delegations.userId, idMembre),
        eq(delegations.role, role),
      ),
    );
  const [membre] = await db
    .select({ prenom: users.prenom, nom: users.nom })
    .from(users)
    .where(eq(users.id, idMembre))
    .limit(1);
  await db.insert(journal).values({
    etablissementId: ecole.id,
    auteurUserId: direction.id,
    action: "Délégation",
    detail: `${role} retirée à ${membre ? `${membre.prenom} ${membre.nom}` : "un membre"}`,
  });
  revalidatePath("/delegations");
  revalidatePath("/finances");
}
