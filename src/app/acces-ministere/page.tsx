import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui/en-tete";
import FormulaireAccesMinistere from "./formulaire";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Accès ministère" };

/**
 * La porte ministérielle. Elle n'est pas dans la liste publique des
 * inscriptions : un code d'accès remis par la plateforme vaut preuve
 * de l'institution.
 */
export default function PageAccesMinistere() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <EnTetePage
        titre="Accès ministère"
        sousTitre="Cette entrée est réservée aux institutions : elle ouvre la lecture de la nation entière. Un code d'accès à usage unique est requis."
      />
      <div className="mt-8 rounded-2xl border border-ligne bg-white p-6">
        <FormulaireAccesMinistere />
      </div>
    </div>
  );
}
