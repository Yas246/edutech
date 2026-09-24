/** Les cinq places sur la plateforme, avec leur libellé français. */
export type Role = "ministere" | "direction" | "enseignant" | "parent" | "eleve";

export const roles: { valeur: Role; titre: string; texte: string }[] = [
  {
    valeur: "eleve",
    titre: "Élève",
    texte: "Suivre mes notes, mes absences et mon orientation.",
  },
  {
    valeur: "parent",
    titre: "Parent",
    texte: "Suivre mes enfants : résultats, présences, échéances.",
  },
  {
    valeur: "enseignant",
    titre: "Enseignant",
    texte: "Faire l'appel, saisir les notes de mes matières.",
  },
  {
    valeur: "direction",
    titre: "Direction d'établissement",
    texte: "Gérer les classes, les bulletins, la scolarité.",
  },
  {
    valeur: "ministere",
    titre: "Ministère",
    texte: "Valider les établissements et lire la nation.",
  },
];

export const libellesRole: Record<string, string> = Object.fromEntries(
  roles.map((r) => [r.valeur, r.titre]),
);
