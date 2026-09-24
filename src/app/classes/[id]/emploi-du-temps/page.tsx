import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, creneaux, enseignements, matieres, salles, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { jours, libelleJour } from "@/lib/vie-scolaire";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import FormulaireCreneau, { FormulaireDevoir } from "./formulaire-creneau";

export const metadata: Metadata = { title: "Emploi du temps" };

const heuresGrille = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

export default async function PageEmploiDuTemps({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  const utilisateur = await exiger("direction", "enseignant", "parent", "eleve", "ministere");
  if (!Number.isInteger(idClasse)) redirect("/tableau-de-bord");

  const [classe] = await db
    .select({
      id: classes.id,
      nom: classes.nom,
      etablissementId: classes.etablissementId,
    })
    .from(classes)
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) notFound();

  const programme = await db
    .select({ id: matieres.id, nom: matieres.nom })
    .from(matieres)
    .where(eq(matieres.classeId, idClasse))
    .orderBy(asc(matieres.nom));

  const attributions = await db
    .select({
      matiereId: enseignements.matiereId,
      enseignantId: users.id,
      enseignantPrenom: users.prenom,
      enseignantNom: users.nom,
    })
    .from(enseignements)
    .innerJoin(users, eq(users.id, enseignements.enseignantUserId))
    .where(eq(enseignements.classeId, idClasse));

  const programmeComplet = programme.map((m) => ({
    ...m,
    enseignants: attributions
      .filter((a) => a.matiereId === m.id)
      .map((a) => ({ id: a.enseignantId, prenom: a.enseignantPrenom, nom: a.enseignantNom })),
  }));

  const grille = await db
    .select({
      id: creneaux.id,
      jour: creneaux.jour,
      heureDebut: creneaux.heureDebut,
      heureFin: creneaux.heureFin,
      matiere: matieres.nom,
      enseignant: users.prenom,
      enseignantNom: users.nom,
      salle: salles.nom,
    })
    .from(creneaux)
    .innerJoin(matieres, eq(matieres.id, creneaux.matiereId))
    .innerJoin(users, eq(users.id, creneaux.enseignantUserId))
    .innerJoin(salles, eq(salles.id, creneaux.salleId))
    .where(eq(creneaux.classeId, idClasse));

  const peutGerer = utilisateur.role === "direction";

  // Les salles de l'établissement (pour la pose d'un créneau).
  const listeSalles = peutGerer
    ? await db
        .select({ id: salles.id, nom: salles.nom })
        .from(salles)
        .where(eq(salles.etablissementId, classe.etablissementId))
        .orderBy(asc(salles.nom))
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <EnTetePage
        fil={[{ href: `/classes/${classe.id}`, label: classe.nom }]}
        titre={`Emploi du temps de ${classe.nom}`}
        sousTitre="Un même créneau ne peut pas se poser deux fois : ni dans une salle, ni pour un enseignant, ni pour une classe."
      />

      {grille.length === 0 ? (
        <div className="mt-8">
          <EtatVide>
            L&apos;emploi du temps est vide. La direction pose les créneaux.
          </EtatVide>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">Grille hebdomadaire</caption>
            <thead>
              <tr>
                <th scope="col" className="w-20 border border-ligne bg-papier px-2 py-2 text-left text-encre-doux">
                  Heure
                </th>
                {jours.map((j) => (
                  <th
                    key={j.valeur}
                    scope="col"
                    className="border border-ligne bg-vert-clair px-2 py-2 text-vert-fonce"
                  >
                    {j.titre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heuresGrille.map((h) => (
                <tr key={h}>
                  <th scope="row" className="border border-ligne bg-papier px-2 py-2 text-left font-normal text-encre-doux">
                    {h}
                  </th>
                  {jours.map((j) => {
                    const cellules = grille.filter(
                      (c) => c.jour === j.valeur && c.heureDebut <= h && h < c.heureFin,
                    );
                    return (
                      <td key={j.valeur} className="border border-ligne align-top">
                        {cellules.map((c) => (
                          <div
                            key={c.id}
                            className="bg-vert-clair/60 px-2 py-1 text-xs leading-tight"
                          >
                            <span className="font-semibold text-vert-fonce">{c.matiere}</span>
                            <br />
                            <span className="text-encre-doux">
                              {c.heureDebut}–{c.heureFin} · {c.salle} · {c.enseignant} {c.enseignantNom}
                            </span>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {peutGerer && listeSalles.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Poser un créneau</h2>
          <FormulaireCreneau
            classeId={classe.id}
            matieres={programmeComplet}
            salles={listeSalles}
          />
        </section>
      )}

      {grille.length > 0 && peutGerer && (
        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">Retirer un créneau</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {grille
              .sort((a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut))
              .map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ligne bg-white px-3 py-2"
                >
                  <span>
                    <span className="font-medium">{libelleJour(c.jour)} {c.heureDebut}–{c.heureFin}</span>{" "}
                    {c.matiere} · {c.salle} · {c.enseignant} {c.enseignantNom}
                  </span>
                  <form
                    action={async (donnees: FormData) => {
                      "use server";
                      const { retirerCreneau } = await import("./actions");
                      await retirerCreneau({}, donnees);
                    }}
                  >
                    <input type="hidden" name="creneauId" value={c.id} />
                    <button type="submit" className="text-xs text-rouge underline hover:brightness-90">
                      Retirer
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        </section>
      )}

      {peutGerer && programme.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Donner un devoir</h2>
          <FormulaireDevoir classeId={classe.id} matieres={programme} />
        </section>
      )}

      <p className="mt-10 text-sm text-encre-doux">
        <Link href={`/classes/${classe.id}/devoirs`} className="text-vert underline hover:text-vert-fonce">
          Voir le cahier de textes de la classe
        </Link>
      </p>
    </div>
  );
}

