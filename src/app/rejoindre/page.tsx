import type { Metadata } from "next";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import FormulaireRejoindre from "./formulaire";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Rejoindre" };

export default async function Rejoindre() {
  const utilisateur = await exiger();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <EnTetePage
        titre="Rejoindre"
        sousTitre="Un code court vaut preuve : celui de l'école pour son équipe, celui de la classe pour ses élèves."
      />
      <div className="mt-8">
        <FormulaireRejoindre role={utilisateur.role} />
      </div>
    </div>
  );
}
