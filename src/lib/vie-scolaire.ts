/** Les jours ouvrables de l'emploi du temps. */
export const jours = [
  { valeur: 1, titre: "Lundi" },
  { valeur: 2, titre: "Mardi" },
  { valeur: 3, titre: "Mercredi" },
  { valeur: 4, titre: "Jeudi" },
  { valeur: 5, titre: "Vendredi" },
  { valeur: 6, titre: "Samedi" },
];

export function libelleJour(jour: number) {
  return jours.find((j) => j.valeur === jour)?.titre ?? "Jour " + jour;
}

export function libelleHeure(h: string) {
  return h;
}

/**
 * Deux créneaux se chevauchent si leurs intervalles se coupent sur la
 * même journée (comparaison lexicographique de « HH:MM »).
 */
export function seChevauchent(
  a: { heureDebut: string; heureFin: string },
  b: { heureDebut: string; heureFin: string },
) {
  return !(a.heureFin <= b.heureDebut || a.heureDebut >= b.heureFin);
}

export const estHeureValide = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
