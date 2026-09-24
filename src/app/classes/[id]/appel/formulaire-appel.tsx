"use client";

import { useActionState } from "react";
import { enregistrerAppel, type Retour } from "./actions";

const etatInitial: Retour = {};

export type EleveAppel = {
  id: number;
  prenom: string;
  nom: string;
  statutActuel: string | null;
  motifActuel: string | null;
};

const statuts = [
  { valeur: "present", titre: "Présent" },
  { valeur: "retard", titre: "Retard" },
  { valeur: "absent", titre: "Absent" },
  { valeur: "absent_justifie", titre: "Absence justifiée" },
];

export default function FormulaireAppel({
  classeId,
  date,
  eleves,
}: {
  classeId: number;
  date: string;
  eleves: EleveAppel[];
}) {
  const [etat, action, enCours] = useActionState(enregistrerAppel, etatInitial);

  return (
    <form action={action}>
      <input type="hidden" name="classeId" value={classeId} />
      <input type="hidden" name="date" value={date} />
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Appel de la classe</caption>
        <thead>
          <tr className="border-b border-ligne text-left text-encre-doux">
            <th scope="col" className="py-2 font-medium">Élève</th>
            <th scope="col" className="py-2 font-medium">Statut du jour</th>
            <th scope="col" className="py-2 font-medium">Motif (absences)</th>
          </tr>
        </thead>
        <tbody>
          {eleves.map((e) => {
            const statutActuel = e.statutActuel ?? "present";
            return (
              <tr key={e.id} className="border-b border-ligne/60">
                <td className="py-2 font-medium">
                  {e.prenom} {e.nom}
                  {e.statutActuel && (
                    <span className="ml-2 rounded-full bg-jaune-clair px-2 py-0.5 text-xs text-encre">
                      déjà saisi
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-3">
                    {statuts.map((s) => (
                      <label key={s.valeur} className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`statut_${e.id}`}
                          value={s.valeur}
                          defaultChecked={statutActuel === s.valeur}
                        />
                        {s.titre}
                      </label>
                    ))}
                  </div>
                </td>
                <td className="py-2">
                  <input
                    name={`motif_${e.id}`}
                    defaultValue={e.motifActuel ?? ""}
                    placeholder="Motif si absent…"
                    className="w-full max-w-xs rounded-xl border border-ligne bg-white px-3 py-1.5"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(etat.erreur || etat.message) && (
        <p
          role="alert"
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            etat.erreur
              ? "border border-rouge/30 bg-rouge-clair text-rouge"
              : "border border-vert/30 bg-vert-clair text-vert-fonce"
          }`}
        >
          {etat.erreur ?? etat.message}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="mt-4 rounded-xl bg-vert px-5 py-2.5 font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Enregistrement…" : "Enregistrer l'appel"}
      </button>
    </form>
  );
}
