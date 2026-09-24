import alibori from "@/../data/recensement/etablissements_alibori.json";
import atacora from "@/../data/recensement/etablissements_atacora.json";
import atlantique from "@/../data/recensement/etablissements_atlantique.json";
import borgou from "@/../data/recensement/etablissements_borgou.json";
import collines from "@/../data/recensement/etablissements_collines.json";
import couffo from "@/../data/recensement/etablissements_couffo.json";
import donga from "@/../data/recensement/etablissements_donga.json";
import littoral from "@/../data/recensement/etablissements_littoral.json";
import mono from "@/../data/recensement/etablissements_mono.json";
import oueme from "@/../data/recensement/etablissements_oueme.json";
import plateau from "@/../data/recensement/etablissements_plateau.json";
import superieur from "@/../data/recensement/etablissements_superieur.json";
import zou from "@/../data/recensement/etablissements_zou.json";

export type EtablissementRecense = {
  nom: string;
  sigle: string;
  type: string;
  cycles: string[];
  statut: string;
  commune: string;
  departement: string;
  quartier: string;
  etat: string;
  derniere_preuve: string;
  adresse: string;
  telephone: string;
  email: string;
  alias: string[];
  sources: string[];
};

const fichiers = [
  alibori,
  atacora,
  atlantique,
  borgou,
  collines,
  couffo,
  donga,
  littoral,
  mono,
  oueme,
  plateau,
  superieur,
  zou,
] as { meta: { departement: string }; etablissements: EtablissementRecense[] }[];

/** Les 365 établissements du recensement, tous départements confondus. */
export const recensement: EtablissementRecense[] = fichiers.flatMap(
  (f) => f.etablissements,
);

export const nombreEtablissements = recensement.length;

export const departements = [...new Set(recensement.map((e) => e.departement))].sort(
  (a, b) => a.localeCompare(b, "fr"),
);

export const nombreDepartements = departements.length;

export const nombreCommunes = new Set(recensement.map((e) => e.commune)).size;

/** Libellé français lisible d'un type de recensement. */
export const libelleType: Record<string, string> = {
  ceg: "CEG",
  college_prive: "Collège privé",
  college_technique: "Collège technique",
  lycee: "Lycée",
  lycee_technique: "Lycée technique",
  superieur: "Enseignement supérieur",
  autre: "Autre",
};
