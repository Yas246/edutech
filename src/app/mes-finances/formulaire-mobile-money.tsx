"use client";

import { useActionState, useState } from "react";
import { payerMobileMoney, type Retour } from "../finances/actions";

const etatInitial: Retour = {};

/**
 * Le paiement Mobile Money : le parent choisit son opérateur, saisit
 * son numéro et valide le PIN sur SON téléphone. Le processeur réel se
 * branchera derrière cette même interface.
 */
export default function FormulaireMobileMoney({
  factureId,
  restant,
}: {
  factureId: number;
  restant: number;
}) {
  const [etat, action, enCours] = useActionState(payerMobileMoney, etatInitial);
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
      >
        Payer par Mobile Money
      </button>
    );
  }

  return (
    <form action={action} className="rounded-xl border border-ligne bg-papier p-4">
      <p className="text-sm font-semibold">Payer par Mobile Money</p>
      <p className="mt-0.5 text-xs text-encre-doux">
        Restant dû : {restant.toLocaleString("fr-FR")} F CFA. Vous validez le
        code PIN sur votre téléphone, sans quitter la plateforme.
      </p>
      <input type="hidden" name="factureId" value={factureId} />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium">Opérateur</label>
          <select name="operateur" className="mt-1 rounded-xl border border-ligne px-3 py-2 text-sm">
            <option value="mtn">MTN MoMo</option>
            <option value="moov">Moov Money</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium">Numéro</label>
          <input
            name="telephone"
            required
            placeholder="Ex. 97 00 00 00"
            className="mt-1 w-40 rounded-xl border border-ligne px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium">Montant (F CFA)</label>
          <input
            name="montant"
            type="number"
            min={1}
            max={restant}
            step={1}
            required
            defaultValue={restant}
            className="mt-1 w-36 rounded-xl border border-ligne px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={enCours}
          className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
        >
          {enCours ? "Paiement en cours…" : "Valider le paiement"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-xs text-encre-doux underline"
        >
          Renoncer
        </button>
      </div>
      {(etat.erreur || etat.message) && (
        <p
          role="alert"
          className={`mt-3 rounded-xl px-3 py-2 text-sm ${
            etat.erreur
              ? "border border-rouge/30 bg-rouge-clair text-rouge"
              : "border border-vert/30 bg-vert-clair text-vert-fonce"
          }`}
        >
          {etat.erreur ?? etat.message}
        </p>
      )}
    </form>
  );
}
