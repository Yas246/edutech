import type { Metadata } from "next";
import Link from "next/link";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import FormulaireEspace from "./formulaire";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mon espace" };

export default async function MonEspace() {
  const utilisateur = await exiger();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <EnTetePage
        titre="Mon espace"
        sousTitre="Vos informations à vous, modifiables à tout moment. Votre pseudo est votre identifiant public : il ne change pas."
      />
      <div className="mt-8">
        <FormulaireEspace
          role={utilisateur.role}
          pseudo={utilisateur.pseudo}
          prenom={utilisateur.prenom}
          nom={utilisateur.nom}
          telephone={utilisateur.telephone}
          sexe={utilisateur.sexe}
          interets={utilisateur.interets}
          dateNaissance={utilisateur.dateNaissance ?? ""}
          lieuNaissance={utilisateur.lieuNaissance}
        />
      </div>
      {utilisateur.role === "eleve" && (
        <p className="mt-4 text-sm">
          <Link
            href={`/eleves/${utilisateur.id}/passeport`}
            className="text-vert underline hover:text-vert-fonce"
          >
            Votre passeport scolaire
          </Link>
        </p>
      )}
    </div>
  );
}
