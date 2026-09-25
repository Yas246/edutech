"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { rolesPublics } from "@/lib/roles";
import { inscrire, type EtatInscription } from "./actions";
import { Alerte } from "@/components/ui/alerte";

const etatInitial: EtatInscription = {};

const typesEtablissement = [
  { valeur: "ceg", titre: "CEG" },
  { valeur: "college", titre: "Collège" },
  { valeur: "lycee", titre: "Lycée" },
  { valeur: "technique", titre: "Technique" },
  { valeur: "superieur", titre: "Supérieur" },
  { valeur: "autre", titre: "Autre" },
];

const statutsEtablissement = [
  { valeur: "public", titre: "Public" },
  { valeur: "prive", titre: "Privé" },
  { valeur: "confesse", titre: "Confessionnel" },
];

export default function FormulaireInscription() {
  const [role, setRole] = useState("");
  const [etat, action, enCours] = useActionState(inscrire, etatInitial);

  return (
    <form action={action} className="space-y-5">
      <Alerte {...etat} />

      <fieldset>
        <legend className="text-sm font-semibold">Votre place</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {rolesPublics.map((r) => (
            <label
              key={r.valeur}
              className={`cursor-pointer rounded-xl border p-3 text-sm transition ${
                role === r.valeur
                  ? "border-vert bg-vert-clair"
                  : "border-ligne bg-white hover:border-vert/40"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r.valeur}
                className="sr-only"
                checked={role === r.valeur}
                onChange={() => setRole(r.valeur)}
              />
              <span className="block font-semibold text-vert-fonce">{r.titre}</span>
              <span className="mt-0.5 block text-encre-doux">{r.texte}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="prenom" className="block text-sm font-medium">
            Prénom
          </label>
          <input
            id="prenom"
            name="prenom"
            required
            autoComplete="given-name"
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="nom" className="block text-sm font-medium">
            Nom
          </label>
          <input
            id="nom"
            name="nom"
            required
            autoComplete="family-name"
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="telephone" className="block text-sm font-medium">
            Téléphone <span className="font-normal text-encre-doux">(facultatif)</span>
          </label>
          <input
            id="telephone"
            name="telephone"
            type="tel"
            placeholder="Ex. 97 00 00 00"
            autoComplete="tel"
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="sexe" className="block text-sm font-medium">
          Sexe <span className="font-normal text-encre-doux">(facultatif)</span>
        </label>
        <select
          id="sexe"
          name="sexe"
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 sm:w-56"
        >
          <option value="">Je préfère ne pas le dire</option>
          <option value="F">Féminin</option>
          <option value="M">Masculin</option>
        </select>
        <p className="mt-1 text-xs text-encre-doux">
          Sert uniquement aux indicateurs de parité du ministère (filles/garçons).
        </p>
      </div>

      <div>
        <label htmlFor="motDePasse" className="block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
        />
        <p className="mt-1 text-xs text-encre-doux">8 caractères au minimum.</p>
      </div>

      {role === "eleve" && (
        <fieldset className="rounded-xl border border-ligne bg-vert-clair/50 p-4">
          <legend className="px-1 text-sm font-semibold text-vert-fonce">
            Votre état civil
          </legend>
          <p className="mb-3 text-xs text-encre-doux">
            Il alimente vos listes d&apos;examen (BEPC, BAC) sans ressaisie.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dateNaissance" className="block text-sm font-medium">
                Date de naissance
              </label>
              <input
                id="dateNaissance"
                name="dateNaissance"
                type="date"
                className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="lieuNaissance" className="block text-sm font-medium">
                Lieu de naissance
              </label>
              <input
                id="lieuNaissance"
                name="lieuNaissance"
                maxLength={80}
                placeholder="Ex. Porto-Novo"
                className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
              />
            </div>
          </div>
        </fieldset>
      )}

      {role === "direction" && (
        <fieldset className="rounded-xl border border-ligne bg-vert-clair/50 p-4">
          <legend className="px-1 text-sm font-semibold text-vert-fonce">
            Votre établissement
          </legend>
          <p className="mb-3 text-xs text-encre-doux">
            Il rejoint la file de validation du ministère.
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="etablissementNom" className="block text-sm font-medium">
                Nom de l&apos;établissement
              </label>
              <input
                id="etablissementNom"
                name="etablissementNom"
                required
                className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="etablissementCommune" className="block text-sm font-medium">
                  Commune
                </label>
                <input
                  id="etablissementCommune"
                  name="etablissementCommune"
                  required
                  className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="etablissementType" className="block text-sm font-medium">
                  Type
                </label>
                <select
                  id="etablissementType"
                  name="etablissementType"
                  className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2"
                >
                  {typesEtablissement.map((t) => (
                    <option key={t.valeur} value={t.valeur}>
                      {t.titre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <span className="block text-sm font-medium">Statut</span>
              <div className="mt-1 flex gap-4 text-sm">
                {statutsEtablissement.map((s, i) => (
                  <label key={s.valeur} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="etablissementStatut"
                      value={s.valeur}
                      defaultChecked={i === 0}
                    />
                    {s.titre}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        disabled={enCours || !role}
        className="w-full rounded-xl bg-vert px-4 py-3 font-semibold text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Création…" : role === "direction" ? "Créer mon compte et proposer mon établissement" : "Créer mon compte"}
      </button>

      <p className="text-center text-sm text-encre-doux">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-vert underline hover:text-vert-fonce">
          Connectez-vous
        </Link>
      </p>
    </form>
  );
}
