import type { Metadata } from "next";
import Link from "next/link";
import { exiger } from "@/lib/auth";
import { besoinsEnseignement } from "@/lib/outils/ministere";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Besoins d'enseignement" };

/**
 * Les besoins d'enseignement de la nation : les matières du programme
 * sans professeur confié et sans cours posé. La donnée sort du
 * programme réel des classes — rien à déclarer pour l'école.
 */
export default async function PageBesoins({
  searchParams,
}: {
  searchParams: Promise<{ dep?: string }>;
}) {
  await exiger("ministere");
  const { dep = "" } = await searchParams;
  const lignes = await besoinsEnseignement(dep ? dep : undefined);

  const totalMatières = lignes.reduce((s, l) => s + l.matieresNonConfiees, 0);
  const totalClasses = lignes.reduce((s, l) => s + l.classesConcernees, 0);
  const totalSansCours = lignes.reduce((s, l) => s + l.matieresSansCours, 0);
  const totalEcoles = lignes.length;

  /* Le regroupement : département → commune → écoles. */
  const parDepartement = new Map<string, Map<string, typeof lignes>>();
  for (const l of lignes) {
    const parCommune = parDepartement.get(l.departement) ?? new Map();
    const liste = parCommune.get(l.commune) ?? [];
    liste.push(l);
    parCommune.set(l.commune, liste);
    parDepartement.set(l.departement, parCommune);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/ministere", label: "Espace ministère" }]}
        titre="Besoins d'enseignement"
        sousTitre="Une matière est « non confiée » quand aucun professeur ne la porte dans le programme ; « sans cours » quand aucun créneau de l'emploi du temps ne la couvre. Le programme réel des classes dit le besoin, commune par commune."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Carte libelle="Matières non confiées" valeur={String(totalMatières)} />
        <Carte libelle="Matières sans cours posé" valeur={String(totalSansCours)} />
        <Carte libelle="Classes concernées" valeur={String(totalClasses)} />
        <Carte libelle="Écoles concernées" valeur={String(totalEcoles)} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          Établissement par établissement
        </h2>
        {lignes.length === 0 ? (
          <div className="mt-3">
            <EtatVide>
              Aucun besoin détecté : chaque matière du programme a son
              professeur.
            </EtatVide>
          </div>
        ) : (
          <div className="mt-3 space-y-8">
            {[...parDepartement.entries()].map(([departement, parCommune]) => (
              <div key={departement}>
                <h3 className="text-sm font-bold uppercase tracking-wide text-encre-doux">
                  {departement}
                </h3>
                {[...parCommune.entries()].map(([commune, ecoles]) => (
                  <div key={commune} className="mt-3">
                    <p className="text-sm font-medium">{commune}</p>
                    <ul className="mt-1.5 space-y-2">
                      {ecoles.map((e) => (
                        <li key={e.etablissementId} className="rounded-2xl border border-ligne bg-white p-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-semibold">{e.etablissement}</p>
                            <p className="text-xs text-encre-doux">
                              {e.heuresPosees} h hebdomadaires posées
                            </p>
                          </div>
                          <p className="mt-1.5 text-sm">
                            <span className="font-semibold text-rouge">
                              {e.matieresNonConfiees} matière{e.matieresNonConfiees > 1 ? "s" : ""} non
                              confiée{e.matieresNonConfiees > 1 ? "s" : ""}
                            </span>
                            {" : "}
                            {e.nomsNonConfiees}
                          </p>
                          {e.matieresSansCours > 0 && (
                            <p className="mt-1 text-sm text-encre-doux">
                              Dont {e.matieresSansCours} sans aucun cours posé à
                              l&apos;emploi du temps.
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
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
