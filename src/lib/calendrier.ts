/**
 * Le calendrier des familles : les entrées ne sont pas stockées, elles
 * sont recalculées à chaque lecture depuis le devoirs, les échéances de
 * paiement et les événements posés par la direction. Une échéance
 * couverte disparaît, un paiement annulé la fait revenir.
 */

export type EntreeCalendrier = {
  date: string;
  titre: string;
  /** devoir | echeance | evenement */
  type: "devoir" | "echeance" | "evenement";
  detail: string;
};

export type Mois = {
  annee: number;
  mois: number;
  /** « 2026-10 » */
  cle: string;
  titre: string;
  /** « 2026-09 » */
  precedent: string;
  /** « 2026-11 » */
  suivant: string;
};

const titresMois = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Le mois demandé, borné au format « AAAA-MM » avec ses voisins. */
export function lireMois(parametre: string | undefined): Mois {
  const valide = /^\d{4}-(0[1-9]|1[0-2])$/.test(parametre ?? "");
  const base = valide ? (parametre as string) : new Date().toISOString().slice(0, 7);
  const [anneeTexte, moisTexte] = base.split("-");
  const annee = Number(anneeTexte);
  const mois = Number(moisTexte);

  const moisPrecedent = mois === 1 ? 12 : mois - 1;
  const anneePrecedente = mois === 1 ? annee - 1 : annee;
  const moisSuivant = mois === 12 ? 1 : mois + 1;
  const anneeSuivante = mois === 12 ? annee + 1 : annee;

  return {
    annee,
    mois,
    cle: base,
    titre: `${titresMois[mois - 1]} ${annee}`,
    precedent: `${anneePrecedente}-${String(moisPrecedent).padStart(2, "0")}`,
    suivant: `${anneeSuivante}-${String(moisSuivant).padStart(2, "0")}`,
  };
}

/** Les cases de la grille : semaines du mois, lundi au dimanche. */
export function casesDuMois(mois: Mois): (string | null)[] {
  const premierJour = new Date(mois.annee, mois.mois - 1, 1);
  // JS : dimanche = 0. On veut lundi = 0.
  const decalage = (premierJour.getDay() + 6) % 7;
  const nombreJours = new Date(mois.annee, mois.mois, 0).getDate();

  const cases: (string | null)[] = [];
  for (let i = 0; i < decalage; i += 1) cases.push(null);
  for (let jour = 1; jour <= nombreJours; jour += 1) {
    cases.push(`${mois.cle}-${String(jour).padStart(2, "0")}`);
  }
  while (cases.length % 7 !== 0) cases.push(null);
  return cases;
}

export const libellesTypes: Record<EntreeCalendrier["type"], string> = {
  devoir: "Devoir",
  echeance: "Échéance",
  evenement: "Événement",
};
