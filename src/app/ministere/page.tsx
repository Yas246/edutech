import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { etablissements, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { BoutonsValidation } from "./formulaire-validation";
import { statistiquesDepartement } from "@/lib/outils/ministere";
import { FormulaireEmploye } from "./employes";
import { AgentsListe } from "./agents-liste";

export const metadata: Metadata = { title: "Espace ministère" };

const TAILLE_PAGE = 50;

export default async function EspaceMinistere({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await exiger("ministere");
  const { q = "", page = "1" } = await searchParams;
  const terme = q.trim();
  const numeroPage = Math.max(1, Number(page) || 1);

  const [totalValidé] = await db
    .select({ n: count() })
    .from(etablissements)
    .where(eq(etablissements.statut, "valide"));
  const [totalAttente] = await db
    .select({ n: count() })
    .from(etablissements)
    .where(eq(etablissements.statut, "en_attente"));
  const [totalRefuse] = await db
    .select({ n: count() })
    .from(etablissements)
    .where(eq(etablissements.statut, "refuse"));

  const conditions = [eq(etablissements.statut, "en_attente")];
  if (terme) conditions.push(ilike(etablissements.nom, `%${terme}%`));

  const file = await db
    .select({
      id: etablissements.id,
      nom: etablissements.nom,
      commune: etablissements.commune,
      departement: etablissements.departement,
      type: etablissements.type,
      statutAdmin: etablissements.statutAdmin,
      etatRecensement: etablissements.etatRecensement,
      dernierePreuve: etablissements.dernierePreuve,
    })
    .from(etablissements)
    .where(and(...conditions))
    .orderBy(asc(etablissements.nom))
    .limit(TAILLE_PAGE)
    .offset((numeroPage - 1) * TAILLE_PAGE);

  const libellesType: Record<string, string> = {
    ceg: "CEG",
    college: "Collège",
    lycee: "Lycée",
    technique: "Technique",
    superieur: "Supérieur",
    autre: "Autre",
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Espace ministère</h1>
      <p className="mt-2 max-w-2xl text-encre-doux">
        Le ministère garde la main sur le réseau des établissements : il valide
        ceux qui entrent sur la plateforme et lit la nation. Les finances
        scolaires restent entre l&apos;école et la famille.
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <dt className="text-sm text-encre-doux">Validés</dt>
          <dd className="text-2xl font-bold text-vert">{totalValidé.n}</dd>
        </div>
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <dt className="text-sm text-encre-doux">En attente</dt>
          <dd className="text-2xl font-bold text-encre">{totalAttente.n}</dd>
        </div>
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <dt className="text-sm text-encre-doux">Refusés</dt>
          <dd className="text-2xl font-bold text-rouge">{totalRefuse.n}</dd>
        </div>
      </dl>

      {/* Statistiques nationales */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">La nation, département par département</h2>
        <p className="mt-1 text-sm text-encre-doux">
          Le recouvrement est un pourcentage global : les montants restent entre l'école et la famille.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] rounded-2xl border border-ligne bg-white text-sm">
            <caption className="sr-only">Statistiques par département</caption>
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Département</th>
                <th scope="col" className="px-4 py-2 font-medium">Écoles validées</th>
                <th scope="col" className="px-4 py-2 font-medium">Élèves inscrits</th>
                <th scope="col" className="px-4 py-2 font-medium">Absentéisme (non justifiés)</th>
                <th scope="col" className="px-4 py-2 font-medium">Recouvrement</th>
              </tr>
            </thead>
            <tbody>
              {(await statistiquesDepartement()).map((d) => (
                <tr key={d.departement} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{d.departement}</td>
                  <td className="px-4 py-2">{d.etablissements}</td>
                  <td className="px-4 py-2">{d.eleves}</td>
                  <td className="px-4 py-2">{d.tauxAbsenteisme === null ? "—" : d.tauxAbsenteisme + " %"}</td>
                  <td className="px-4 py-2">{d.tauxRecouvrement === null ? "—" : d.tauxRecouvrement + " %"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          <Link href="/ministere/apprenants" className="text-sm font-medium text-vert underline hover:text-vert-fonce">
            Consulter les apprenants (lecture seule)
          </Link>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Agents du ministère</h2>
        <p className="mt-1 text-sm text-encre-doux">
          Vos collègues ont les mêmes pouvoirs : valider les écoles et lire la nation.
        </p>
        <FormulaireEmploye />
        <AgentsListe />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          File de validation ({totalAttente.n})
        </h2>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3" role="search">
          <div>
            <label htmlFor="q" className="block text-sm font-medium">
              Rechercher dans la file
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={terme}
              placeholder="Nom de l'établissement"
              className="mt-1 w-72 rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
          >
            Rechercher
          </button>
        </form>

        {file.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
            Rien dans la file pour cette recherche.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
            {file.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{e.nom}</p>
                  <p className="text-sm text-encre-doux">
                    {libellesType[e.type] ?? e.type} · {e.commune} ({e.departement}) ·{" "}
                    {e.statutAdmin === "prive" ? "privé" : "public"} · preuve {e.dernierePreuve || "ancienne"}
                  </p>
                </div>
                <BoutonsValidation id={e.id} />
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-sm text-encre-doux">
          {file.length} affiché{file.length > 1 ? "s" : ""} sur {totalAttente.n} —{" "}
          {numeroPage > 1 && (
            <Link
              href={`/ministere?q=${encodeURIComponent(terme)}&page=${numeroPage - 1}`}
              className="text-vert underline"
            >
              page précédente
            </Link>
          )}
          {" "}
          {file.length === TAILLE_PAGE && (
            <Link
              href={`/ministere?q=${encodeURIComponent(terme)}&page=${numeroPage + 1}`}
              className="text-vert underline"
            >
              page suivante
            </Link>
          )}
        </p>
      </section>
    </div>
  );
}
