"use client";

import { useActionState, useState } from "react";
import { creerEvenement } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";
import { Bouton, champClasse } from "@/components/ui/formulaire";

const etatInitial: Retour = {};

export default function FormulaireEvenement({
  classesList,
}: {
  classesList: { id: number; nom: string }[];
}) {
  const [etat, action, enCours] = useActionState(creerEvenement, etatInitial);
  const [portee, setPortee] = useState("etablissement");

  return (
    <form action={action} className="mt-3 rounded-2xl border border-ligne bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium">Titre</label>
          <input
            name="titre"
            required
            placeholder="Ex. Conseil de classe"
            className={champClasse}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Date</label>
          <input name="date" type="date" required className={champClasse} />
        </div>
        <div>
          <label className="block text-sm font-medium">Portée</label>
          <select
            name="portee"
            value={portee}
            onChange={(e) => setPortee(e.target.value)}
            className={champClasse}
          >
            <option value="etablissement">Toute l&apos;école</option>
            <option value="classe">Une classe</option>
          </select>
        </div>
        {portee === "classe" && (
          <div>
            <label className="block text-sm font-medium">Classe</label>
            <select name="classeId" required className={champClasse}>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium">Description</label>
          <textarea name="description" rows={2} placeholder="Facultative" className={champClasse} />
        </div>
      </div>
      <Bouton type="submit" disabled={enCours} className="mt-3">
        {enCours ? "…" : "Poser au calendrier"}
      </Bouton>
      <div className="mt-2">
        <Alerte {...etat} />
      </div>
    </form>
  );
}
