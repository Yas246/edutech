"use server";

import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { abonnementsTransport, arrets, lignesTransport, tickets } from "@/db/schema";
import { exiger } from "@/lib/auth";
import type { Retour } from "@/components/ui/alerte";

export type { Retour };

/** L'élève s'abonne à une ligne, à un arrêt donné. */
export async function abonner(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("eleve");
  const ligneId = Number(donnees.get("ligneId"));
  const arretId = Number(donnees.get("arretId"));
  if (!ligneId || !arretId) return { erreur: "Choisissez la ligne et votre arrêt." };

  const [arret] = await db
    .select({ id: arrets.id })
    .from(arrets)
    .where(and(eq(arrets.id, arretId), eq(arrets.ligneId, ligneId)))
    .limit(1);
  if (!arret) return { erreur: "Cet arrêt n'appartient pas à cette ligne." };

  const [deja] = await db
    .select({ id: abonnementsTransport.id })
    .from(abonnementsTransport)
    .where(eq(abonnementsTransport.eleveUserId, utilisateur.id))
    .limit(1);
  if (deja) return { erreur: "Vous êtes déjà abonné à une ligne (un seul abonnement par élève)." };

  await db.insert(abonnementsTransport).values({ eleveUserId: utilisateur.id, ligneId, arretId });
  revalidatePath("/transport");
  return { message: "Abonnement enregistré." };
}

/** L'élève achète un ticket à 200 F (paiement en ligne simulé). */
export async function acheterTicket(_prec: Retour, donnees: FormData): Promise<Retour> {
  const utilisateur = await exiger("eleve");
  const ligneId = Number(donnees.get("ligneId"));
  const [ligne] = await db
    .select({ nom: lignesTransport.nom })
    .from(lignesTransport)
    .where(eq(lignesTransport.id, ligneId))
    .limit(1);
  if (!ligne) return { erreur: "Ligne introuvable." };

  const code = randomBytes(4).toString("hex").toUpperCase();
  await db.insert(tickets).values({
    code: `EDT-${code}`,
    eleveUserId: utilisateur.id,
    ligneId,
    montant: 200,
  });
  revalidatePath("/transport");
  return { message: `Ticket EDT-${code} acheté pour la ligne ${ligne.nom} (200 F).` };
}
