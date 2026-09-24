"use client";

import { useActionState } from "react";
import { enregistrerNotes, type Retour } from "./actions";

const etatInitial: Retour = {};

export default function FormulaireNotes({
  evaluationId,
  eleves,
  notesExistantes,
  bareme,
}: {
  evaluationId: number;
  eleves: { id: number; prenom: string; nom: string }[];
  notesExistantes: Record<number, string>;
  bareme: number;
}) {
  const [etat, action, enCours] = useActionState(enregistrerNotes, etatInitial);

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <table className="w-full text-sm">
        <caption className="sr-only">Saisie des notes</caption>
        <tbody>
          {eleves.map((e) => (
            <tr key={e.id} className="border-b border-ligne/60">
              <td className="py-2 font-medium">
                {e.prenom} {e.nom}
              </td>
              <td className="py-2 text-right">
                <label className="sr-only" htmlFor={`note_${evaluationId}_${e.id}`}>
                  Note de {e.prenom} {e.nom}
                </label>
                <input
                  id={`note_${evaluationId}_${e.id}`}
                  name={`note_${e.id}`}
                  defaultValue={notesExistantes[e.id] ?? ""}
                  inputMode="decimal"
                  placeholder={`– / ${bareme}`}
                  className="w-24 rounded-xl border border-ligne bg-white px-3 py-1.5 text-right"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
        >
          {enCours ? "Enregistrement…" : "Enregistrer les notes"}
        </button>
        {(etat.erreur || etat.message) && (
          <p
            role="alert"
            className={`rounded-xl px-3 py-2 text-sm ${
              etat.erreur
                ? "border border-rouge/30 bg-rouge-clair text-rouge"
                : "border border-vert/30 bg-vert-clair text-vert-fonce"
            }`}
          >
            {etat.erreur ?? etat.message}
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-encre-doux">
        La virgule est acceptée (8,5). Un champ vide : l&apos;élève n&apos;a pas
        passé l&apos;épreuve. Une note au-dessus du barème est refusée.
      </p>
    </form>
  );
}
