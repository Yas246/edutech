"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { communautes, communautesMembres, publications } from "@/db/schema";
import { exiger } from "@/lib/auth";
import type { Retour } from "@/components/ui/alerte";

const TYPES = ["matiere", "groupe_travail", "club", "communaute"];

/** Créer une communauté ouverte : toute personne connectée. */
export async function creerCommunaute(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger();
  const nom = String(donnees.get("nom") ?? "").trim().slice(0, 100);
  const description = String(donnees.get("description") ?? "").trim().slice(0, 200);
  const type = String(donnees.get("type") ?? "");
  if (!nom) return { erreur: "Donnez un nom à la communauté." };
  if (!TYPES.includes(type)) return { erreur: "Choisissez le type de communauté." };

  const [creee] = await db
    .insert(communautes)
    .values({ nom, description, type, creePar: utilisateur.id })
    .returning({ id: communautes.id });
  await db.insert(communautesMembres).values({
    communauteId: creee.id,
    userId: utilisateur.id,
    role: "admin",
  });

  redirect(`/communautes/${creee.id}`);
}

/** Adaptation au formulaire HTML natif de l'annuaire. */
export async function creerCommunauteFormulaire(donnees: FormData): Promise<void> {
  await creerCommunaute({}, donnees);
}

/** L'adhésion est libre et réversible : un bouton, une ligne. */
export async function basculerAdhesion(donnees: FormData): Promise<void> {
  const utilisateur = await exiger();
  const communauteId = Number(donnees.get("communauteId"));
  const retour = String(donnees.get("retour") ?? "/communautes");

  const [membre] = await db
    .select({ id: communautesMembres.id })
    .from(communautesMembres)
    .where(
      and(
        eq(communautesMembres.communauteId, communauteId),
        eq(communautesMembres.userId, utilisateur.id),
      ),
    )
    .limit(1);
  if (membre) {
    await db.delete(communautesMembres).where(eq(communautesMembres.id, membre.id));
  } else {
    await db.insert(communautesMembres).values({ communauteId, userId: utilisateur.id });
  }
  revalidatePath("/communautes");
  revalidatePath(`/communautes/${communauteId}`);
  redirect(retour);
}

/** Publier sur le mur d'une communauté : membres seulement. */
export async function publierSurCommunaute(
  _prec: Retour,
  donnees: FormData,
): Promise<Retour> {
  const utilisateur = await exiger();
  const communauteId = Number(donnees.get("communauteId"));
  const contenu = String(donnees.get("contenu") ?? "").trim();
  if (!contenu) return { erreur: "Écrivez votre publication." };

  const [membre] = await db
    .select({ id: communautesMembres.id })
    .from(communautesMembres)
    .where(
      and(
        eq(communautesMembres.communauteId, communauteId),
        eq(communautesMembres.userId, utilisateur.id),
      ),
    )
    .limit(1);
  if (!membre) return { erreur: "Rejoignez la communauté pour y publier." };

  await db.insert(publications).values({
    auteurUserId: utilisateur.id,
    porteeType: "communaute",
    porteeId: communauteId,
    contenu,
  });
  revalidatePath(`/communautes/${communauteId}`);
  return { message: "Publié." };
}
