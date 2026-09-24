import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, enseignements, etablissements, inscriptions, matieres, users } from "@/db/schema";

export const metadata: Metadata = { title: "Classe" };

export default async function PageClasse({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  if (!Number.isInteger(idClasse)) notFound();

  const [classe] = await db
    .select({
      id: classes.id,
      nom: classes.nom,
      niveau: classes.niveau,
      annee: classes.anneeScolaire,
      etabId: etablissements.id,
      etabNom: etablissements.nom,
      commune: etablissements.commune,
    })
    .from(classes)
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) notFound();

  const programme = await db
    .select({
      id: matieres.id,
      nom: matieres.nom,
      coefficient: matieres.coefficient,
      enseignantPrenom: users.prenom,
      enseignantNom: users.nom,
    })
    .from(matieres)
    .leftJoin(enseignements, eq(enseignements.matiereId, matieres.id))
    .leftJoin(users, eq(users.id, enseignements.enseignantUserId))
    .where(eq(matieres.classeId, idClasse))
    .orderBy(asc(matieres.nom));

  const eleves = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(inscriptions)
    .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, idClasse))
    .orderBy(asc(users.nom));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="text-sm text-encre-doux">
        <Link href="/etablissements" className="underline hover:text-vert">
          Établissements
        </Link>{" "}
        · {classe.etabNom}, {classe.commune}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        {classe.nom}{" "}
        <span className="text-lg font-normal text-encre-doux">
          ({classe.niveau}) · {classe.annee}
        </span>
      </h1>

      <section className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">
          Programme ({programme.length} matières)
        </h2>
        {programme.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
            Le programme de cette classe n&apos;est pas encore posé.
          </p>
        ) : (
          <table className="mt-3 w-full rounded-2xl border border-ligne bg-white text-sm">
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Matière</th>
                <th scope="col" className="px-4 py-2 font-medium">Coefficient</th>
                <th scope="col" className="px-4 py-2 font-medium">Enseignant</th>
              </tr>
            </thead>
            <tbody>
              {programme.map((m) => (
                <tr key={m.id} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{m.nom}</td>
                  <td className="px-4 py-2">{m.coefficient}</td>
                  <td className="px-4 py-2 text-encre-doux">
                    {m.enseignantPrenom
                      ? `${m.enseignantPrenom} ${m.enseignantNom}`
                      : "À confier"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">
          Élèves ({eleves.length})
        </h2>
        {eleves.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
            Aucun élève inscrit pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {eleves.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-ligne bg-white px-4 py-2 text-sm"
              >
                {e.prenom} {e.nom}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
