"use client";

import { useActionState } from "react";
import { creerEvaluation, type Retour } from "./actions";

const etatInitial: Retour = {};

export default function FormulaireEvaluation({
  classeId,
  matieres,
  dateParDefaut,
}: {
  classeId: number;
  matieres: { id: number; nom: string }[];
  dateParDefaut: string;
}) {
  const [etat, action, enCours] = useActionState(creerEvaluation, etatInitial);
  const champ =
    "mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm";

  if (matieres.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-ligne bg-white p-4 text-sm text-encre-doux">
        Posez d&apos;abord le programme de la classe pour créer des évaluations.
      </p>
    );
  }

  return (
    <form
      action={action}
      className="mt-4 rounded-2xl border border-ligne bg-white p-4"
    >
      <input type="hidden" name="classeId" value={classeId} />
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium">Matière</label>
          <select name="matiereId" required className={champ}>
            {matieres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium">Titre</label>
          <input name="titre" required placeholder="Ex. Interrogation n°1" className={champ} />
        </div>
        <div>
          <label className="block text-sm font-medium">Type</label>
          <select name="type" className={champ}>
            <option value="interrogation">Interrogation</option>
            <option value="devoir">Devoir</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Barème</label>
          <input
            name="bareme"
            type="number"
            min={1}
            max={100}
            defaultValue={20}
            required
            className={champ}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={dateParDefaut}
            required
            className={champ}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
          >
            {enCours ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
      {(etat.erreur || etat.message) && (
        <p
          role="alert"
          className={`mt-3 rounded-xl px-3 py-2 text-sm ${
            etat.erreur
              ? "border border-rouge/30 bg-rouge-clair text-rouge"
              : "border border-vert/30 bg-vert-clair text-vert-fonce"
          }`}
        >
          {etat.erreur ?? etat.message}
        </p>
      )}
    </form>
  );
}
