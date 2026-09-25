"use client";

import { useActionState } from "react";
import {
  affecterEnseignant,
  ajouterMatiere,
  creerClasse,
} from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";
import { Bouton, champClasse } from "@/components/ui/formulaire";

const etatInitial: Retour = {};

export function FormulaireMatiere({ classeId }: { classeId: number }) {
  const [etat, action, enCours] = useActionState(ajouterMatiere, etatInitial);
  return (
    <form action={action} className="rounded-xl border border-ligne p-3">
      <p className="text-sm font-semibold">Ajouter une matière</p>
      <input type="hidden" name="classeId" value={classeId} />
      <input
        name="nom"
        placeholder="Ex. Mathématiques"
        required
        className={champClasse}
      />
      <input
        name="coefficient"
        type="number"
        min={1}
        max={10}
        defaultValue={1}
        className={champClasse}
        aria-label="Coefficient"
      />
      <Bouton type="submit" disabled={enCours} className="mt-2 w-full">
        {enCours ? "Ajout…" : "Ajouter"}
      </Bouton>
      <div className="mt-2">
        <Alerte {...etat} />
      </div>
    </form>
  );
}

export function FormulaireEnseignant({
  matieres,
  enseignants,
}: {
  matieres: { id: number; nom: string }[];
  enseignants: { id: number; nom: string; prenom: string }[];
}) {
  const [etat, action, enCours] = useActionState(affecterEnseignant, etatInitial);
  return (
    <form action={action} className="rounded-xl border border-ligne p-3">
      <p className="text-sm font-semibold">Confier une matière</p>
      <select name="matiereId" required className={champClasse}>
        <option value="">Choisir la matière…</option>
        {matieres.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nom}
          </option>
        ))}
      </select>
      <select name="enseignantId" required className={champClasse}>
        <option value="">Choisir l&apos;enseignant…</option>
        {enseignants.map((e) => (
          <option key={e.id} value={e.id}>
            {e.prenom} {e.nom}
          </option>
        ))}
      </select>
      <Bouton type="submit" disabled={enCours} className="mt-2 w-full">
        {enCours ? "…" : "Confier"}
      </Bouton>
      <div className="mt-2">
        <Alerte {...etat} />
      </div>
    </form>
  );
}

export function FormulaireClasse() {
  const [etat, action, enCours] = useActionState(creerClasse, etatInitial);
  return (
    <form
      action={action}
      className="mt-6 flex flex-wrap items-start gap-3 rounded-2xl border border-ligne bg-white p-4"
    >
      <div>
        <label htmlFor="nom" className="block text-sm font-medium">
          Nouvelle classe
        </label>
        <input
          id="nom"
          name="nom"
          placeholder="Ex. Première C"
          required
          className={champClasse}
        />
      </div>
      <div>
        <label htmlFor="niveau" className="block text-sm font-medium">
          Niveau
        </label>
        <input
          id="niveau"
          name="niveau"
          placeholder="Ex. Première"
          required
          className={champClasse}
        />
      </div>
      <Bouton type="submit" disabled={enCours} className="mt-6">
        {enCours ? "Création…" : "Créer la classe"}
      </Bouton>
      <div className="w-full">
        <Alerte {...etat} />
      </div>
    </form>
  );
}
