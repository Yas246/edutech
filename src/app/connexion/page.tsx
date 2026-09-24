import type { Metadata } from "next";
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
    </div>
  );
}
