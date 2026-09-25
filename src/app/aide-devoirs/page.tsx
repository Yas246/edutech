import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, devoirs, inscriptions, matieres } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aide devoirs" };

function jour(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/**
 * L'aide devoirs : la liste des devoirs en cours de mes classes, et
 * un fil de discussion par devoir avec le tuteur, qui guide sans
 * jamais donner la solution.
 */
export default async function PageAideDevoirs() {
  const utilisateur = await exiger("eleve");

  const mes = await db
    .select({
      id: devoirs.id,
      titre: devoirs.titre,
      aRendreLe: devoirs.aRendreLe,
      matiere: matieres.nom,
      classe: classes.nom,
    })
    .from(devoirs)
    .innerJoin(matieres, eq(matieres.id, devoirs.matiereId))
    .innerJoin(classes, eq(classes.id, devoirs.classeId))
    .innerJoin(inscriptions, eq(inscriptions.classeId, devoirs.classeId))
    .where(
      and(
        eq(inscriptions.eleveUserId, utilisateur.id),
        gte(devoirs.aRendreLe, sql`CURRENT_DATE - INTERVAL '7 days'`),
      ),
    )
    .orderBy(asc(devoirs.aRendreLe))
    .limit(40);

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage titre="Aide devoirs" />

      <div className="mt-4 rounded-2xl border border-vert/30 bg-vert-clair/50 p-4 text-sm">
        <p className="font-semibold text-vert-fonce">La règle du tuteur</p>
        <p className="mt-1">
          Le tuteur vous guide par des questions et des indices : il ne
          donne jamais la solution. C&apos;est vous qui trouvez, étape par
          étape.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">Mes devoirs en cours</h2>
        {mes.length === 0 ? (
          <div className="mt-3">
            <EtatVide>
              Aucun devoir en cours : rejoignez une classe et attendez le
              premier devoir du professeur.
            </EtatVide>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {mes.map((d) => {
              const enRetard = d.aRendreLe < aujourdhui;
              return (
                <li key={d.id}>
                  <Link
                    href={`/aide-devoirs/${d.id}`}
                    className="block rounded-2xl border border-ligne bg-white p-5 transition hover:border-vert/40 hover:bg-vert-clair/30"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold">
                        {d.matiere} : {d.titre}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          enRetard ? "bg-rouge-clair text-rouge" : "bg-jaune-clair text-encre"
                        }`}
                      >
                        {enRetard ? "en retard — " : ""}pour le {jour(d.aRendreLe)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-encre-doux">
                      {d.classe} · Ouvrir le fil d&apos;aide
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
