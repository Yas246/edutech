import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { etablissements, periodes } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { Badge } from "@/components/ui/badge";
import { enregistrerParametres, rendrePeriodeActive } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Paramètres de l'école" };

const LIBELLES: Record<number, string> = {
  1: "Annuel",
  2: "Semestriel",
  3: "Trimestriel",
  4: "Quadrimestriel",
  5: "Pentamestral",
  6: "Hexamestral",
};

export default async function ParametresEcole() {
  const utilisateur = await exiger("direction");
  const [ecole] = await db
    .select()
    .from(etablissements)
    .where(eq(etablissements.directionUserId, utilisateur.id))
    .limit(1);
  if (!ecole) redirect("/tableau-de-bord");

  const mesPeriodes = await db
    .select()
    .from(periodes)
    .where(eq(periodes.etablissementId, ecole.id))
    .orderBy(asc(periodes.id));

  const enregistrer = async (donnees: FormData) => {
    "use server";
    const { enregistrerParametres } = await import("./actions");
    await enregistrerParametres({}, donnees);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/mon-ecole", label: ecole.nom }]}
        titre="Paramètres de l'école"
        sousTitre="Le découpage de l'année et l'échelle des moyennes sont propres à chaque établissement. Une seule période est active à la fois : le passage est un geste explicite."
      />

      <form
        action={enregistrer}
        className="mt-8 space-y-4 rounded-2xl border border-ligne bg-white p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="param-periodicite" className="block text-sm font-medium">
              Découpage de l&apos;année
            </label>
            <select
              id="param-periodicite"
              name="periodicite"
              defaultValue={ecole.periodicite}
              className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {LIBELLES[n]} — {n} période{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="param-echelle" className="block text-sm font-medium">
              Échelle des moyennes
            </label>
            <input
              id="param-echelle"
              name="echelle"
              inputMode="decimal"
              defaultValue={Number(ecole.echelle)}
              className="mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-encre-doux">
              10, 20, 100 : toutes les moyennes de l&apos;école s&apos;y
              ramènent, les notes gardant leur propre barème.
            </p>
          </div>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
        >
          Enregistrer et préparer les périodes
        </button>
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">Les périodes</h2>
        <p className="mt-1 text-sm text-encre-doux">
          La période active fixe le cadre des bulletins et des moyennes.
          Passer à la suivante est un geste explicite ; revenir en arrière ne
          perd rien.
        </p>
        <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
          {mesPeriodes.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{p.nom}</p>
                <p className="text-sm text-encre-doux">
                  du {p.debut} au {p.fin}
                </p>
              </div>
              {p.active ? (
                <Badge ton="vert">Active</Badge>
              ) : (
                <form action={rendrePeriodeActive}>
                  <input type="hidden" name="periodeId" value={p.id} />
                  <button
                    type="submit"
                    className="rounded-xl border border-ligne px-4 py-1.5 text-sm font-medium hover:bg-papier"
                  >
                    Rendre active
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
