"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { etablissements, periodes } from "@/db/schema";
import { exiger } from "@/lib/auth";
import type { Retour } from "@/components/ui/alerte";

const LIBELLES_PERIODICITE: Record<number, string> = {
  1: "Annuel",
  2: "Semestriel",
  3: "Trimestriel",
  4: "Quadrimestriel",
  5: "Pentamestral",
  6: "Hexamestral",
};


function nomPeriode(rang: number, total: number): string {
  if (total === 1) return "Bulletin annuel";
  const prefixes = ["1er", "2e", "3e", "4e", "5e", "6e"];
  const nom = total === 2 ? "semestre" : total === 3 ? "trimestre" : "période";
  return `${prefixes[rang - 1] ?? `${rang}e`} ${nom}`;
}

async function monEcole() {
  const utilisateur = await exiger("direction");
  const [ecole] = await db
    .select()
    .from(etablissements)
    .where(eq(etablissements.directionUserId, utilisateur.id))
    .limit(1);
  return ecole ?? null;
}

/** Le découpage de l'année et l'échelle des moyennes. */
export async function enregistrerParametres(
  _prec: Retour,
  donnees: FormData,
): Promise<Retour> {
  const ecole = await monEcole();
  if (!ecole) return { erreur: "Aucun établissement rattaché à votre compte." };

  const periodicite = Number(donnees.get("periodicite"));
  if (!(periodicite >= 1 && periodicite <= 6)) {
    return { erreur: "Choisissez un découpage d'année valide." };
  }
  const echelle = Number(String(donnees.get("echelle") ?? "").replace(",", "."));
  if (!(echelle >= 1 && echelle <= 100)) {
    return { erreur: "L'échelle des moyennes doit être un nombre entre 1 et 100." };
  }

  await db
    .update(etablissements)
    .set({ periodicite, echelle: echelle.toFixed(1) })
    .where(eq(etablissements.id, ecole.id));

  // Seme les périodes manquantes du découpage, sans rien activer.
  const existantes = await db
    .select({ nom: periodes.nom })
    .from(periodes)
    .where(eq(periodes.etablissementId, ecole.id));
  const noms = new Set(existantes.map((p) => p.nom));
  for (let rang = 1; rang <= periodicite; rang++) {
    const nom = nomPeriode(rang, periodicite);
    if (!noms.has(nom)) {
      await db.insert(periodes).values({
        etablissementId: ecole.id,
        nom,
        debut: "2026-09-15",
        fin: "2027-06-30",
        active: false,
      });
    }
  }

  revalidatePath("/mon-ecole/parametres");
  return { message: "Paramètres enregistrés : les périodes sont prêtes, activez celle qui court." };
}

/** Une seule période active à la fois, toutes années confondues. */
export async function rendrePeriodeActive(donnees: FormData): Promise<void> {
  const ecole = await monEcole();
  if (!ecole) return;
  const periodeId = Number(donnees.get("periodeId"));

  const [cible] = await db
    .select({ id: periodes.id })
    .from(periodes)
    .where(and(eq(periodes.id, periodeId), eq(periodes.etablissementId, ecole.id)))
    .limit(1);
  if (!cible) return;

  const toutes = await db
    .select({ id: periodes.id })
    .from(periodes)
    .where(eq(periodes.etablissementId, ecole.id));
  for (const p of toutes) {
    await db.update(periodes).set({ active: p.id === cible.id }).where(eq(periodes.id, p.id));
  }
  revalidatePath("/mon-ecole/parametres");
}
