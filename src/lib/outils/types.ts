import type { Role } from "@/lib/roles";

/**
 * Le compte qui appelle un outil. Le même objet arrive de la page web,
 * du registre ou du script de contrôle : aucune fonction d'outil ne
 * dépend du serveur web, elles restent exécutables hors requête.
 */
export type CompteOutil = {
  id: number;
  role: Role;
  prenom: string;
  nom: string;
  interets: string;
};

/** Un paramètre d'outil, documenté pour l'écran comme pour le modèle. */
export type ParametreOutil = {
  nom: string;
  description: string;
  type: "texte" | "nombre";
  obligatoire: boolean;
};

export type Outil = {
  nom: string;
  /** La phrase que le coach lit pour choisir l'outil. */
  description: string;
  /** Les places autorisées ; tout le reste reçoit un refus explicite. */
  roles: Role[];
  parametres: ParametreOutil[];
  executer: (
    compte: CompteOutil,
    args: Record<string, string | number | undefined>,
  ) => Promise<unknown>;
};

export type ResultatOutil =
  | { ok: true; donnees: unknown }
  | { ok: false; refus: string };
