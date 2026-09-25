import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, devoirs, enseignements, inscriptions, matieres, users, adhesionsClasse } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { droitsClasse } from "@/lib/espace";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import { FormulaireDevoir } from "../emploi-du-temps/formulaire-creneau";

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
  const utilisateur = await exiger("direction", "enseignant", "parent", "eleve");
  if (!Number.isInteger(idClasse)) notFound();

  const [classe] = await db
    .select({ id: classes.id, nom: classes.nom })
    .from(classes)
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) notFound();

  // L'espace est fermé : la place dans la classe décide de l'accès.
  const droits = await droitsClasse(idClasse, utilisateur);
  if (!droits.lire) notFound();

  // Qui peut donner un devoir ici : la direction, l'enseignant
  // (avec SES matières seulement) ou l'élève délégué.
  let peutCreer = droits.publier;
  let matieresCreer: { id: number; nom: string }[] = [];
  if (peutCreer) {
    matieresCreer = await db
      .select({ id: matieres.id, nom: matieres.nom })
      .from(matieres)
      .where(eq(matieres.classeId, idClasse))
      .orderBy(asc(matieres.nom));
  }
  if (utilisateur.role === "enseignant" && peutCreer) {
    const sesAttributions = await db
      .select({ id: matieres.id, nom: matieres.nom })
      .from(enseignements)
      .innerJoin(matieres, eq(matieres.id, enseignements.matiereId))
      .where(
        and(
          eq(enseignements.classeId, idClasse),
          eq(enseignements.enseignantUserId, utilisateur.id),
        ),
      )
      .orderBy(asc(matieres.nom));
    if (sesAttributions.length > 0) matieresCreer = sesAttributions;
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

      {peutCreer && (
        <section className="mt-6 rounded-2xl border border-ligne bg-white p-5">
          <h2 className="font-semibold">Donner un devoir</h2>
          <p className="mt-1 text-sm text-encre-doux">
            Il part au cahier de textes de la classe, dans le fil des
            membres, au calendrier des élèves, et prévient les parents.
          </p>
          <div className="mt-3">
            <FormulaireDevoir classeId={idClasse} matieres={matieresCreer} />
          </div>
        </section>
      )}

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
