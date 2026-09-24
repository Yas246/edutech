import type { Role } from "@/lib/roles";

/**
 * La navigation de la barre latérale : des groupes posés par rôle, du
 * plus personnel au plus collectif. Les icônes sont des clés, traduites
 * en composants côté rendu.
 */
export type IconeNav =
  | "tableau"
  | "etablissements"
  | "fil"
  | "messagerie"
  | "notifications"
  | "coach"
  | "calendrier"
  | "ecole"
  | "finances"
  | "assiduite"
  | "transferts"
  | "salles"
  | "agenda"
  | "delegations"
  | "ministere"
  | "indicateurs"
  | "apprenants"
  | "orientation"
  | "transport"
  | "enfants";

export type LienNav = { href: string; titre: string; icone: IconeNav };
export type GroupeNav = { titre: string | null; liens: LienNav[] };

/** Le lien actif : le plus long préfixe qui correspond au chemin courant. */
export function lienActif(chemin: string, liens: LienNav[]): LienNav | null {
  let actif: LienNav | null = null;
  for (const lien of liens) {
    const correspond =
      chemin === lien.href ||
      (lien.href !== "/" && chemin.startsWith(`${lien.href}/`));
    if (correspond && (actif === null || lien.href.length > actif.href.length)) {
      actif = lien;
    }
  }
  return actif;
}

/** La navigation publique, hors connexion. */
export function navigationPublique(): GroupeNav[] {
  return [
    {
      titre: null,
      liens: [
        { href: "/", titre: "Accueil", icone: "tableau" },
        { href: "/etablissements", titre: "Établissements", icone: "etablissements" },
      ],
    },
  ];
}

/** La navigation d'un compte, selon sa place. */
export function navigationPour(role: Role): GroupeNav[] {
  const groupes: GroupeNav[] = [
    { titre: null, liens: [{ href: "/tableau-de-bord", titre: "Tableau de bord", icone: "tableau" }] },
  ];

  if (role === "direction") {
    groupes.push({
      titre: "Mon école",
      liens: [
        { href: "/mon-ecole", titre: "Vue d'ensemble", icone: "ecole" },
        { href: "/finances", titre: "Finances", icone: "finances" },
        { href: "/mon-ecole/assiduite", titre: "Assiduité", icone: "assiduite" },
        { href: "/mon-ecole/transferts", titre: "Transferts", icone: "transferts" },
        { href: "/mon-ecole/salles", titre: "Salles", icone: "salles" },
        { href: "/mon-ecole/agenda", titre: "Agenda", icone: "agenda" },
        { href: "/delegations", titre: "Délégations", icone: "delegations" },
      ],
    });
  }
  if (role === "ministere") {
    groupes.push({
      titre: "Espace ministère",
      liens: [
        { href: "/ministere", titre: "Vue d'ensemble", icone: "ministere" },
        { href: "/ministere/indicateurs", titre: "Indicateurs", icone: "indicateurs" },
        { href: "/ministere/apprenants", titre: "Apprenants", icone: "apprenants" },
      ],
    });
  }
  if (role === "eleve") {
    groupes.push({
      titre: "Mes études",
      liens: [
        { href: "/orientation", titre: "Mon orientation", icone: "orientation" },
        { href: "/calendrier", titre: "Calendrier", icone: "calendrier" },
        { href: "/transport", titre: "Transport", icone: "transport" },
      ],
    });
  }
  if (role === "parent") {
    groupes.push({
      titre: "Ma famille",
      liens: [
        { href: "/mes-enfants", titre: "Mes enfants", icone: "enfants" },
        { href: "/mes-finances", titre: "Mes finances", icone: "finances" },
        { href: "/calendrier", titre: "Calendrier", icone: "calendrier" },
        { href: "/transport", titre: "Transport", icone: "transport" },
      ],
    });
  }

  const communaute: LienNav[] = [
    { href: "/fil", titre: "Fil", icone: "fil" },
  ];
  if (role !== "ministere") {
    communaute.push({ href: "/messagerie", titre: "Messagerie", icone: "messagerie" });
  }
  communaute.push({ href: "/notifications", titre: "Notifications", icone: "notifications" });
  groupes.push({ titre: "Communauté", liens: communaute });

  groupes.push({
    titre: null,
    liens: [{ href: "/coach", titre: "Coach", icone: "coach" }],
  });

  return groupes;
}
