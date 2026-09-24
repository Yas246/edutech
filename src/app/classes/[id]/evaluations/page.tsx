import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  evaluations,
  inscriptions,
  matieres,
  notes,
  users,
} from "@/db/schema";
import { gardeClasse } from "@/lib/garde-classe";
import FormulaireEvaluation from "./formulaire-evaluation";
import FormulaireNotes from "./formulaire-notes";

export const metadata: Metadata = { title: "Évaluations" };

function aujourdhui() {
  const m = new Date();
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
}

export default async function PageEvaluations({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  const contexte = await gardeClasse(idClasse);
  if (!contexte) redirect("/tableau-de-bord");
  const classe = contexte.classe;

  const programme = await db
    .select({ id: matieres.id, nom: matieres.nom })
    .from(matieres)
    .where(eq(matieres.classeId, idClasse))
    .orderBy(asc(matieres.nom));

  const liste = await db
    .select({
      id: evaluations.id,
      titre: evaluations.titre,
      type: evaluations.type,
      bareme: evaluations.bareme,
      date: evaluations.date,
      matiere: matieres.nom,
    })
    .from(evaluations)
    .innerJoin(matieres, eq(matieres.id, evaluations.matiereId))
    .where(eq(evaluations.classeId, idClasse))
    .orderBy(asc(evaluations.date), asc(evaluations.id));

  const eleves = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(inscriptions)
    .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, idClasse))
    .orderBy(asc(users.nom));

  const toutesNotes = await db
    .select({
      evaluationId: notes.evaluationId,
      eleveUserId: notes.eleveUserId,
      valeur: notes.valeur,
    })
    .from(notes)
    .innerJoin(evaluations, eq(evaluations.id, notes.evaluationId))
    .where(eq(evaluations.classeId, idClasse));

  const notesParEvaluation = new Map<number, Record<number, string>>();
  for (const n of toutesNotes) {
    const sac = notesParEvaluation.get(n.evaluationId) ?? {};
    sac[n.eleveUserId] = n.valeur.replace(".", ",");
    notesParEvaluation.set(n.evaluationId, sac);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="text-sm text-encre-doux">
        <Link href={`/classes/${classe.id}`} className="underline hover:text-vert">
          {classe.nom}
        </Link>{" "}
        · évaluations
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        Évaluations de {classe.nom}
      </h1>

      <FormulaireEvaluation
        classeId={classe.id}
        matieres={programme}
        dateParDefaut={aujourdhui()}
      />

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          Évaluations ({liste.length})
        </h2>
        {liste.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
            Aucune évaluation pour l&apos;instant. Créez la première ci-dessus.
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {liste.map((e) => (
              <article key={e.id} className="rounded-2xl border border-ligne bg-white p-5">
                <h3 className="font-semibold">
                  {e.titre}{" "}
                  <span className="text-sm font-normal text-encre-doux">
                    {e.matiere} · {e.type === "devoir" ? "Devoir" : "Interrogation"} ·{" "}
                    barème {e.bareme} · le {e.date}
                  </span>
                </h3>
                <FormulaireNotes
                  evaluationId={e.id}
                  eleves={eleves}
                  notesExistantes={notesParEvaluation.get(e.id) ?? {}}
                  bareme={e.bareme}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
