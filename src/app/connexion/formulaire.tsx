"use client";

import { useActionState } from "react";
import Link from "next/link";
import { seConnecter, type EtatConnexion } from "./actions";

const etatInitial: EtatConnexion = {};

export default function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState(seConnecter, etatInitial);

  return (
    <form action={action} className="mt-6 space-y-4">
      {etat.erreur && (
        <p
          role="alert"
          className="rounded-xl border border-rouge/30 bg-rouge-clair px-4 py-3 text-sm text-rouge"
        >
          {etat.erreur}
        </p>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="motDePasse" className="block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={enCours}
        className="w-full rounded-xl bg-vert px-4 py-3 font-semibold text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
      <p className="text-center text-sm text-encre-doux">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-medium text-vert underline hover:text-vert-fonce">
          Créez-en un
        </Link>
      </p>
    </form>
  );
}
