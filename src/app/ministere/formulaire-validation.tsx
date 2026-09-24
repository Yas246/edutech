"use client";

import { useActionState } from "react";
import { invaliderEcole, validerEcole, type Retour } from "./actions";

const etatInitial: Retour = {};

export function BoutonsValidation({ id }: { id: number }) {
  const [etatValider, valider, enCoursValidation] = useActionState(validerEcole, etatInitial);
  const [etatRefuser, refuser, enCoursRefus] = useActionState(invaliderEcole, etatInitial);
  const retour = etatValider.message ?? etatRefuser.message ?? etatValider.erreur ?? etatRefuser.erreur;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={valider}>
          <input type="hidden" name="etablissementId" value={id} />
          <button
            type="submit"
            disabled={enCoursValidation || enCoursRefus}
            className="rounded-lg bg-vert px-3 py-1.5 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
          >
            Valider
          </button>
        </form>
        <form action={refuser}>
          <input type="hidden" name="etablissementId" value={id} />
          <button
            type="submit"
            disabled={enCoursValidation || enCoursRefus}
            className="rounded-lg border border-rouge/40 px-3 py-1.5 text-sm font-medium text-rouge hover:bg-rouge-clair disabled:opacity-60"
          >
            Refuser
          </button>
        </form>
      </div>
      {retour && (
        <p role="alert" className="text-xs text-vert-fonce">
          {retour}
        </p>
      )}
    </div>
  );
}
