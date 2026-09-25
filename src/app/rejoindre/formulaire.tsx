"use client";

import { useActionState } from "react";
import { rejoindreEcole, rejoindreClasse } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";

export default function FormulaireRejoindre({
  role,
  codeInitial,
}: {
  role: string;
  codeInitial?: string;
}) {
  const [etatEcole, actionEcole, enCoursEcole] = useActionState<Retour, FormData>(
    rejoindreEcole,
    {},
  );
  const [etatClasse, actionClasse, enCoursClasse] = useActionState<Retour, FormData>(
    rejoindreClasse,
    {},
  );

  const codeEcole = codeInitial?.toUpperCase().startsWith("VME-") ? codeInitial : "";
  const codeClasse = codeInitial?.toUpperCase().startsWith("VMT-") ? codeInitial : "";

  return (
    <div className="space-y-4">
      {(role === "enseignant" || role === "direction") && (
        <form action={actionEcole} className="rounded-2xl border border-ligne bg-white p-5">
          <Alerte {...etatEcole} />
          <h2 className="font-semibold">Rejoindre une école</h2>
          <p className="mt-1 text-sm text-encre-doux">
            La direction vous a donné le code de son établissement : il
            confirme votre place dans l&apos;équipe.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              name="code"
              required
              maxLength={12}
              defaultValue={codeEcole}
              placeholder="VME-XXXX"
              className="w-44 rounded-xl border border-ligne bg-white px-3 py-2 text-sm uppercase tracking-wider"
            />
            <button
              type="submit"
              disabled={enCoursEcole}
              className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
            >
              {enCoursEcole ? "…" : "Rejoindre l'école"}
            </button>
          </div>
        </form>
      )}

      {(role === "eleve" || role === "parent") && (
        <form action={actionClasse} className="rounded-2xl border border-ligne bg-white p-5">
          <Alerte {...etatClasse} />
          <h2 className="font-semibold">Rejoindre une classe</h2>
          <p className="mt-1 text-sm text-encre-doux">
            {role === "eleve"
              ? "Le code de la classe vous est donné par le professeur : il vous inscrit réellement, au même titre que l'appel de la direction."
              : "Le code de la classe de votre enfant vous est donné par le professeur : vous recevez les annonces de la classe et vous figurez parmi ses parents."}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              name="code"
              required
              maxLength={12}
              defaultValue={codeClasse}
              placeholder="VMT-XXXX"
              className="w-44 rounded-xl border border-ligne bg-white px-3 py-2 text-sm uppercase tracking-wider"
            />
            <button
              type="submit"
              disabled={enCoursClasse}
              className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
            >
              {enCoursClasse ? "…" : "Rejoindre la classe"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
