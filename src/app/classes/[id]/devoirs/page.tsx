import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, devoirs, inscriptions, liensFamille, matieres, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";

export const metadata: Metadata = { title: "Cahier de textes" };

function formaterDate(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

export default async function CahierDeTextes({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  const utilisateur = await exiger("direction", "enseignant", "parent", "eleve", "ministere");
  if (!Number.isInteger(idClasse)) notFound();

  const [classe] = await db
    .select({ id: classes.id, nom: classes.nom })
    .from(classes)
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) notFound();

  // Les élèves et les parents n'ont accès qu'au cahier de LEUR classe.
  if (utilisateur.role === "eleve") {
    const [inscription] = await db
      .select({ id: inscriptions.id })
      .from(inscriptions)
      .where(
        and(eq(inscriptions.classeId, idClasse), eq(inscriptions.eleveUserId, utilisateur.id)),
      )
      .limit(1);
    if (!inscription) notFound();
  }
  if (utilisateur.role === "parent") {
    const [lien] = await db
      .select({ id: liensFamille.id })
      .from(liensFamille)
      .innerJoin(inscriptions, eq(inscriptions.eleveUserId, liensFamille.eleveUserId))
      .where(
        and(
          eq(liensFamille.parentUserId, utilisateur.id),
          eq(inscriptions.classeId, idClasse),
        ),
      )
      .limit(1);
    if (!lien) notFound();
  }

  const liste = await db
    .select({
      id: devoirs.id,
      titre: devoirs.titre,
      consigne: devoirs.consigne,
      donneLe: devoirs.donneLe,
      aRendreLe: devoirs.aRendreLe,
      matiere: matieres.nom,
      enseignantPrenom: users.prenom,
      enseignantNom: users.nom,
    })
    .from(devoirs)
    .innerJoin(matieres, eq(matieres.id, devoirs.matiereId))
    .innerJoin(users, eq(users.id, devoirs.enseignantUserId))
    .where(eq(devoirs.classeId, idClasse))
    .orderBy(asc(devoirs.aRendreLe));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        fil={[{ href: `/classes/${classe.id}`, label: classe.nom }]}
        titre={`Cahier de textes de ${classe.nom}`}
        sousTitre="Les devoirs donnés, dans l'ordre des remises. Les familles y accèdent depuis leur espace."
      />

      {liste.length === 0 ? (
        <div className="mt-8">
          <EtatVide>
            Aucun devoir pour l&apos;instant. Les enseignants les posent depuis
            l&apos;emploi du temps.
          </EtatVide>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {liste.map((d) => (
            <li key={d.id} className="rounded-2xl border border-ligne bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {d.matiere} : {d.titre}
                </h2>
                <p className="text-sm text-encre-doux">
                  à rendre le {formaterDate(d.aRendreLe)}
                </p>
              </div>
              {d.consigne && <p className="mt-2 text-sm">{d.consigne}</p>}
              <p className="mt-2 text-xs text-encre-doux">
                Donné le {formaterDate(d.donneLe)} par {d.enseignantPrenom} {d.enseignantNom}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm text-encre-doux">
        <Link
          href={`/classes/${classe.id}/emploi-du-temps`}
          className="text-vert underline hover:text-vert-fonce"
        >
          Voir l&apos;emploi du temps
        </Link>
      </p>
    </div>
  );
}
