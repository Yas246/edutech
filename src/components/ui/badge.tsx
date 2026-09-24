import type { EtatFacture } from "@/lib/finances";

const tons = {
  vert: "bg-vert-clair text-vert-fonce",
  jaune: "bg-jaune-clair text-encre",
  rouge: "bg-rouge-clair text-rouge",
  gris: "bg-papier text-encre-doux",
} as const;

export function Badge({
  ton = "gris",
  children,
}: {
  ton?: keyof typeof tons;
  children: React.ReactNode;
}) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${tons[ton]}`}>
      {children}
    </span>
  );
}

export const libellesEtatFacture: Record<EtatFacture, string> = {
  a_payer: "À payer",
  partiellement_paye: "Partiellement payé",
  paye: "Payé",
  en_retard: "En retard",
  annule: "Annulée",
};

const tonsEtatFacture: Record<EtatFacture, keyof typeof tons> = {
  a_payer: "gris",
  partiellement_paye: "jaune",
  paye: "vert",
  en_retard: "rouge",
  annule: "gris",
};

/** L'état d'une facture, avec sa couleur réservée. */
export function BadgeEtatFacture({ etat }: { etat: EtatFacture }) {
  return <Badge ton={tonsEtatFacture[etat]}>{libellesEtatFacture[etat]}</Badge>;
}
