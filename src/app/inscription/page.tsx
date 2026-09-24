import type { Metadata } from "next";
import FormulaireInscription from "./formulaire";

export const metadata: Metadata = {
  title: "Créer un compte",
  description:
    "Élève, parent, enseignant ou direction d'établissement : créez votre compte EduTech.",
};

export default function PageInscription() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-14">
      <h1 className="text-3xl font-bold tracking-tight">Créer un compte</h1>
      <p className="mt-2 text-encre-doux">
        Choisissez votre place : chacun voit ce qui le concerne, et rien d&apos;autre.
      </p>
      <div className="mt-6 rounded-2xl border border-ligne bg-white p-6">
        <FormulaireInscription />
      </div>
    </div>
  );
}
