"use client";

import { useActionState } from "react";
import { IconSend } from "@tabler/icons-react";
import { poserQuestion } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";

/** La question au tuteur, avec son retour d'écran. */
export default function FormulaireTuteur({ devoirId }: { devoirId: number }) {
  const [etat, action, enCours] = useActionState<Retour, FormData>(poserQuestion, {});

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-3">
      <Alerte {...etat} />
      <div className="flex items-center gap-2">
        <textarea
          name="question"
          required
          rows={2}
          maxLength={2000}
          placeholder="Posez votre question : où bloquez-vous ? Qu'avez-vous déjà essayé ?"
          className="max-h-40 flex-1 resize-none rounded-2xl border border-ligne bg-papier px-4 py-2.5 text-sm focus:border-vert/40 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={enCours}
          aria-label="Envoyer la question au tuteur"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vert text-white transition hover:bg-vert-fonce disabled:opacity-60"
        >
          <IconSend className="h-[18px] w-[18px]" stroke={1.8} />
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-discret">
        {enCours
          ? "Le tuteur réfléchit…"
          : "Entrée ne suffit pas : cliquez sur l'icône pour envoyer."}
      </p>
    </form>
  );
}
