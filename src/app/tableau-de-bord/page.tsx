import type { Metadata } from "next";
import { exiger, nomComplet } from "@/lib/auth";
import { libellesRole } from "@/lib/roles";
import { seDeconnecter } from "@/app/deconnexion";

export const metadata: Metadata = { title: "Mon espace" };

export default async function TableauDeBord() {
  const utilisateur = await exiger();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold tracking-tight">
        Bienvenue, {nomComplet(utilisateur)}
      </h1>
      <p className="mt-2 text-encre-doux">
        Votre espace en tant que {libellesRole[utilisateur.role] ?? utilisateur.role}.
        Les modules de votre place arrivent au fil de la construction de la plateforme.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-ligne bg-white p-6">
        <div className="flex-1">
          <p className="text-sm text-encre-doux">Connecté avec</p>
          <p className="font-semibold">{utilisateur.email}</p>
        </div>
        <form action={seDeconnecter}>
          <button
            type="submit"
            className="rounded-xl border border-ligne px-4 py-2 text-sm font-medium hover:bg-papier"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
