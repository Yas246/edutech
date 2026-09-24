import type { Metadata } from "next";

export const metadata: Metadata = { title: "Créer un compte" };

export default function Inscription() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Créer un compte</h1>
      <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-6 text-encre-doux">
        L&apos;inscription des élèves, parents, enseignants et directions arrive avec la prochaine
        étape de construction.
      </p>
    </div>
  );
}
