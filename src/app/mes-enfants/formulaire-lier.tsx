"use client";

import { useActionState } from "react";
import { lierEnfant, type Retour } from "./actions";

const etatInitial: Retour = {};

export default function FormulaireLier() {
  const [etat, action, enCours] = useActionState(lierEnfant, etatInitial);

  return (
    <form action={action} className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-ligne bg-white p-4">
      <div className="flex-1">
        <label htmlFor="email" className="block text-sm font-medium">
          Email du compte de votre enfant
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="Ex. eleve.test@edutech.bj"
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={enCours}
        className="mt-6 rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Liaison…" : "Relier mon enfant"}
      </button>
      {(etat.erreur || etat.message) && (
        <p
          role="alert"
          className={`w-full rounded-xl px-3 py-2 text-sm ${
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
