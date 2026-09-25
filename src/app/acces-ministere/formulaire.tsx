"use client";

import { useActionState } from "react";
import { creerCompteMinistere, type EtatAcces } from "./actions";
import { Alerte } from "@/components/ui/alerte";

const etatInitial: EtatAcces = {};

/** Le formulaire d'ouverture d'un compte ministère par code d'accès. */
export default function FormulaireAccesMinistere() {
  const [etat, action, enCours] = useActionState(creerCompteMinistere, etatInitial);

  return (
    <form action={action} className="space-y-4">
      <Alerte {...etat} />

      <div>
        <label htmlFor="am-code" className="block text-sm font-medium">
          Code d&apos;accès
        </label>
        <input
          id="am-code"
          name="code"
          required
          maxLength={12}
          placeholder="VMN-XXXX"
          className="mt-1 w-48 rounded-xl border border-ligne bg-white px-3 py-2 font-mono text-sm uppercase tracking-widest"
        />
        <p className="mt-1 text-xs text-encre-doux">
          Il vous a été remis par la plateforme. Un code ouvre un seul compte.
        </p>
      </div>

      <div>
        <label htmlFor="am-organisation" className="block text-sm font-medium">
          Votre institution
        </label>
        <input
          id="am-organisation"
          name="organisation"
          required
          maxLength={120}
          placeholder="Ex. Ministère des Enseignements Secondaire..."
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="am-prenom" className="block text-sm font-medium">
            Prénom
          </label>
          <input
            id="am-prenom"
            name="prenom"
            required
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="am-nom" className="block text-sm font-medium">
            Nom
          </label>
          <input
            id="am-nom"
            name="nom"
            required
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="am-email" className="block text-sm font-medium">
          Email institutionnel
        </label>
        <input
          id="am-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="am-mdp" className="block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="am-mdp"
          name="motDePasse"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="w-full rounded-xl bg-vert px-4 py-3 font-semibold text-white transition hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Ouverture…" : "Ouvrir l'accès ministère"}
      </button>
    </form>
  );
}
