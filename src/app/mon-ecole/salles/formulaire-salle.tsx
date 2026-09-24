"use client";

import { useActionState } from "react";
import { creerSalle } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";
import { Bouton, champClasse } from "@/components/ui/formulaire";

const etatInitial: Retour = {};

export default function FormulaireSalle() {
  const [etat, action, enCours] = useActionState(creerSalle, etatInitial);
  return (
    <form
      action={action}
      className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-ligne bg-white p-4"
    >
      <div>
        <label htmlFor="nom" className="block text-sm font-medium">
          Nouvelle salle
        </label>
        <input
          id="nom"
          name="nom"
          required
          placeholder="Ex. Salle 12"
          className={champClasse}
        />
      </div>
      <div>
        <label htmlFor="capacite" className="block text-sm font-medium">
          Capacité <span className="font-normal text-encre-doux">(facultative)</span>
        </label>
        <input
          id="capacite"
          name="capacite"
          type="number"
          min={0}
          step={1}
          placeholder="Ex. 40"
          className={champClasse}
        />
      </div>
      <Bouton type="submit" disabled={enCours} className="mt-6">
        {enCours ? "Création…" : "Créer la salle"}
      </Bouton>
      <div className="w-full">
        <Alerte {...etat} />
      </div>
    </form>
  );
}
