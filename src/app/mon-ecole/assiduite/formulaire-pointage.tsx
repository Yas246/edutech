"use client";

import { useActionState, useState } from "react";
import { pointerAssiduite } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";

const STATUTS = [
  { valeur: "present", titre: "Présent" },
  { valeur: "retard", titre: "Retard" },
  { valeur: "absent", titre: "Absent" },
];

export default function FormulairePointage({
  enseignants,
  date,
  dejaPointe,
}: {
  enseignants: { id: number; prenom: string; nom: string; matieres: string }[];
  date: string;
  dejaPointe: Record<number, string>;
}) {
  const [etat, action, enCours] = useActionState<Retour, FormData>(pointerAssiduite, {});
  const [dateChoisie, setDateChoisie] = useState(date);

  return (
    <form action={action} className="mt-4">
      <Alerte {...etat} />

      <div className="mb-4 max-w-56">
        <label htmlFor="date" className="block text-sm font-medium">
          Jour pointé
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          max={new Date().toISOString().slice(0, 10)}
          value={dateChoisie}
          onChange={(e) => setDateChoisie(e.target.value)}
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
        />
      </div>

      <ul className="divide-y divide-ligne rounded-2xl border border-ligne bg-white">
        {enseignants.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">
                {e.prenom} {e.nom}
              </p>
              <p className="text-xs text-encre-doux">{e.matieres}</p>
            </div>
            <fieldset className="flex gap-4 text-sm">
              <legend className="sr-only">Présence de {e.prenom} {e.nom}</legend>
              {STATUTS.map((s) => (
                <label key={s.valeur} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name={`statut-${e.id}`}
                    value={s.valeur}
                    defaultChecked={(dejaPointe[e.id] ?? "present") === s.valeur}
                  />
                  {s.titre}
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ul>

      <button
        type="submit"
        disabled={enCours || enseignants.length === 0}
        className="mt-4 rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Enregistrement…" : "Enregistrer le pointage"}
      </button>
    </form>
  );
}
