import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  enseignements,
  inscriptions,
  matieres,
  users,
} from "@/db/schema";
import { exiger, nomComplet } from "@/lib/auth";
import { ecoleDeLaDirection } from "@/lib/ecole";
import { retirerMatiere } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Carte } from "@/components/ui/carte";
import { EtatVide } from "@/components/ui/etat-vide";
import { EnTetePage } from "@/components/ui/en-tete";
import { champClasse } from "@/components/ui/formulaire";
import {
  FormulaireClasse,
  FormulaireEleve,
  FormulaireEnseignant,
  FormulaireMatiere,
} from "./formulaires-classe";

export const metadata: Metadata = { title: "Mon école" };

export default async function MonEcole() {
  const utilisateur = await exiger("direction");
  const ecole = await ecoleDeLaDirection(utilisateur);

  const mesClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.etablissementId, ecole.id))
    .orderBy(asc(classes.nom));

  const lignesMatieres = await db
    .select({
      id: matieres.id,
      classeId: matieres.classeId,
      nom: matieres.nom,
      coefficient: matieres.coefficient,
      enseignantId: users.id,
      enseignantPrenom: users.prenom,
      enseignantNom: users.nom,
    })
    .from(matieres)
    .leftJoin(enseignements, eq(enseignements.matiereId, matieres.id))
    .leftJoin(users, eq(users.id, enseignements.enseignantUserId))
    .innerJoin(classes, eq(classes.id, matieres.classeId))
    .where(eq(classes.etablissementId, ecole.id))
    .orderBy(asc(matieres.nom));

  const effectifParClasse = await db
    .select({ classeId: inscriptions.classeId })
    .from(inscriptions)
    .innerJoin(classes, eq(classes.id, inscriptions.classeId))
    .where(eq(classes.etablissementId, ecole.id));

  const enseignants = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(users)
    .where(eq(users.role, "enseignant"))
    .orderBy(asc(users.nom));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      {/* Fiche de l'établissement */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <EnTetePage
          titre={ecole.nom}
          sousTitre={
            [
              [ecole.commune, ecole.departement].filter(Boolean).join(", "),
              ecole.statutAdmin === "prive"
                ? "Privé"
                : ecole.statutAdmin === "confesse"
                  ? "Confessionnel"
                  : "Public",
            ].join(" · ")
          }
        />
        <Badge
          ton={ecole.statut === "valide" ? "vert" : ecole.statut === "refuse" ? "rouge" : "jaune"}
        >
          {ecole.statut === "valide"
            ? "Validé"
            : ecole.statut === "refuse"
              ? "Non validé"
              : "En attente du ministère"}
        </Badge>
      </div>

      {/* Classes */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          Les classes ({mesClasses.length})
        </h2>

        <div className="mt-4 space-y-6">
          {mesClasses.length === 0 && (
            <EtatVide>
              Aucune classe pour l&apos;instant. Créez la première ci-dessous.
            </EtatVide>
          )}

          {mesClasses.map((classe) => {
            const matieresClasse = lignesMatieres.filter(
              (m) => m.classeId === classe.id,
            );
            const effectif = effectifParClasse.filter((e) => e.classeId === classe.id).length;
            return (
              <article key={classe.id} className="rounded-2xl border border-ligne bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">
                    {classe.nom}{" "}
                    <span className="text-sm font-normal text-encre-doux">
                      ({classe.niveau}) · {effectif} élève{effectif > 1 ? "s" : ""}
                    </span>
                  </h3>
                  <Link
                    href={`/classes/${classe.id}`}
                    className="text-sm font-medium text-vert underline hover:text-vert-fonce"
                  >
                    Voir la page de la classe
                  </Link>
                </div>

                {matieresClasse.length > 0 ? (
                  <table className="mt-3 w-full text-sm">
                    <caption className="sr-only">Programme de {classe.nom}</caption>
                    <thead>
                      <tr className="border-b border-ligne text-left text-encre-doux">
                        <th scope="col" className="py-2 font-medium">Matière</th>
                        <th scope="col" className="py-2 font-medium">Coefficient</th>
                        <th scope="col" className="py-2 font-medium">Enseignant</th>
                        <th scope="col" className="py-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {matieresClasse.map((m) => (
                        <tr key={m.id} className="border-b border-ligne/60">
                          <td className="py-2 font-medium">{m.nom}</td>
                          <td className="py-2">{m.coefficient}</td>
                          <td className="py-2 text-encre-doux">
                            {m.enseignantId
                              ? `${m.enseignantPrenom} ${m.enseignantNom}`
                              : "À confier"}
                          </td>
                          <td className="py-2 text-right">
                            <form action={retirerMatiereFormulaire}>
                              <input type="hidden" name="matiereId" value={m.id} />
                              <button
                                type="submit"
                                className="text-xs text-rouge underline hover:brightness-90"
                              >
                                Retirer
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="mt-3 text-sm text-encre-doux">
                    Programme vide : ajoutez les matières et leurs coefficients.
                  </p>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <FormulaireMatiere classeId={classe.id} />
                  <FormulaireEnseignant
                    matieres={matieresClasse.map((m) => ({ id: m.id, nom: m.nom }))}
                    enseignants={enseignants}
                  />
                  <FormulaireEleve classeId={classe.id} />
                </div>
              </article>
            );
          })}
        </div>

        <FormulaireClasse />
      </section>

      <nav className="mt-8 flex flex-wrap gap-3 text-sm" aria-label="Gestion de l'école">
        <Link href="/mon-ecole/assiduite" className="rounded-xl border border-ligne bg-white px-4 py-2 font-medium hover:bg-papier">Assiduité</Link>
        <Link href="/mon-ecole/salles" className="rounded-xl border border-ligne bg-white px-4 py-2 font-medium hover:bg-papier">Salles</Link>
        <Link href="/mon-ecole/agenda" className="rounded-xl border border-ligne bg-white px-4 py-2 font-medium hover:bg-papier">Agenda</Link>
      </nav>

      <p className="mt-6 text-sm text-encre-doux">
        Équipe de direction : {nomComplet(utilisateur)} · connexion {utilisateur.email}
      </p>
    </div>
  );
}

/** Adaptation du retrait d'une matière au formulaire HTML natif. */
async function retirerMatiereFormulaire(donnees: FormData) {
  "use server";
  await retirerMatiere({}, donnees);
}
