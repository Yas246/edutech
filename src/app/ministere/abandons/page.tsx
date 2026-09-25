import type { Metadata } from "next";
import Link from "next/link";
import { exiger } from "@/lib/auth";
import {
  elevesAbandonnes,
  tauxAbandons,
  type LigneAbandon,
} from "@/lib/outils/ministere";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Abandon scolaire" };

function dateFrancaise(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/**
 * Les présomptions d'abandon : la cessation complète et prolongée de
 * présence, détectée toute seule par les appels que les écoles font
 * déjà. Le ministère ne collecte rien : la donnée remonte de la vie
 * ordinaire des classes.
 */
export default async function PageAbandons({
  searchParams,
}: {
  searchParams: Promise<{ dep?: string }>;
}) {
  await exiger("ministere");
  const { dep = "" } = await searchParams;

  const lignes = await tauxAbandons();
  const detail = await elevesAbandonnes(dep ? dep : undefined);

  const total = lignes.reduce((s, l) => s + l.presumptions, 0);
  const garcons = lignes.reduce((s, l) => s + l.garcons, 0);
  const filles = lignes.reduce((s, l) => s + l.filles, 0);
  const inscrits = lignes.reduce((s, l) => s + l.inscrits, 0);

  /* Le regroupement : département → commune → élèves. */
  const parDepartement = new Map<string, LigneAbandon[]>();
  for (const a of detail) {
    const liste = parDepartement.get(a.departement) ?? [];
    liste.push(a);
    parDepartement.set(a.departement, liste);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/ministere", label: "Espace ministère" }]}
        titre="Abandon scolaire"
        sousTitre="Un élève est présumé en abandon quand il ne figure plus à aucun appel depuis plus de 14 jours, pendant que sa classe continue d'être pointée. La détection est automatique : elle suit les appels ordinaires des écoles."
      />

      {/* Les KPI nationaux */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Carte libelle="Présomptions d'abandon" valeur={String(total)} />
        <Carte
          libelle="Part de l'effectif suivi"
          valeur={inscrits > 0 ? `${((1000 * total) / inscrits).toFixed(1).replace(".", ",")} ‰` : "—"}
        />
        <Carte libelle="Garçons" valeur={String(garcons)} />
        <Carte libelle="Filles" valeur={String(filles)} />
      </div>

      {/* Le tableau par département */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Par département</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-ligne bg-white">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2.5 font-medium">Département</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Inscrits</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Présumés en abandon</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Garçons</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Filles</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Taux</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.departement} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{l.departement}</td>
                  <td className="px-4 py-2.5">{l.inscrits}</td>
                  <td className="px-4 py-2.5 font-semibold">{l.presumptions}</td>
                  <td className="px-4 py-2.5">{l.garcons}</td>
                  <td className="px-4 py-2.5">{l.filles}</td>
                  <td className="px-4 py-2.5">{l.taux === null ? "—" : `${String(l.taux).replace(".", ",")} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Le détail des élèves */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          Les élèves présumés en abandon ({detail.length})
        </h2>
        {detail.length === 0 ? (
          <div className="mt-3">
            <EtatVide>
              Aucune présomption d&apos;abandon pour l&apos;instant : chaque
              élève suivi figure encore aux appels de sa classe.
            </EtatVide>
          </div>
        ) : (
          <div className="mt-3 space-y-8">
            {[...parDepartement.entries()].map(([departement, eleves]) => (
              <div key={departement}>
                <h3 className="text-sm font-bold uppercase tracking-wide text-encre-doux">
                  {departement}
                </h3>
                <div className="mt-2 overflow-x-auto rounded-2xl border border-ligne bg-white">
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="border-b border-ligne text-left text-encre-doux">
                        <th scope="col" className="px-4 py-2.5 font-medium">Élève</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Classe</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Établissement</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Commune</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Dernière présence</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Jours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eleves.map((a) => (
                        <tr key={`${a.eleveId}-${a.classeId}`} className="border-b border-ligne/60 last:border-0">
                          <td className="px-4 py-2.5 font-medium">
                            {a.prenom} {a.nom}
                            <span className="ml-2 text-xs text-encre-doux">
                              {a.sexe === "F" ? "fille" : a.sexe === "M" ? "garçon" : ""}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">{a.classe}</td>
                          <td className="px-4 py-2.5">{a.etablissement}</td>
                          <td className="px-4 py-2.5">{a.commune}</td>
                          <td className="px-4 py-2.5">{dateFrancaise(a.dernierePresence)}</td>
                          <td className="px-4 py-2.5 font-semibold text-rouge">{a.joursAbsence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-sm text-encre-doux">
        <Link href="/ministere" className="text-vert underline hover:text-vert-fonce">
          Retour à l&apos;espace ministère
        </Link>
      </p>
    </div>
  );
}

function Carte({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="rounded-2xl border border-ligne bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-encre-doux">{libelle}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{valeur}</p>
    </div>
  );
}
