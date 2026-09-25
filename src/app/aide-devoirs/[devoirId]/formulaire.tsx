"use client";

import { useActionState } from "react";
import { poserQuestion } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";
import { champClasse } from "@/components/ui/formulaire";

/** La question au tuteur, avec son retour d'écran. */
export default function FormulaireTuteur({ devoirId }: { devoirId: number }) {
  const [etat, action, enCours] = useActionState<Retour, FormData>(poserQuestion, {});

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-4">
      <input type="hidden" name="devoirId" value={devoirId} />
      <Alerte {...etat} />
      <textarea
        name="question"
        required
        rows={3}
        maxLength={2000}
        placeholder="Posez votre question : où bloquez-vous ? Qu'avez-vous déjà essayé ?"
        className={`${champClasse} mt-1`}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white transition hover:bg-vert-fonce disabled:opacity-60"
        >
          {enCours ? "Le tuteur réfléchit…" : "Demander de l'aide"}
        </button>
      </div>
    </form>
  );
}
