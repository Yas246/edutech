"use client";

import { useActionState } from "react";
import { ecrireBilan } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";
import { champClasse } from "@/components/ui/formulaire";

/**
 * Le formulaire d'écriture d'un bilan : côté professeur il propose le
 * choix de l'enfant, côté parent l'enfant est déjà fixé.
 */
export default function FormulaireBilan({
  enfants,
  enfantFige,
  etiquetaBouton,
}: {
  enfants: { id: number; nom: string }[];
  enfantFige?: number;
  etiquetaBouton: string;
}) {
  const [etat, action, enCours] = useActionState<Retour, FormData>(ecrireBilan, {});

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-5">
      <Alerte {...etat} />
      {enfantFige ? (
        <input type="hidden" name="eleveUserId" value={enfantFige} />
      ) : (
        <div className="max-w-sm">
          <label htmlFor="bilans-enfant" className="block text-sm font-medium">
            Enfant
          </label>
          <select id="bilans-enfant" name="eleveUserId" required className={`${champClasse} mt-1`}>
            <option value="">Choisir…</option>
            {enfants.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="mt-3">
        <label htmlFor="bilans-contenu" className="block text-sm font-medium">
          Message
        </label>
        <textarea
          id="bilans-contenu"
          name="contenu"
          required
          rows={3}
          maxLength={2000}
          placeholder="Appréciation, point de suivi, réponse…"
          className={`${champClasse} mt-1`}
        />
      </div>
      <button
        type="submit"
        disabled={enCours}
        className="mt-3 rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white transition hover:bg-vert-fonce disabled:opacity-60"
      >
        {enCours ? "Envoi…" : etiquetaBouton}
      </button>
    </form>
  );
}
