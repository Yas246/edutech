"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { codesEleve, declarationsEnfant, liensFamille } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { compterEchec, genererCode, remettreCompteur, saisieAutorisee } from "@/lib/codes";
import type { Retour } from "@/components/ui/alerte";

const RELATIONS = ["pere", "mere", "tuteur"];

/**
 * La déclaration d'un enfant : elle porte son code famille. Le suivi
 * reste fermé tant que le code personnel de l'élève n'a pas croisé.
 */
export async function declarerEnfant(_prec: Retour, donnees: FormData): Promise<Retour> {
  const parent = await exiger("parent");
  const prenom = String(donnees.get("prenom") ?? "").trim();
  const nom = String(donnees.get("nom") ?? "").trim();
  const relation = String(donnees.get("relation") ?? "");
  if (!prenom || !nom) return { erreur: "Indiquez le prénom et le nom de l'enfant." };
  if (!RELATIONS.includes(relation)) return { erreur: "Précisez votre lien de parenté." };

  const code = await genererCode("VMF-", async (c) =>
    Boolean(
      await db
        .select({ id: declarationsEnfant.id })
        .from(declarationsEnfant)
        .where(eq(declarationsEnfant.codeFamille, c))
        .limit(1)
        .then((r) => r.length),
    ),
  );

  await db.insert(declarationsEnfant).values({
    parentUserId: parent.id,
    prenom,
    nom,
    relation,
    codeFamille: code,
  });
  revalidatePath("/mes-enfants");
  return {
    message: `Déclaration enregistrée. Donnez le code ${code} à ${prenom} : il le saisit dans « Mon code » pour ouvrir votre suivi.`,
  };
}

/**
 * Le croisement côté parent : le code personnel de l'élève (VMP)
 * prouve que l'enfant accepte. Dix erreurs par jour, pas plus.
 */
export async function croiserCode(_prec: Retour, donnees: FormData): Promise<Retour> {
  const parent = await exiger("parent");
  const declarationId = Number(donnees.get("declarationId"));
  const brut = String(donnees.get("code") ?? "").trim().toUpperCase();
  if (!(await saisieAutorisee(parent.id))) {
    return { erreur: "Trop d'essais erronés aujourd'hui : réessayez demain." };
  }

  const [declaration] = await db
    .select()
    .from(declarationsEnfant)
    .where(
      and(
        eq(declarationsEnfant.id, declarationId),
        eq(declarationsEnfant.parentUserId, parent.id),
      ),
    )
    .limit(1);
  if (!declaration) return { erreur: "Déclaration introuvable." };
  if (declaration.eleveUserId) return { erreur: "Cette déclaration est déjà reliée." };

  const [entree] = await db
    .select({ eleveUserId: codesEleve.eleveUserId })
    .from(codesEleve)
    .where(eq(codesEleve.code, brut))
    .limit(1);
  if (!entree) {
    await compterEchec(parent.id);
    return { erreur: "Code inconnu : reprenez-le dans l'espace de votre enfant." };
  }

  const [dejaLie] = await db
    .select({ id: liensFamille.id })
    .from(liensFamille)
    .where(
      and(
        eq(liensFamille.parentUserId, parent.id),
        eq(liensFamille.eleveUserId, entree.eleveUserId),
      ),
    )
    .limit(1);

  await db
    .update(declarationsEnfant)
    .set({ eleveUserId: entree.eleveUserId })
    .where(eq(declarationsEnfant.id, declaration.id));
  if (!dejaLie) {
    await db
      .insert(liensFamille)
      .values({ parentUserId: parent.id, eleveUserId: entree.eleveUserId })
      .onConflictDoNothing();
  }
  await remettreCompteur(parent.id);
  revalidatePath("/mes-enfants");
  return { message: "Le suivi de votre enfant est maintenant ouvert." };
}

/** Un nouveau code famille pour la déclaration : l'ancien ne marche plus. */
export async function regenererCodeFamille(donnees: FormData): Promise<void> {
  const parent = await exiger("parent");
  const declarationId = Number(donnees.get("declarationId"));
  const [declaration] = await db
    .select({ id: declarationsEnfant.id, eleveUserId: declarationsEnfant.eleveUserId })
    .from(declarationsEnfant)
    .where(
      and(
        eq(declarationsEnfant.id, declarationId),
        eq(declarationsEnfant.parentUserId, parent.id),
      ),
    )
    .limit(1);
  if (!declaration || declaration.eleveUserId) return;

  const code = await genererCode("VMF-", async (c) =>
    Boolean(
      await db
        .select({ id: declarationsEnfant.id })
        .from(declarationsEnfant)
        .where(eq(declarationsEnfant.codeFamille, c))
        .limit(1)
        .then((r) => r.length),
    ),
  );
  await db
    .update(declarationsEnfant)
    .set({ codeFamille: code })
    .where(eq(declarationsEnfant.id, declaration.id));
  revalidatePath("/mes-enfants");
}

/** Retire une déclaration sans compte relié (rien à préserver). */
export async function retirerDeclaration(donnees: FormData): Promise<void> {
  const parent = await exiger("parent");
  const declarationId = Number(donnees.get("declarationId"));
  await db
    .delete(declarationsEnfant)
    .where(
      and(
        eq(declarationsEnfant.id, declarationId),
        eq(declarationsEnfant.parentUserId, parent.id),
      ),
    );
  revalidatePath("/mes-enfants");
}

/** Adaptations au formulaire HTML natif (l'état passe par la page). */
export async function declarerEnfantFormulaire(donnees: FormData): Promise<void> {
  await declarerEnfant({}, donnees);
}

export async function croiserCodeFormulaire(donnees: FormData): Promise<void> {
  await croiserCode({}, donnees);
}
