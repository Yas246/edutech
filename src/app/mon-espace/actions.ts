"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import type { Retour } from "@/components/ui/alerte";

/** Le téléphone béninois : chiffres seuls, indicatif retiré. */
function normaliserTelephone(saisie: string): string | null {
  const chiffres = saisie.replace(/\D+/g, "");
  if (!chiffres) return "";
  let n = chiffres;
  if (n.startsWith("00229")) n = n.slice(5);
  else if (n.startsWith("229") && n.length > 10) n = n.slice(3);
  if (n.length < 8 || n.length > 15) return null;
  return n;
}

/**
 * La mise à jour des informations de SON compte. Le pseudo ne bouge
 * pas : c'est l'identifiant public. Le téléphone, quand il est porté,
 * est normalisé et ne peut appartenir qu'à un seul compte.
 */
export async function modifierMonEspace(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger();
  const prenom = String(donnees.get("prenom") ?? "").trim();
  const nom = String(donnees.get("nom") ?? "").trim();
  const telephoneBrut = String(donnees.get("telephone") ?? "").trim();
  const sexeBrut = String(donnees.get("sexe") ?? "").trim().toUpperCase();
  const interets = String(donnees.get("interets") ?? "").trim().slice(0, 200);

  if (!prenom || !nom) return { erreur: "Le prénom et le nom sont nécessaires." };

  let telephone = "";
  if (telephoneBrut) {
    const normalise = normaliserTelephone(telephoneBrut);
    if (normalise === null) {
      return { erreur: "Ce numéro de téléphone ne semble pas valide." };
    }
    telephone = normalise;
    const [pris] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.telephone, telephone), ne(users.id, utilisateur.id)))
      .limit(1);
    if (pris) {
      return { erreur: "Ce numéro est déjà enregistré sur un autre compte." };
    }
  }

  await db
    .update(users)
    .set({
      prenom,
      nom,
      telephone,
      sexe: sexeBrut === "F" || sexeBrut === "M" ? sexeBrut : "",
      ...(utilisateur.role === "eleve" ? { interets } : {}),
    })
    .where(eq(users.id, utilisateur.id));

  revalidatePath("/mon-espace");
  revalidatePath("/tableau-de-bord");
  return { message: "Vos informations sont à jour." };
}
