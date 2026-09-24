"use client";

import { useActionState, useState } from "react";
import { abonner, type Retour } from "./actions";
import { Alerte } from "@/components/ui/alerte";
import { Bouton, champClasse } from "@/components/ui/formulaire";

const etatInitial: Retour = {};

export default function FormulaireTransport({
  lignes,
  arrets,
}: {
  lignes: { id: number; nom: string }[];
  arrets: { id: number; nom: string; ligneId: number }[];
}) {
  const [etat, action, enCours] = useActionState(abonner, etatInitial);
  const [ligneId, setLigneId] = useState("");
  const arretsDeLaLigne = arrets.filter((a) => a.ligneId === Number(ligneId));

  return (
    <form action={action} className="rounded-xl border border-ligne bg-papier p-4">
      <p className="text-sm font-semibold">S'abonner à une ligne</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Ligne</label>
          <select
            name="ligneId"
            required
            value={ligneId}
            onChange={(e) => setLigneId(e.target.value)}
            className={champClasse}
          >
            <option value="">Choisir…</option>
            {lignes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Mon arrêt</label>
          <select name="arretId" required className={champClasse} key={ligneId}>
            <option value="">Choisir…</option>
            {arretsDeLaLigne.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Bouton type="submit" disabled={enCours} className="mt-3">
        {enCours ? "…" : "S'abonner"}
      </Bouton>
      <div className="mt-2">
        <Alerte {...etat} />
      </div>
    </form>
  );
}
