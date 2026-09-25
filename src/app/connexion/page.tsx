import type { Metadata } from "next";
import Link from "next/link";
import FormulaireConnexion from "./formulaire";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <h1 className="text-3xl font-bold tracking-tight">Connexion</h1>
      <p className="mt-2 text-encre-doux">
        Retrouvez votre espace : notes, bulletins, finances et transport.
      </p>
      <div className="mt-6 rounded-2xl border border-ligne bg-white p-6">
        <FormulaireConnexion />
      </div>

      {/* La promesse assumée du NPI : le branchement à l'ANIP n'est pas
          accessible à un particulier. L'interface montre la voie. */}
      <div className="mt-4 rounded-2xl border border-dashed border-ligne bg-papier p-5">
        <p className="text-sm font-semibold">Connexion avec NPI</p>
        <p className="mt-1 text-xs text-encre-doux">
          Votre Numéro Personnel d&apos;Identification remplacera un jour
          l&apos;email et le mot de passe : un seul identifiant, délivré par
          l&apos;État, sans double compte possible.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            disabled
            placeholder="Votre NPI"
            className="w-40 rounded-xl border border-ligne bg-white px-3 py-2 text-sm opacity-60"
          />
          <button
            type="button"
            disabled
            className="rounded-xl border border-ligne px-4 py-2 text-sm font-medium text-encre-doux opacity-60"
          >
            Se connecter
          </button>
        </div>
        <p className="mt-2 text-xs font-medium text-rouge">
          Non fonctionnel pour le moment.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-encre-doux">
        <Link href="/acces-ministere" className="underline hover:text-encre">
          Accès ministère
        </Link>
      </p>
    </div>
  );
}
