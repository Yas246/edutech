"use client";

import { useActionState, useState } from "react";
import { televerserReleve, saisirReleve } from "./actions";
import { BAREMES } from "@/lib/orientation-baremes";
import { Alerte, type Retour } from "@/components/ui/alerte";

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

export function FormulairePhoto() {
  const [etat, action, enCours] = useActionState<Retour, FormData>(televerserReleve, {});
  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-5">
      <Alerte {...etat} />
      <h2 className="font-semibold">Envoyer la photo du relevé</h2>
      <p className="mt-1 text-sm text-encre-doux">
        Photographiez votre relevé du baccalauréat (JPEG, PNG ou WebP, 3 Mo au
        plus). La lecture recopie ce qui est écrit ; les coefficients, la
        moyenne et la mention sont ensuite recalculés ici, et vous corrigez
        avant de valider.
      </p>
      <input
        type="file"
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        required
        className="mt-3 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-vert-clair file:px-3 file:py-1.5 file:text-vert-fonce"
      />
      <button
        type="submit"
        disabled={enCours}
        className="mt-3 rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Lecture du relevé…" : "Lire mon relevé"}
      </button>
    </form>
  );
}

export function FormulaireSaisie() {
  const [etat, action, enCours] = useActionState<Retour, FormData>(saisirReleve, {});
  const [serie, setSerie] = useState("D");

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-5">
      <Alerte {...etat} />
      <h2 className="font-semibold">Ou saisir mes notes</h2>
      <p className="mt-1 text-sm text-encre-doux">
        Les coefficients du barème officiel de la série s&apos;appliquent
        automatiquement.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="saisie-serie" className="block text-sm font-medium">Série</label>
          <select
            id="saisie-serie"
            name="serie"
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          >
            {Object.keys(BAREMES).map((s) => (
              <option key={s} value={s}>Série {s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="saisie-nom" className="block text-sm font-medium">
            Nom et prénoms <span className="font-normal text-encre-doux">(facultatif)</span>
          </label>
          <input
            id="saisie-nom"
            name="nom"
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>
      <fieldset className="mt-3">
        <legend className="text-sm font-medium">Mes notes (sur 20)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(BAREMES[serie] ?? {}).map(([matiere, coeff]) => (
            <label key={matiere} className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                {LIBELLES[matiere] ?? matiere}
                <span className="text-encre-doux"> · coeff. {coeff}</span>
              </span>
              <input
                name={`note_${matiere}`}
                inputMode="decimal"
                min={0}
                max={20}
                step="0.01"
                placeholder="—"
                className="w-20 rounded-lg border border-ligne bg-white px-2 py-1.5 text-right"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 max-w-56">
        <label htmlFor="saisie-moyenne" className="block text-sm font-medium">
          Moyenne affichée sur le relevé <span className="font-normal text-encre-doux">(contrôle)</span>
        </label>
        <input
          id="saisie-moyenne"
          name="moyenneAnnoncee"
          inputMode="decimal"
          placeholder="ex. 10,64"
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={enCours}
        className="mt-3 rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Calcul…" : "Vérifier mon profil"}
      </button>
    </form>
  );
}
