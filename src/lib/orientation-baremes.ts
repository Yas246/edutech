import { normaliserTexte } from "./orientation";

/**
 * Les barèmes officiels du baccalauréat béninois et la grammaire des
 * matières. Module léger (aucun annuaire) : il sert aussi bien aux
 * formulaires du navigateur qu'au moteur côté serveur.
 */

export const BAREMES: Record<string, Record<string, number>> = {
  A1: {
    FRANCAIS: 5, PHILOSOPHIE: 4, "HISTOIRE & GEOGRAPHIE": 3,
    "LANGUE VIVANTE 1": 3, "LANGUE VIVANTE 2": 2, MATHEMATIQUES: 2,
    "SCIENCES DE LA VIE ET DE LA TERRE": 2,
    "EDUCATION PHYSIQUE ET SPORTIVE": 1,
  },
  A2: {
    FRANCAIS: 4, PHILOSOPHIE: 3, "HISTOIRE & GEOGRAPHIE": 5,
    "LANGUE VIVANTE 1": 3, "LANGUE VIVANTE 2": 2, MATHEMATIQUES: 2,
    "SCIENCES DE LA VIE ET DE LA TERRE": 2,
    "EDUCATION PHYSIQUE ET SPORTIVE": 1,
  },
  B: {
    ECONOMIE: 4, FRANCAIS: 4, "HISTOIRE & GEOGRAPHIE": 4,
    "LANGUE VIVANTE 1": 2, MATHEMATIQUES: 2, PHILOSOPHIE: 3,
    "SCIENCES DE LA VIE ET DE LA TERRE": 2,
    "EDUCATION PHYSIQUE ET SPORTIVE": 1,
  },
  C: {
    MATHEMATIQUES: 6, "SCIENCES PHYSIQUES": 5, FRANCAIS: 2, ANGLAIS: 2,
    "SCIENCES DE LA VIE ET DE LA TERRE": 2, "HISTOIRE & GEOGRAPHIE": 2,
    PHILOSOPHIE: 2, "EDUCATION PHYSIQUE ET SPORTIVE": 1,
  },
  D: {
    MATHEMATIQUES: 4, "SCIENCES PHYSIQUES": 4, FRANCAIS: 2, ANGLAIS: 2,
    "SCIENCES DE LA VIE ET DE LA TERRE": 5, "HISTOIRE & GEOGRAPHIE": 2,
    PHILOSOPHIE: 2, "EDUCATION PHYSIQUE ET SPORTIVE": 1,
  },
};

export const SERIES = Object.keys(BAREMES);

const ALIAS: Record<string, string> = {
  SVT: "SCIENCES DE LA VIE ET DE LA TERRE",
  PCT: "SCIENCES PHYSIQUES",
  SPCT: "SCIENCES PHYSIQUES",
  PC: "SCIENCES PHYSIQUES",
  MATHS: "MATHEMATIQUES",
  MATHEMATIQUE: "MATHEMATIQUES",
  ANGLAIS: "LANGUE VIVANTE 1",
  LV1: "LANGUE VIVANTE 1",
  LV2: "LANGUE VIVANTE 2",
  FRANCAIS: "FRANCAIS",
  PHILO: "PHILOSOPHIE",
  PHILOSOPHIE: "PHILOSOPHIE",
  HISTOIREGEOGRAPHIE: "HISTOIRE & GEOGRAPHIE",
  HG: "HISTOIRE & GEOGRAPHIE",
  HISTGEO: "HISTOIRE & GEOGRAPHIE",
  HISTOIREGEO: "HISTOIRE & GEOGRAPHIE",
  ECONOMIE: "ECONOMIE",
  EPS: "EDUCATION PHYSIQUE ET SPORTIVE",
};

const SOUS_CHAINES: [string, string][] = [
  ["SCIENCESDELAVIEETDELATERRE", "SCIENCES DE LA VIE ET DE LA TERRE"],
  ["PHYSIQUECHIMIEETTECHNOLOGIE", "SCIENCES PHYSIQUES"],
  ["PHYSIQUECHIMIE", "SCIENCES PHYSIQUES"],
  ["SCIENCESPHYSIQUES", "SCIENCES PHYSIQUES"],
  ["MATHEMATIQUES", "MATHEMATIQUES"],
  ["LANGUEVIVANTE1", "LANGUE VIVANTE 1"],
  ["LANGUEVIVANTE2", "LANGUE VIVANTE 2"],
  ["HISTOIRE", "HISTOIRE & GEOGRAPHIE"],
  ["GEOGRAPHIE", "HISTOIRE & GEOGRAPHIE"],
  ["PHILOSOPHIE", "PHILOSOPHIE"],
  ["ECONOMIE", "ECONOMIE"],
  ["EDUCATIONPHYSIQUE", "EDUCATION PHYSIQUE ET SPORTIVE"],
  ["FRANCAIS", "FRANCAIS"],
  ["ANGLAIS", "LANGUE VIVANTE 1"],
];

/** Majuscules sans accents, sans ponctuation : la comparaison des matières. */
export function normMatiere(s: string): string {
  return normaliserTexte(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Le nom canonique d'une matière, quel que soit son écriture. */
export function canon(matiere: string): string | null {
  const n = normMatiere(matiere ?? "");
  if (!n) return null;
  if (ALIAS[n]) return ALIAS[n];
  for (const [cle, cible] of SOUS_CHAINES) {
    if (cle.includes(n) || n.includes(cle)) return cible;
  }
  return null;
}

const TOUTES_SERIES = new Set([
  "A", "A1", "A2", "B", "C", "D", "E", "EA", "DEAT",
  "F1", "F2", "F3", "F4", "G1", "G2", "G3",
]);

/** « A1, A2 et B, C, D » → {A1, A2, B, C, D} ; vide → aucune restriction. */
export function parseSeries(champ: string): Set<string> {
  if (!champ?.trim()) return new Set();
  const morceaux = champ.toUpperCase().split(/[,/;()]|\bET\b/);
  const trouves = new Set<string>();
  for (const t of morceaux) {
    for (const m of t.match(/A1|A2|DEAT|EA|[A-G][1-4]?/g) ?? []) {
      if (TOUTES_SERIES.has(m)) trouves.add(m);
    }
  }
  return trouves;
}

export function mentionDepuisMoyenne(m: number | null): string {
  if (m === null) return "";
  if (m >= 16) return "Très bien";
  if (m >= 14) return "Bien";
  if (m >= 12) return "Assez bien";
  if (m >= 10) return "Passable";
  return "";
}
