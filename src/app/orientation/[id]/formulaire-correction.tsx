"use client";

import { useActionState, useState } from "react";
import { validerReleve } from "./actions";
import { BAREMES } from "@/lib/orientation-baremes";
import { Alerte, type Retour } from "@/components/ui/alerte";
import type { MatiereProfil } from "@/lib/orientation-moteur";

const LIBELLES: Record<string, string> = {
  FRANCAIS: "Français",
  PHILOSOPHIE: "Philosophie",
  "HISTOIRE & GEOGRAPHIE": "Histoire-Géographie",
  "LANGUE VIVANTE 1": "Langue vivante 1",
  "LANGUE VIVANTE 2": "Langue vivante 2",
  MATHEMATIQUES: "Mathématiques",
  "SCIENCES DE LA VIE ET DE LA TERRE": "Sciences de la vie et de la Terre",
  "SCIENCES PHYSIQUES": "Sciences physiques",
  "EDUCATION PHYSIQUE ET SPORTIVE": "Éducation physique et sportive",
  ECONOMIE: "Économie",
  ANGLAIS: "Anglais (langue vivante 1)",
};

export default function FormulaireCorrection({
  releveId,
  serie,
  nom,
  numTable,
  moyenneAnnoncee,
  decision,
  matieres,
}: {
  releveId: number;
  serie: string;
  nom: string;
  numTable: string;
  moyenneAnnoncee: string;
  decision: string;
  matieres: Record<string, MatiereProfil>;
}) {
  const [etat, action, enCours] = useActionState<Retour, FormData>(validerReleve, {});
  const [serieChoisie, setSerieChoisie] = useState(serie);

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-5">
      <Alerte {...etat} />
      <input type="hidden" name="releveId" value={releveId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="corr-serie" className="block text-sm font-medium">Série</label>
          <select
            id="corr-serie"
            name="serie"
            value={serieChoisie}
            onChange={(e) => setSerieChoisie(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          >
            {!BAREMES[serieChoisie] && <option value="">À choisir</option>}
            {Object.keys(BAREMES).map((s) => (
              <option key={s} value={s}>Série {s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="corr-nom" className="block text-sm font-medium">Nom et prénoms</label>
          <input
            id="corr-nom"
            name="nom"
            defaultValue={nom}
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="corr-table" className="block text-sm font-medium">
            Numéro de table <span className="font-normal text-encre-doux">(facultatif)</span>
          </label>
          <input
            id="corr-table"
            name="numTable"
            defaultValue={numTable}
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="corr-moyenne" className="block text-sm font-medium">
            Moyenne affichée <span className="font-normal text-encre-doux">(contrôle)</span>
          </label>
          <input
            id="corr-moyenne"
            name="moyenneAnnoncee"
            inputMode="decimal"
            defaultValue={moyenneAnnoncee}
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="corr-decision" className="block text-sm font-medium">
            Décision du jury <span className="font-normal text-encre-doux">(facultative)</span>
          </label>
          <select
            id="corr-decision"
            name="decision"
            defaultValue={decision}
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="Admis">Admis</option>
            <option value="Ajourné">Ajourné</option>
          </select>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">
          Notes lues sur le relevé — corrigez ce qui est faux, laissez vide
          ce qui manque
        </legend>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">Notes et coefficients du relevé</caption>
          <thead>
            <tr className="border-b border-ligne text-left text-encre-doux">
              <th scope="col" className="py-1.5 font-medium">Matière</th>
              <th scope="col" className="py-1.5 font-medium text-right">Coeff.</th>
              <th scope="col" className="py-1.5 font-medium text-right">Points</th>
              <th scope="col" className="py-1.5 font-medium text-right">Note /20</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(BAREMES[serieChoisie] ?? {}).map(([cle, coeff]) => {
              const lu = matieres[cle];
              return (
                <tr key={cle} className="border-b border-ligne/60 last:border-0">
                  <td className="py-1.5">{LIBELLES[cle] ?? cle.toLowerCase()}</td>
                  <td className="py-1.5 text-right text-encre-doux">{coeff}</td>
                  <td className="py-1.5 text-right text-encre-doux">
                    {lu?.points === null || lu?.points === undefined ? "—" : lu.points}
                  </td>
                  <td className="py-1.5 text-right">
                    <input
                      name={`note_${cle}`}
                      inputMode="decimal"
                      min={0}
                      max={20}
                      step="0.01"
                      defaultValue={lu?.note ?? ""}
                      placeholder="—"
                      className="w-20 rounded-lg border border-ligne bg-white px-2 py-1 text-right"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>

      <button
        type="submit"
        disabled={enCours || !BAREMES[serieChoisie]}
        className="mt-4 rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Vérification…" : "Valider et voir mes pistes"}
      </button>
    </form>
  );
}
