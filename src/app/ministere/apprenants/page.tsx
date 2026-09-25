import type { Metadata } from "next";
import Link from "next/link";
import { exiger } from "@/lib/auth";
import { consulterApprenants, statistiquesDepartement } from "@/lib/outils/ministere";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Suivi des apprenants" };

const requetesPossibles = [
  { valeur: "", titre: "Tous les apprenants" },
  { valeur: "excellents", titre: "Moyenne générale >= 15" },
  { valeur: "absents", titre: "Élèves ayant des absences non justifiées" },
];

export default async function Apprenants({
  searchParams,
}: {
  searchParams: Promise<{ dep?: string; requete?: string }>;
}) {
  await exiger("ministere");
  const { dep = "", requete = "" } = await searchParams;

  const departements = (await statistiquesDepartement()).map((d) => d.departement);
  const liste = await consulterApprenants({
    departement: dep || undefined,
    requete: requete === "excellents" || requete === "absents" ? requete : undefined,
  });

  function classeMoyenne(m: number | null) {
    if (m === null) return "text-encre-doux";
    if (m >= 14) return "text-vert";
    if (m >= 10) return "text-encre";
    return "text-rouge";
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/ministere", label: "Espace ministère" }]}
        titre="Suivi des apprenants"
        sousTitre="La consultation en lecture seule : résultats et assiduité. Les finances scolaires ne figurent jamais ici."
      />

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="dep" className="block text-sm font-medium">Département</label>
          <select id="dep" name="dep" defaultValue={dep} className="mt-1 w-52 rounded-xl border border-ligne bg-white px-3 py-2 text-sm">
            <option value="">Tous</option>
            {departements.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="requete" className="block text-sm font-medium">Requête prête</label>
          <select id="requete" name="requete" defaultValue={requete} className="mt-1 w-72 rounded-xl border border-ligne bg-white px-3 py-2 text-sm">
            {requetesPossibles.map((r) => (
              <option key={r.valeur} value={r.valeur}>{r.titre}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce">
          Appliquer
        </button>
      </form>

      {liste.length === 0 ? (
        <div className="mt-8">
          <EtatVide>Aucun apprenant ne correspond à ces filtres.</EtatVide>
        </div>
      ) : (
        <table className="mt-6 w-full rounded-2xl border border-ligne bg-white text-sm">
          <caption className="sr-only">Apprenants</caption>
          <thead>
            <tr className="border-b border-ligne text-left text-encre-doux">
              <th scope="col" className="px-4 py-2 font-medium">Apprenant</th>
              <th scope="col" className="px-4 py-2 font-medium">Classe</th>
              <th scope="col" className="px-4 py-2 font-medium">Établissement</th>
              <th scope="col" className="px-4 py-2 font-medium" title="Moyenne brute de toutes les évaluations, indicateur national non pondéré">Moyenne indicative</th>
              <th scope="col" className="px-4 py-2 font-medium">Absences non justifiées</th>
              <th scope="col" className="px-4 py-2">
                <span className="sr-only">Bulletin</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {liste.map((a) => (
              <tr key={`${a.eleveId}-${a.classeId}`} className="border-b border-ligne/60 last:border-0">
                <td className="px-4 py-2 font-medium">
                  {a.prenom} {a.nom}
                </td>
                <td className="px-4 py-2">{a.classe}</td>
                <td className="px-4 py-2 text-encre-doux">
                  {a.etablissement} ({a.departement})
                </td>
                <td className={`px-4 py-2 font-semibold ${classeMoyenne(a.moyenne)}`}>
                  {a.moyenne === null ? "—" : a.moyenne}
                </td>
                <td className={`px-4 py-2 ${a.absences > 0 ? "text-rouge font-medium" : ""}`}>
                  {a.absences}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/classes/${a.classeId}/bulletins/${a.eleveId}`}
                    className="text-xs font-medium text-vert underline hover:text-vert-fonce"
                  >
                    Bulletin
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-xs text-encre-doux">
        {liste.length} apprenant{liste.length > 1 ? "s" : ""} affiché
        {liste.length > 1 ? "s" : ""} (100 au maximum). Le lien bulletin
        n'ouvre que les bulletins déjà publiés par l'établissement.
      </p>
    </div>
  );
}

