"use client";

import { useActionState, useState } from "react";
import { IconSend } from "@tabler/icons-react";
import { poserQuestion } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";

/**
 * La question au tuteur. Le champ est CONTRÔLÉ (état React) : un
 * re-rendu de la page pendant la frappe ne peut plus vider la saisie.
 * Après un envoi réussi, le champ se vide.
 */
export default function FormulaireTuteur({ devoirId }: { devoirId: number }) {
  const [question, setQuestion] = useState("");
  const [etat, action, enCours] = useActionState<Retour, FormData>(
    async (prec, donnees) => {
      const retour = await poserQuestion(prec, donnees);
      if (retour.message) setQuestion("");
      return retour;
    },
    {},
  );

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-3">
      <input type="hidden" name="devoirId" value={devoirId} />
      <Alerte {...etat} />
      <div className="flex items-center gap-2">
        <textarea
          name="question"
          required
          rows={2}
          maxLength={2000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Posez votre question : où bloquez-vous ? Qu'avez-vous déjà essayé ?"
          className="max-h-40 flex-1 resize-none rounded-2xl border border-ligne bg-papier px-4 py-2.5 text-sm focus:border-vert/40 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={enCours || !question.trim()}
          aria-label="Envoyer la question au tuteur"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vert text-white transition hover:bg-vert-fonce disabled:opacity-60"
        >
          <IconSend className="h-[18px] w-[18px]" stroke={1.8} />
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-discret">
        {enCours
          ? "Le tuteur réfléchit…"
          : "Cliquez sur l'icône pour envoyer votre question."}
      </p>
    </form>
  );
}
