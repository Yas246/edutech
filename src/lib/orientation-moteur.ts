import annuaireJson from "../data/annuaire.json";
import villesJson from "../data/villes.json";
import { FAMILLES, normaliserTexte } from "./orientation";
import { BAREMES, canon, parseSeries } from "./orientation-baremes";

/**
 * Le moteur d'orientation, entièrement déterministe, porté du module
 * d'orientation : éligibilité par série, moyenne de classement sur les
 * matières de chaque fiche du guide officiel, affinité avec les centres
 * d'intérêt, et les raisons de chaque recommandation — tout est
 * vérifiable par l'élève. Les barèmes vivent dans orientation-baremes.
 */

export { BAREMES, canon, parseSeries };

export type Fiche = {
  institution: string;
  partie: string;
  no: string;
  etablissement: string;
  filiere: string;
  quota_bourse: string;
  quota_aide: string;
  mode_entree: string;
  bac: string;
  matieres: string;
  debouches: string;
  page: number;
};

export const ANNUAIRE = annuaireJson as Fiche[];

/** Le guide sépare les sections numérotées (public) des listes (privé). */
export function statutDe(fiche: Fiche): "public" | "prive" | null {
  const p = (fiche.partie ?? "").trim();
  if (/^LISTE/i.test(p)) return "prive";
  if (/^[IVX]+/.test(p)) return "public";
  return null;
}

/** Les matières de classement canoniques d'une fiche. */
export function matieresFiche(fiche: Fiche): string[] {
  return (fiche.matieres ?? "")
    .split(/[•\-;]/)
    .map((n) => canon(n))
    .filter((n): n is string => Boolean(n));
}

/**
 * La moyenne officielle de classement M : moyenne pondérée du candidat
 * sur les matières de la fiche, coefficients du barème de SA série.
 * Incomplète → null : on n'invente pas.
 */
export function moyenneClassement(
  profil: { serie: string; notes: Record<string, number> },
  fiche: Fiche,
): number | null {
  const bareme = BAREMES[profil.serie] ?? {};
  let num = 0;
  let den = 0;
  for (const m of matieresFiche(fiche)) {
    const note = profil.notes[m];
    const coeff = bareme[m];
    if (note === undefined || !coeff) return null;
    num += note * coeff;
    den += coeff;
  }
  return den ? Number((num / den).toFixed(2)) : null;
}

/* ---------------------------- localisation ---------------------------- */

type RegleVille = { cle: string; ville?: string; villes?: string[]; pays?: string; confiance: string };
const VILLES = villesJson as unknown as {
  exceptions_etablissement: RegleVille[];
  institutions: RegleVille[];
  villes_detectables_dans_le_nom: string[];
};

function nres(s: string): string {
  return ` ${normaliserTexte(s ?? "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** La ville d'une fiche : jamais devinée, sinon « absent ». */
export function villeDe(fiche: Fiche): {
  ville: string | null; villes: string[] | null; pays: string | null; confiance: string;
} {
  const etab = nres(fiche.etablissement);
  const inst = nres(fiche.institution);
  for (const regle of VILLES.exceptions_etablissement) {
    if (nres(regle.cle) !== " " && etab.includes(nres(regle.cle))) {
      return { ville: regle.ville ?? null, villes: regle.villes ?? null, pays: regle.pays ?? null, confiance: regle.confiance };
    }
  }
  for (const v of VILLES.villes_detectables_dans_le_nom) {
    if (etab.includes(nres(v)) || inst.includes(nres(v))) {
      return { ville: v, villes: null, pays: null, confiance: "verifie" };
    }
  }
  for (const regle of VILLES.institutions) {
    if (nres(regle.cle) !== " " && inst.includes(nres(regle.cle))) {
      return { ville: regle.ville ?? null, villes: regle.villes ?? null, pays: regle.pays ?? null, confiance: regle.confiance };
    }
  }
  return { ville: null, villes: null, pays: null, confiance: "absent" };
}

/* ------------------------------ affinité ------------------------------ */

/** Le nombre de mots d'intérêt de la famille présents dans la fiche. */
function scoreAffinite(fiche: Fiche, familles: string[]): number {
  const texte = normaliserTexte(`${fiche.filiere} ${fiche.debouches}`);
  let touches = 0;
  for (const nomFamille of familles) {
    const famille = FAMILLES.find((f) => f.famille === nomFamille);
    if (!famille) continue;
    for (const mot of famille.motsCles) {
      if (texte.includes(normaliserTexte(mot))) touches += 1;
    }
  }
  return touches;
}

/* --------------------------- recommandations -------------------------- */

export type Recommandation = {
  filiere: string;
  etablissement: string;
  institution: string;
  ville: string | null;
  pays: string | null;
  confianceVille: string;
  moyenneClassement: number | null;
  classementIncomplet: boolean;
  affinite: number;
  quota: string;
  modeEntree: string;
  raisons: string[];
};

/**
 * Les filières conseillées : éligibles par série, classées par la
 * moyenne officielle (ou par l'affinité), chacune avec ses raisons.
 */
export function recommander(
  profil: { serie: string; notes: Record<string, number> },
  familles: string[],
  options: { tri?: "classement" | "gouts"; top?: number } = {},
): Recommandation[] {
  const tri = options.tri ?? "classement";
  const top = options.top ?? 10;
  const eligibles: (Recommandation & { _aff: number })[] = [];

  for (const fiche of ANNUAIRE) {
    const statut = statutDe(fiche);
    let series: Set<string>;
    if (!(fiche.bac ?? "").trim()) {
      if (statut !== "prive") continue; // trou d'extraction : on n'improvise pas
      series = new Set();               // privé : admission par dossier
    } else {
      series = parseSeries(fiche.bac);
    }
    if (series.size > 0 && !series.has(profil.serie)) continue;

    const M = moyenneClassement(profil, fiche);
    const aff = scoreAffinite(fiche, familles);
    const localisation = villeDe(fiche);
    const raisons: string[] = [];
    if (series.size === 0) {
      raisons.push("séries non précisées par le guide : inscription auprès de l'établissement");
    } else {
      raisons.push(`votre série (${profil.serie}) est acceptée`);
    }
    if (aff > 0) {
      raisons.push(`correspond à vos centres d'intérêt (${aff} mot(s) lié(s))`);
    }
    const quota = (fiche.quota_bourse ?? "").replace(/\D/g, "") || "0";
    if (quota !== "0") raisons.push(`quota de bourse : ${quota}`);
    if (M === null && series.size > 0) {
      raisons.push("classement incomplet : une matière de la fiche n'est pas notée sur votre relevé");
    }

    eligibles.push({
      filiere: fiche.filiere,
      etablissement: fiche.etablissement,
      institution: fiche.institution,
      ville: localisation.ville,
      pays: localisation.pays,
      confianceVille: localisation.confiance,
      moyenneClassement: M,
      classementIncomplet: M === null,
      affinite: aff,
      quota,
      modeEntree: fiche.mode_entree,
      raisons,
      _aff: aff,
    });
  }

  const triees = eligibles.sort((a, b) => {
    const sansA = a.moyenneClassement === null ? 1 : 0;
    const sansB = b.moyenneClassement === null ? 1 : 0;
    if (tri === "gouts") {
      return (
        b.affinite - a.affinite ||
        sansA - sansB ||
        (b.moyenneClassement ?? 0) - (a.moyenneClassement ?? 0)
      );
    }
    return (
      sansA - sansB ||
      (b.moyenneClassement ?? 0) - (a.moyenneClassement ?? 0) ||
      b.affinite - a.affinite
    );
  });

  // Au plus trois filières par établissement : la diversité avant l'effet de masse.
  const parEtablissement = new Map<string, number>();
  const diversifiees: Recommandation[] = [];
  for (const c of triees) {
    const vu = parEtablissement.get(c.etablissement) ?? 0;
    if (vu >= 3) continue;
    parEtablissement.set(c.etablissement, vu + 1);
    diversifiees.push(c);
    if (diversifiees.length >= top) break;
  }
  return diversifiees;
}

/* ---------------------- profil canonique et contrôle ------------------- */

export type MatiereProfil = { note: number | null; points: number | null; coeff: number | null };

export type ProfilCanonique = {
  serie: string;
  nom: string;
  numTable: string;
  moyenne: number | null;
  mention: string;
  decision: string;
  matieres: Record<string, MatiereProfil>;
};

export function mentionDepuisMoyenne(m: number | null): string {
  if (m === null) return "";
  if (m >= 16) return "Très bien";
  if (m >= 14) return "Bien";
  if (m >= 12) return "Assez bien";
  if (m >= 10) return "Passable";
  return "";
}

/** Le libellé brut du relevé, si le barème de la série le porte tel quel. */
function normBrutDansBareme(nom: string, bareme: Record<string, number>): string | null {
  const n = normaliserTexte(nom ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return n && (n in bareme) ? n : null;
}

/**
 * La recomposition du profil : matières ancrées sur le barème de la
 * série, coefficient officiel partout, note réparée par la règle
 * points ÷ coefficient quand la note manque, moyenne et mention
 * RECALCULÉES ici. Les incohérences remontent en clair.
 */
export function composerProfil(entree: {
  serie: string;
  nom?: string;
  numTable?: string;
  moyenneAnnoncee?: number | null;
  decision?: string;
  matieres: Record<string, { note?: number | null; points?: number | null }>;
}): { profil: ProfilCanonique; controle: { champ: string; probleme: string }[] } {
  const controle: { champ: string; probleme: string }[] = [];
  const serie = BAREMES[entree.serie] ? entree.serie : "";
  const bareme = BAREMES[serie] ?? {};
  const matieres: Record<string, MatiereProfil> = {};

  for (const [nomBrut, valeurs] of Object.entries(entree.matieres)) {
    // Certaines séries nomment la matière autrement que le canon
    // (« ANGLAIS » en C, « LANGUE VIVANTE 1 » en D) : le libellé brut
    // du relevé passe après le canon.
    const cle =
      (canon(nomBrut) ?? "") in bareme
        ? canon(nomBrut)!
        : normBrutDansBareme(nomBrut, bareme);
    if (!cle) continue; // hors barème : ignorée, pas devinée
    let note = valeurs.note ?? null;
    const points = valeurs.points ?? null;
    if (note === null && points !== null && bareme[cle]) {
      note = Number((points / bareme[cle]).toFixed(2)); // la règle du barème officiel
    }
    if (note !== null && !(note >= 0 && note <= 20)) {
      controle.push({ champ: `note ${cle}`, probleme: `note impossible : ${note}` });
      note = null;
    }
    if (note !== null && points !== null && Math.abs(note * bareme[cle] - points) > 0.5) {
      controle.push({
        champ: `points ${cle}`,
        probleme: `${points} annoncés, ${Number((note * bareme[cle]).toFixed(1))} recalculés (${note} × ${bareme[cle]})`,
      });
    }
    matieres[cle] = { note, points, coeff: bareme[cle] };
  }

  // Les matières du barème non lues restent présentes, vides.
  for (const cle of Object.keys(bareme)) {
    if (!matieres[cle]) matieres[cle] = { note: null, points: null, coeff: bareme[cle] };
  }

  let sommePoints = 0;
  let sommeCoeff = 0;
  for (const m of Object.values(matieres)) {
    if (m.note !== null && m.coeff) {
      sommePoints += m.note * m.coeff;
      sommeCoeff += m.coeff;
    }
  }
  const moyenne = sommeCoeff ? Number((sommePoints / sommeCoeff).toFixed(2)) : null;
  if (
    entree.moyenneAnnoncee !== null &&
    entree.moyenneAnnoncee !== undefined &&
    moyenne !== null &&
    Math.abs(entree.moyenneAnnoncee - moyenne) > 0.5
  ) {
    controle.push({
      champ: "moyenne",
      probleme: `affichée ${entree.moyenneAnnoncee} sur le relevé, recalculée ${moyenne}`,
    });
  }

  return {
    profil: {
      serie,
      nom: entree.nom ?? "",
      numTable: entree.numTable ?? "",
      moyenne,
      mention: mentionDepuisMoyenne(moyenne),
      decision: entree.decision ?? "",
      matieres,
    },
    controle,
  };
}
