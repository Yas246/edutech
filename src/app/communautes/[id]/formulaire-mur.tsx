"use client";

import { useActionState } from "react";
import { publierSurCommunaute } from "../actions";
import { Alerte, type Retour } from "@/components/ui/alerte";

export default function FormulaireMur({ communauteId }: { communauteId: number }) {
  const [etat, action, enCours] = useActionState<Retour, FormData>(
    publierSurCommunaute,
    {},
  );

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-4">
      <Alerte {...etat} />
      <input type="hidden" name="communauteId" value={communauteId} />
      <textarea
        name="contenu"
        required
        maxLength={2000}
        rows={2}
        placeholder="Partagez avec la communauté…"
        className="w-full resize-none rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
        >
          {enCours ? "…" : "Publier"}
        </button>
      </div>
    </form>
  );
}
