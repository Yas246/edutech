"use client";

import { useActionState, useState } from "react";
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
  notesExistantes: Record<number, { valeur: string; absent: boolean; justifie: boolean }>;
  bareme: number;
}) {
  const [etat, action, enCours] = useActionState(enregistrerNotes, etatInitial);
  // Les élèves marqués absents, pour afficher la case « justifiée ».
  const [absents, setAbsents] = useState<Record<number, boolean>>(
    Object.fromEntries(
      eleves.map((e) => [e.id, notesExistantes[e.id]?.absent ?? false]),
    ),
  );

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <table className="w-full text-sm">
        <caption className="sr-only">Saisie des notes</caption>
        <thead>
          <tr className="border-b border-ligne text-left text-encre-doux">
            <th scope="col" className="py-2 font-medium">Élève</th>
            <th scope="col" className="py-2 text-right font-medium">Note</th>
            <th scope="col" className="py-2 pl-4 font-medium">Absent à l&apos;épreuve</th>
          </tr>
        </thead>
        <tbody>
          {eleves.map((e) => {
            const existante = notesExistantes[e.id];
            return (
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
                    defaultValue={existante?.valeur ?? ""}
                    inputMode="decimal"
                    placeholder={`– / ${bareme}`}
                    disabled={absents[e.id]}
                    className="w-24 rounded-xl border border-ligne bg-white px-3 py-1.5 text-right disabled:opacity-50"
                  />
                </td>
                <td className="py-2 pl-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        name={`absent_${e.id}`}
                        defaultChecked={existante?.absent ?? false}
                        onChange={(evenement) =>
                          setAbsents((avant) => ({ ...avant, [e.id]: evenement.target.checked }))
                        }
                      />
                      Absent
                    </label>
                    <label
                      className={`flex items-center gap-1.5 ${absents[e.id] ? "" : "opacity-40"}`}
                    >
                      <input
                        type="checkbox"
                        name={`justifie_${e.id}`}
                        defaultChecked={existante?.justifie ?? false}
                        disabled={!absents[e.id]}
                      />
                      Justifiée
                    </label>
                  </div>
                </td>
              </tr>
            );
          })}
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
        La virgule est acceptée (8,5). Absent non justifiée : compté zéro.
        Absence justifiée : l&apos;épreuve est exclue du calcul. Une note
        au-dessus du barème est refusée.
      </p>
    </form>
  );
}
