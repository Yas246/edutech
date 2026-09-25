import { and, eq } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { tentativesCode } from "@/db/schema";

/**
 * Les codes courts qui prouvent les liens entre comptes, à la manière
 * du module d'origine : 4 caractères sans ambiguïté (pas de 0/O,
 * 1/I/L), un préfixe qui dit le contexte, un seul code actif par
 * porteur — le régénérer tue l'ancien.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 10 saisies erronées de code par jour et par compte, pas plus. */
export const TENTATIVES_MAX = 10;

/** Un code libre dans la table donnée (50 essais : collision improbable). */
export async function genererCode(
  prefixe: string,
  existe: (code: string) => Promise<boolean>,
): Promise<string> {
  for (let essai = 0; essai < 50; essai++) {
    let code = prefixe;
    for (let i = 0; i < 4; i++) {
      code += ALPHABET[randomInt(ALPHABET.length)];
    }
    if (!(await existe(code))) return code;
  }
  throw new Error("Impossible de générer un code libre.");
}

/** Le compteur du jour du compte, créé à la première erreur. */
async function ligneDuJour(userId: number) {
  const jour = new Date().toISOString().slice(0, 10);
  const [ligne] = await db
    .select()
    .from(tentativesCode)
    .where(and(eq(tentativesCode.userId, userId), eq(tentativesCode.jour, jour)))
    .limit(1);
  return ligne ?? null;
}

/** Faux quand le compte a épuisé ses essais erronés du jour. */
export async function saisieAutorisee(userId: number): Promise<boolean> {
  const ligne = await ligneDuJour(userId);
  return (ligne?.n ?? 0) < TENTATIVES_MAX;
}

/** Compte une saisie erronée. */
export async function compterEchec(userId: number): Promise<void> {
  const ligne = await ligneDuJour(userId);
  if (ligne) {
    await db
      .update(tentativesCode)
      .set({ n: ligne.n + 1 })
      .where(eq(tentativesCode.id, ligne.id));
    return;
  }
  await db.insert(tentativesCode).values({
    userId,
    jour: new Date().toISOString().slice(0, 10),
    n: 1,
  });
}

/** Une réussite remet le compteur du compte à zéro. */
export async function remettreCompteur(userId: number): Promise<void> {
  await db.delete(tentativesCode).where(eq(tentativesCode.userId, userId));
}

/** Le pseudo de base d'un compte : prenom.nom, sans accents ni signes. */
export function pseudoDeBase(prenom: string, nom: string): string {
  const propre = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
  return `${propre(prenom)}.${propre(nom)}`;
}

/** Un pseudo libre : prenom.nom, puis suffixé 2, 3… en cas d'homonymie. */
export async function genererPseudo(
  prenom: string,
  nom: string,
  pris: (pseudo: string) => Promise<boolean>,
): Promise<string> {
  const base = pseudoDeBase(prenom, nom);
  if (!base.replace(".", "")) return `compte.${Date.now().toString(36)}`;
  if (!(await pris(base))) return base;
  for (let n = 2; n < 100; n++) {
    const candidat = `${base}${n}`;
    if (!(await pris(candidat))) return candidat;
  }
  throw new Error("Impossible de générer un pseudo libre.");
}
