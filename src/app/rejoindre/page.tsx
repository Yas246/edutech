import type { Metadata } from "next";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import FormulaireRejoindre from "./formulaire";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Rejoindre" };

/**
 * Rejoindre par un code. Le lien d'invitation d'une école
 * (/rejoindre?code=VME-XXXX) préremplit le formulaire du collègue.
 */
export default async function Rejoindre({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const utilisateur = await exiger();
  const { code } = await searchParams;
  const codeInitial = (code ?? "").trim().slice(0, 12);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <EnTetePage
        titre="Rejoindre"
        sousTitre="Un code court vaut preuve : celui de l'école pour son équipe, celui de la classe pour ses élèves et leurs parents."
      />
      <div className="mt-8">
        <FormulaireRejoindre role={utilisateur.role} codeInitial={codeInitial} />
      </div>
    </div>
  );
}
