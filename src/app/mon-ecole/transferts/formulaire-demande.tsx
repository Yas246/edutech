"use client";

import { useActionState } from "react";
import { demanderTransfert } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";

export default function FormulaireDemande({
  mesClasses,
}: {
  mesClasses: { id: number; nom: string }[];
}) {
  const [etat, action, enCours] = useActionState<Retour, FormData>(demanderTransfert, {});

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-5">
      <Alerte {...etat} />
      <h2 className="font-semibold">Demander un transfert d&apos;entrée</h2>
      <p className="mt-1 text-sm text-encre-doux">
        L&apos;élève est inscrit dans un autre établissement : votre demande
        part au ministère. À la validation, l&apos;inscription dans la classe
        d&apos;accueil est créée, ses bulletins déjà publiés suivent
        l&apos;élève, et son passé reste intact dans son école d&apos;origine.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="transfert-email" className="block text-sm font-medium">
            Email du compte élève
          </label>
          <input
            id="transfert-email"
            name="email"
            type="email"
            required
            placeholder="ex. famille@exemple.bj"
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="transfert-classe" className="block text-sm font-medium">
            Classe d&apos;accueil
          </label>
          <select
            id="transfert-classe"
            name="classeId"
            required
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          >
            {mesClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="transfert-statut" className="block text-sm font-medium">
            L&apos;élève arrive
          </label>
          <select
            id="transfert-statut"
            name="statutArrivee"
            required
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          >
            <option value="passant">Passant (passe en classe supérieure)</option>
            <option value="redoublant">Redoublant (reprend la classe)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="transfert-motif" className="block text-sm font-medium">
            Motif <span className="font-normal text-encre-doux">(facultatif)</span>
          </label>
          <input
            id="transfert-motif"
            name="motif"
            placeholder="ex. déménagement de la famille"
            className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={enCours || mesClasses.length === 0}
        className="mt-3 rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Envoi…" : "Envoyer la demande au ministère"}
      </button>
    </form>
  );
}
