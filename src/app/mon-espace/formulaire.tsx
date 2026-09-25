"use client";

import { useActionState } from "react";
import { modifierMonEspace } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";

export default function FormulaireEspace({
  role,
  pseudo,
  prenom,
  nom,
  telephone,
  sexe,
  interets,
  dateNaissance,
  lieuNaissance,
}: {
  role: string;
  pseudo: string;
  prenom: string;
  nom: string;
  telephone: string;
  sexe: string;
  interets: string;
  dateNaissance: string;
  lieuNaissance: string;
}) {
  const [etat, action, enCours] = useActionState<Retour, FormData>(modifierMonEspace, {});
  const estEleve = role === "eleve";

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-ligne bg-white p-5">
      <Alerte {...etat} />

      <div className="rounded-xl bg-papier p-3 text-sm">
        Identifiant public :{" "}
        <span className="font-mono font-bold text-vert-fonce">@{pseudo}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="espace-prenom" className="block text-sm font-medium">Prénom</label>
          <input
            id="espace-prenom"
            name="prenom"
            required
            defaultValue={prenom}
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="espace-nom" className="block text-sm font-medium">Nom</label>
          <input
            id="espace-nom"
            name="nom"
            required
            defaultValue={nom}
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="espace-telephone" className="block text-sm font-medium">
            Téléphone{" "}
            {!estEleve && <span className="font-normal text-encre-doux">(requis)</span>}
          </label>
          <input
            id="espace-telephone"
            name="telephone"
            type="tel"
            defaultValue={telephone}
            required={!estEleve}
            placeholder="Ex. 97 00 00 00"
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-encre-doux">
            Un numéro ne peut appartenir qu&apos;à un seul compte.
          </p>
        </div>
        <div>
          <label htmlFor="espace-sexe" className="block text-sm font-medium">
            Sexe <span className="font-normal text-encre-doux">(facultatif)</span>
          </label>
          <select
            id="espace-sexe"
            name="sexe"
            defaultValue={sexe}
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          >
            <option value="">Je préfère ne pas le dire</option>
            <option value="F">Féminin</option>
            <option value="M">Masculin</option>
          </select>
        </div>
        {estEleve && (
          <div className="sm:col-span-2">
            <label htmlFor="espace-interets" className="block text-sm font-medium">
              Mes centres d&apos;intérêt{" "}
              <span className="font-normal text-encre-doux">(séparés par des virgules)</span>
            </label>
            <input
              id="espace-interets"
              name="interets"
              defaultValue={interets}
              placeholder="ex. médecine, informatique"
              className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-encre-doux">
              Ils nourrissent la boussole d&apos;orientation et le coach.
            </p>
          </div>
        )}
        {estEleve && (
          <>
            <div>
              <label htmlFor="espace-date-naissance" className="block text-sm font-medium">
                Date de naissance{" "}
                <span className="font-normal text-encre-doux">(facultatif)</span>
              </label>
              <input
                id="espace-date-naissance"
                name="dateNaissance"
                type="date"
                defaultValue={dateNaissance}
                className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="espace-lieu-naissance" className="block text-sm font-medium">
                Lieu de naissance{" "}
                <span className="font-normal text-encre-doux">(facultatif)</span>
              </label>
              <input
                id="espace-lieu-naissance"
                name="lieuNaissance"
                defaultValue={lieuNaissance}
                maxLength={80}
                placeholder="Ex. Porto-Novo"
                className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-encre-doux">
                Votre état civil alimente vos listes d&apos;examen.
              </p>
            </div>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Enregistrement…" : "Enregistrer mes informations"}
      </button>
    </form>
  );
}
