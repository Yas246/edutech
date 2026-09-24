"use client";

import { useActionState, useState } from "react";
import {
  annulerPaiement,
  creerFrais,
  deleguerFinances,
  encaisser,
  genererFactures,
  retirerDelegation,
  type Retour,
} from "./actions";

const etatInitial: Retour = {};

const champ = "mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm";
const bouton =
  "rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60";

function Sortie({ retour }: { retour: Retour }) {
  if (!retour.erreur && !retour.message) return null;
  return (
    <p
      role="alert"
      className={`mt-2 rounded-xl px-3 py-2 text-sm ${
        retour.erreur
          ? "border border-rouge/30 bg-rouge-clair text-rouge"
          : "border border-vert/30 bg-vert-clair text-vert-fonce"
      }`}
    >
      {retour.erreur ?? retour.message}
    </p>
  );
}

export function FormulaireFrais({
  classesList,
  periodesList,
}: {
  classesList: { id: number; nom: string }[];
  periodesList: { id: number; nom: string }[];
}) {
  const [etat, action, enCours] = useActionState(creerFrais, etatInitial);
  const [categorie, setCategorie] = useState("scolarite");
  const [cible, setCible] = useState("classe");

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-sm font-medium">Catégorie</label>
          <select
            name="categorie"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            className={champ}
          >
            <option value="inscription">Inscription</option>
            <option value="scolarite">Scolarité</option>
            <option value="td">Travaux dirigés</option>
            <option value="tenue">Tenue scolaire</option>
            <option value="examen">Examen</option>
            <option value="cantine">Cantine</option>
            <option value="transport">Transport</option>
            <option value="fournitures">Fournitures</option>
            <option value="etude_dossier">Étude de dossier</option>
            <option value="autre">Autre (nom libre)</option>
          </select>
        </div>
        {categorie === "autre" && (
          <div>
            <label className="block text-sm font-medium">Nom du frais</label>
            <input name="libelle" placeholder="Ex. Photos scolaires" className={champ} />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Montant (F CFA)</label>
          <input
            name="montant"
            type="number"
            min={1}
            step={1}
            required
            placeholder="Ex. 150000"
            className={champ}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Viser</label>
          <select
            name="cibleType"
            value={cible}
            onChange={(e) => setCible(e.target.value)}
            className={champ}
          >
            <option value="classe">Une classe</option>
            <option value="niveau">Un niveau</option>
          </select>
        </div>
        {cible === "classe" ? (
          <div>
            <label className="block text-sm font-medium">Classe</label>
            <select name="cibleClasseId" className={champ}>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium">Niveau</label>
            <input name="cibleNiveau" placeholder="Ex. Terminale" className={champ} />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Période</label>
          <select name="periodeId" className={champ}>
            <option value="">Toute l&apos;année</option>
            {periodesList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={enCours} className={`${bouton} w-full`}>
            {enCours ? "…" : "Poser le frais"}
          </button>
        </div>
      </div>
      <Sortie retour={etat} />
    </form>
  );
}

export function FormulaireGeneration({
  frais,
}: {
  frais: { id: number; libelleComplet: string; montant: number }[];
}) {
  const [etat, action, enCours] = useActionState(genererFactures, etatInitial);
  const [idFrais, setIdFrais] = useState("");
  const choisi = frais.find((f) => String(f.id) === idFrais);

  return (
    <form action={action} className="rounded-2xl border border-ligne bg-white p-4">
      <p className="text-sm font-semibold">Générer les factures d&apos;un frais</p>
      <select
        name="fraisId"
        required
        value={idFrais}
        onChange={(e) => setIdFrais(e.target.value)}
        className={champ}
      >
        <option value="">Choisir le frais…</option>
        {frais.map((f) => (
          <option key={f.id} value={f.id}>
            {f.libelleComplet} — {f.montant.toLocaleString("fr-FR")} F
          </option>
        ))}
      </select>

      {choisi && (
        <div className="mt-3">
          <p className="text-sm text-encre-doux">
            Découpez {choisi.montant.toLocaleString("fr-FR")} F en tranches
            (la somme doit faire exactement le montant) :
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="w-20 text-encre-doux">Tranche {i + 1}</span>
              <input
                name="trancheMontant"
                type="number"
                min={1}
                step={1}
                placeholder="Montant"
                className="w-32 rounded-xl border border-ligne px-3 py-2"
              />
              <input
                name="trancheEcheance"
                type="date"
                className="w-40 rounded-xl border border-ligne px-3 py-2"
              />
            </div>
          ))}
        </div>
      )}

      {choisi && (
        <button type="submit" disabled={enCours} className={`${bouton} mt-3`}>
          {enCours ? "Génération…" : "Générer les factures"}
        </button>
      )}
      <Sortie retour={etat} />
    </form>
  );
}

export function FormulaireEncaisser({ factureId, restant }: { factureId: number; restant: number }) {
  const [etat, action, enCours] = useActionState(encaisser, etatInitial);
  if (restant <= 0) {
    return (
      <p className="mt-3 rounded-xl bg-vert-clair px-3 py-2 text-sm text-vert-fonce">
        Facture entièrement couverte. Aucun encaissement supplémentaire.
      </p>
    );
  }
  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="factureId" value={factureId} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium">
            Montant reçu (restant : {restant.toLocaleString("fr-FR")} F)
          </label>
          <input
            name="montant"
            type="number"
            min={1}
            max={restant}
            step={1}
            required
            className={champ}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Mode</label>
          <select name="mode" className={champ}>
            <option value="especes">Espèces</option>
            <option value="virement">Virement</option>
            <option value="mobile_money">Mobile Money</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium">Note (talon, référence…)</label>
          <input name="note" placeholder="Facultatif" className={champ} />
        </div>
        <button type="submit" disabled={enCours} className={bouton}>
          {enCours ? "…" : "Encaisser"}
        </button>
      </div>
      <Sortie retour={etat} />
    </form>
  );
}

export function FormulaireAnnulation({ paiementId }: { paiementId: number }) {
  const [etat, action, enCours] = useActionState(annulerPaiement, etatInitial);
  return (
    <form action={action} className="inline-flex flex-col gap-1">
      <input type="hidden" name="paiementId" value={paiementId} />
      <div className="flex items-center gap-2">
        <input
          name="motif"
          required
          placeholder="Motif de l'annulation"
          className="w-48 rounded-xl border border-ligne px-3 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={enCours}
          className="rounded-lg border border-rouge/40 px-2.5 py-1.5 text-xs font-medium text-rouge hover:bg-rouge-clair disabled:opacity-60"
        >
          {enCours ? "…" : "Annuler le paiement"}
        </button>
      </div>
      {(etat.erreur || etat.message) && (
        <span className={etat.erreur ? "text-xs text-rouge" : "text-xs text-vert-fonce"}>
          {etat.erreur ?? etat.message}
        </span>
      )}
    </form>
  );
}

export function FormulaireDelegation({
  membres,
  delegues,
}: {
  membres: { id: number; prenom: string; nom: string }[];
  delegues: number[];
}) {
  const [etatPoser, poser, enCoursPoser] = useActionState(deleguerFinances, etatInitial);
  const [etatRetirer, retirer, enCoursRetirer] = useActionState(retirerDelegation, etatInitial);
  const retour = etatPoser.message ?? etatPoser.erreur ?? etatRetirer.message ?? etatRetirer.erreur;
  const elegibles = membres.filter((m) => !delegues.includes(m.id));

  return (
    <div className="rounded-2xl border border-ligne bg-white p-4">
      <p className="text-sm font-semibold">
        Déléguer le rôle finances à un membre de l&apos;équipe
      </p>
      {elegibles.length > 0 && (
        <form action={poser} className="mt-2 flex flex-wrap items-center gap-2">
          <select name="userId" required className="w-64 rounded-xl border border-ligne px-3 py-2 text-sm">
            <option value="">Choisir un enseignant…</option>
            {elegibles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.prenom} {m.nom}
              </option>
            ))}
          </select>
          <button type="submit" disabled={enCoursPoser} className={bouton}>
            {enCoursPoser ? "…" : "Déléguer"}
          </button>
        </form>
      )}
      {delegues.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {delegues.map((id) => {
            const m = membres.find((x) => x.id === id);
            if (!m) return null;
            return (
              <li key={id} className="flex items-center justify-between gap-2">
                <span>
                  {m.prenom} {m.nom}{" "}
                  <span className="text-encre-doux">— tient les finances</span>
                </span>
                <form action={retirer}>
                  <input type="hidden" name="userId" value={id} />
                  <button
                    type="submit"
                    disabled={enCoursRetirer}
                    className="rounded-lg border border-rouge/40 px-2.5 py-1 text-xs font-medium text-rouge hover:bg-rouge-clair"
                  >
                    Retirer
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      {retour && <p className="mt-2 text-xs text-vert-fonce">{retour}</p>}
    </div>
  );
}
