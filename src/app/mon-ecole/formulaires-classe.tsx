"use client";

import { useActionState } from "react";
import {
  affecterEnseignant,
  ajouterMatiere,
  creerClasse,
  inscrireEleve,
  type Retour,
} from "./actions";

const etatInitial: Retour = {};

const champ =
  "mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm";
const bouton =
  "mt-2 w-full rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60";

function Retour({ retour }: { retour: Retour }) {
  if (!retour.erreur && !retour.message) return null;
  return (
    <p
      role="alert"
      className={`mt-2 rounded-lg px-2 py-1.5 text-xs ${
        retour.erreur
          ? "border border-rouge/30 bg-rouge-clair text-rouge"
          : "border border-vert/30 bg-vert-clair text-vert-fonce"
      }`}
    >
      {retour.erreur ?? retour.message}
    </p>
  );
}

export function FormulaireMatiere({ classeId }: { classeId: number }) {
  const [etat, action, enCours] = useActionState(ajouterMatiere, etatInitial);
  return (
    <form action={action} className="rounded-xl border border-ligne p-3">
      <p className="text-sm font-semibold">Ajouter une matière</p>
      <input type="hidden" name="classeId" value={classeId} />
      <input name="nom" placeholder="Ex. Mathématiques" required className={champ} />
      <input
        name="coefficient"
        type="number"
        min={1}
        max={10}
        defaultValue={1}
        className={champ}
        aria-label="Coefficient"
      />
      <button type="submit" disabled={enCours} className={bouton}>
        {enCours ? "Ajout…" : "Ajouter"}
      </button>
      <Retour retour={etat} />
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
      <select name="matiereId" required className={champ}>
        <option value="">Choisir la matière…</option>
        {matieres.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nom}
          </option>
        ))}
      </select>
      <select name="enseignantId" required className={champ}>
        <option value="">Choisir l&apos;enseignant…</option>
        {enseignants.map((e) => (
          <option key={e.id} value={e.id}>
            {e.prenom} {e.nom}
          </option>
        ))}
      </select>
      <button type="submit" disabled={enCours} className={bouton}>
        {enCours ? "…" : "Confier"}
      </button>
      <Retour retour={etat} />
    </form>
  );
}

export function FormulaireEleve({ classeId }: { classeId: number }) {
  const [etat, action, enCours] = useActionState(inscrireEleve, etatInitial);
  return (
    <form action={action} className="rounded-xl border border-ligne p-3">
      <p className="text-sm font-semibold">Inscrire un élève</p>
      <input type="hidden" name="classeId" value={classeId} />
      <input
        name="email"
        type="email"
        placeholder="Email du compte de l'élève"
        required
        className={champ}
      />
      <button type="submit" disabled={enCours} className={bouton}>
        {enCours ? "…" : "Inscrire"}
      </button>
      <Retour retour={etat} />
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
          className={champ}
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
          className={champ}
        />
      </div>
      <button
        type="submit"
        disabled={enCours}
        className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Création…" : "Créer la classe"}
      </button>
      <div className="w-full">
        <Retour retour={etat} />
      </div>
    </form>
  );
}
