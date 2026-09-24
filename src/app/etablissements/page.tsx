import type { Metadata } from "next";
import Link from "next/link";
import {
  departements,
  libelleType,
  recensement,
  type EtablissementRecense,
} from "@/lib/recensement";

export const metadata: Metadata = {
  title: "Annuaire des établissements",
  description:
    "Les établissements d'enseignement du Bénin recensés : CEG, collèges, lycées et établissements du supérieur, par commune et département.",
};

const LIMITE = 100;

function normaliser(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default async function Annuaire({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dep?: string }>;
}) {
  const { q = "", dep = "" } = await searchParams;
  const terme = normaliser(q.trim());

  const resultats = recensement.filter((e) => {
    if (dep && e.departement !== dep) return false;
    if (!terme) return true;
    return (
      normaliser(e.nom).includes(terme) ||
      normaliser(e.commune).includes(terme) ||
      normaliser(e.quartier).includes(terme)
    );
  });

  const affiches = resultats.slice(0, LIMITE);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Annuaire des établissements</h1>
      <p className="mt-2 max-w-2xl text-encre-doux">
        {recensement.length} établissements du recensement national, dans{" "}
        {departements.length} départements. Cherchez par nom, commune ou quartier.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="q" className="block text-sm font-medium">
            Recherche
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Ex. Cotonou, CEG, lycée…"
            className="mt-1 w-64 rounded-xl border border-ligne bg-white px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="dep" className="block text-sm font-medium">
            Département
          </label>
          <select
            id="dep"
            name="dep"
            defaultValue={dep}
            className="mt-1 w-56 rounded-xl border border-ligne bg-white px-3 py-2"
          >
            <option value="">Tous</option>
            {departements.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-vert px-4 py-2 font-medium text-white hover:bg-vert-fonce"
        >
          Filtrer
        </button>
      </form>

      <p className="mt-6 text-sm text-encre-doux" aria-live="polite">
        {resultats.length} résultat{resultats.length > 1 ? "s" : ""}
        {resultats.length > LIMITE &&
          ` — les ${LIMITE} premiers affichés, affinez la recherche pour voir la suite`}
      </p>

      {resultats.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-ligne bg-white p-8 text-center text-encre-doux">
          Aucun établissement ne correspond. Essayez un autre nom ou changez de département.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {affiches.map((e: EtablissementRecense) => (
            <li key={`${e.nom}-${e.commune}`} className="rounded-2xl border border-ligne bg-white p-4">
              <p className="font-semibold">{e.nom}</p>
              <p className="mt-1 text-sm text-encre-doux">
                {libelleType[e.type] ?? e.type} · {e.commune} ({e.departement})
              </p>
              <p className="mt-2 text-xs uppercase tracking-wide text-encre-doux">
                {e.statut || "statut non précisé"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 text-sm text-encre-doux">
        Une direction d&apos;établissement n&apos;est pas encore sur la plateforme ?{" "}
        <Link href="/inscription" className="font-medium text-vert underline hover:text-vert-fonce">
          Créez le compte de votre école
        </Link>
        , le ministère la valide.
      </p>
    </div>
  );
}
