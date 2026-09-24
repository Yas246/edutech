import { libellesRole } from "@/lib/roles";
import { outilsDirection } from "./direction";
import { outilsEnseignant } from "./enseignant";
import { outilsFamille } from "./famille";
import { outilsMinistere } from "./ministere";
import type { CompteOutil, Outil, ParametreOutil, ResultatOutil } from "./types";

/**
 * Le registre unique des outils : les pages du ministère, de la
 * direction, les écrans de famille et le coach passent TOUS par ces
 * mêmes fonctions. Un seul chemin de calcul, jamais deux.
 */
export const outils: Outil[] = [
  ...outilsMinistere,
  ...outilsDirection,
  ...outilsEnseignant,
  ...outilsFamille,
];

export function outilParNom(nom: string): Outil | undefined {
  return outils.find((o) => o.nom === nom);
}

/**
 * L'exécution contrôlée : le rôle est vérifié ici, une fois pour tous.
 * Tout ce qui n'est pas autorisé reçoit un refus explicite, jamais un
 * résultat partiel.
 */
export async function executerOutil(
  nom: string,
  compte: CompteOutil,
  args: Record<string, string | number | undefined> = {},
): Promise<ResultatOutil> {
  const outil = outilParNom(nom);
  if (!outil) return { ok: false, refus: `Outil inconnu : ${nom}.` };
  if (!outil.roles.includes(compte.role)) {
    const pour = outil.roles.map((r) => libellesRole[r] ?? r).join(" ou ");
    return { ok: false, refus: `Cet accès est réservé : ${pour} seulement.` };
  }
  for (const p of outil.parametres) {
    if (p.obligatoire && (args[p.nom] === undefined || args[p.nom] === "")) {
      return { ok: false, refus: `Le paramètre « ${p.nom} » est nécessaire : ${p.description}` };
    }
  }
  try {
    const donnees = await outil.executer(compte, args);
    return { ok: true, donnees };
  } catch {
    return { ok: false, refus: "La donnée demandée est momentanément indisponible." };
  }
}

/**
 * La description des outils au format du fournisseur de modèle : le
 * coach déclare ce qu'il peut consulter, rien de plus.
 */
export function outilsPourModele() {
  return outils.map((o) => ({
    type: "function" as const,
    function: {
      name: o.nom,
      description: o.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          o.parametres.map((p) => [
            p.nom,
            {
              type: p.type === "nombre" ? "number" : "string",
              description: p.description,
            },
          ]),
        ),
        required: o.parametres.filter((p) => p.obligatoire).map((p) => p.nom),
      },
    },
  }));
}

export type { CompteOutil, Outil, ParametreOutil, ResultatOutil };
