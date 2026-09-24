"use client";

import { useActionState, useState } from "react";
import { creerDevoir, poserCreneau } from "./actions";
import { Alerte, type Retour } from "@/components/ui/alerte";
import { Bouton, champClasse } from "@/components/ui/formulaire";

const etatInitial: Retour = {};

const heures = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

export default function FormulaireCreneau({
  classeId,
  matieres,
  salles,
}: {
  classeId: number;
  matieres: {
    id: number;
    nom: string;
    enseignants: { id: number; prenom: string; nom: string }[];
  }[];
  salles: { id: number; nom: string }[];
}) {
  const [etat, action, enCours] = useActionState(poserCreneau, etatInitial);
  const [matiereId, setMatiereId] = useState("");
  const enseignantsDeLaMatiere = matieres; // l'enseignant est choisi parmi les attributions plus bas

  return (
    <form
      action={action}
      className="mt-3 rounded-2xl border border-ligne bg-white p-4"
    >
      <input type="hidden" name="classeId" value={classeId} />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="block text-sm font-medium">Matière</label>
          <select
            name="matiereId"
            required
            value={matiereId}
            onChange={(e) => setMatiereId(e.target.value)}
            className={champClasse}
          >
            <option value="">Choisir…</option>
            {matieres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Enseignant</label>
          <select name="enseignantUserId" required className={champClasse} key={matiereId}>
            <option value="">Choisir…</option>
            {enseignantsDeLaMatiere
              .filter((m) => m.id === Number(matiereId))
              .flatMap((m) => m.enseignants.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.prenom} {e.nom}
                </option>
              )))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Salle</label>
          <select name="salleId" required className={champClasse}>
            <option value="">Choisir…</option>
            {salles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Jour</label>
          <select name="jour" required className={champClasse}>
            {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"].map((titre, i) => (
              <option key={titre} value={i + 1}>
                {titre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">De</label>
          <select name="heureDebut" required className={champClasse}>
            {heures.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">À</label>
          <select name="heureFin" required defaultValue="10:00" className={champClasse}>
            {heures.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Bouton type="submit" disabled={enCours} className="mt-3">
        {enCours ? "Pose…" : "Poser le créneau"}
      </Bouton>
      <div className="mt-2">
        <Alerte {...etat} />
      </div>
    </form>
  );
}

export function FormulaireDevoir({
  classeId,
  matieres,
}: {
  classeId: number;
  matieres: { id: number; nom: string }[];
}) {
  const [etat, action, enCours] = useActionState(creerDevoir, etatInitial);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="mt-3 rounded-2xl border border-ligne bg-white p-4">
      <input type="hidden" name="classeId" value={classeId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Matière</label>
          <select name="matiereId" required className={champClasse}>
            <option value="">Choisir…</option>
            {matieres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Titre</label>
          <input name="titre" required placeholder="Ex. Exercices 4 à 7 page 82" className={champClasse} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium">Consigne</label>
          <textarea name="consigne" rows={2} placeholder="Facultative" className={champClasse} />
        </div>
        <div>
          <label className="block text-sm font-medium">Donné le</label>
          <input name="donneLe" type="date" required defaultValue={aujourdhui} className={champClasse} />
        </div>
        <div>
          <label className="block text-sm font-medium">À rendre le</label>
          <input name="aRendreLe" type="date" required className={champClasse} />
        </div>
      </div>
      <Bouton type="submit" disabled={enCours} className="mt-3">
        {enCours ? "Enregistrement…" : "Donner le devoir"}
      </Bouton>
      <div className="mt-2">
        <Alerte {...etat} />
      </div>
    </form>
  );
}
