"use client";

import { useActionState } from "react";
import {
  creerEmployeMinistere,
  supprimerEmployeMinistere,
  type Retour,
} from "./employes-actions";

const etatInitial: Retour = {};

export function FormulaireEmploye() {
  const [etat, action, enCours] = useActionState(creerEmployeMinistere, etatInitial);
  const champ = "mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm";

  return (
    <form action={action} className="mt-3 rounded-2xl border border-ligne bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Prénom</label>
          <input name="prenom" required className={champ} />
        </div>
        <div>
          <label className="block text-sm font-medium">Nom</label>
          <input name="nom" required className={champ} />
        </div>
        <div>
          <label className="block text-sm font-medium">Email professionnel</label>
          <input name="email" type="email" required className={champ} />
        </div>
        <div>
          <label className="block text-sm font-medium">Mot de passe initial</label>
          <input name="motDePasse" type="password" required minLength={8} className={champ} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium">Niveau de droits</label>
          <select name="niveau" defaultValue="lecture" className={champ}>
            <option value="validation">Validation — valide les écoles et consulte</option>
            <option value="lecture">Lecture — consulte les indicateurs, sans validation</option>
            <option value="admin">Administrateur — gère aussi les agents</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={enCours}
        className="mt-3 rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Création…" : "Créer le compte agent"}
      </button>
      {(etat.erreur || etat.message) && (
        <p
          role="alert"
          className={`mt-2 rounded-xl px-3 py-2 text-sm ${
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

export function BoutonRetirerEmploye({ id }: { id: number }) {
  const [etat, action, enCours] = useActionState(supprimerEmployeMinistere, etatInitial);
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="employeId" value={id} />
      <button
        type="submit"
        disabled={enCours}
        className="rounded-lg border border-rouge/40 px-2.5 py-1 text-xs font-medium text-rouge hover:bg-rouge-clair disabled:opacity-60"
      >
        {enCours ? "…" : "Retirer"}
      </button>
      {etat.erreur && <span className="text-xs text-rouge">{etat.erreur}</span>}
    </form>
  );
}

