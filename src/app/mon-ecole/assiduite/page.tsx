import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  delegations,
  enseignements,
  etablissements,
  matieres,
  presencesEnseignants,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { assiduiteEnseignants } from "@/lib/outils/ministere";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import FormulairePointage from "./formulaire-pointage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Assiduité des enseignants" };

export default async function Assiduite({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const utilisateur = await exiger("direction", "enseignant");

  // La direction pointe son établissement ; le délégué à l'emploi du
  // temps pointe celui dont il a la charge.
  let ecole: { id: number; nom: string } | null = null;
  if (utilisateur.role === "direction") {
    const [ligne] = await db
      .select({ id: etablissements.id, nom: etablissements.nom })
      .from(etablissements)
      .where(eq(etablissements.directionUserId, utilisateur.id))
      .limit(1);
    ecole = ligne ?? null;
  } else {
    const [delegue] = await db
      .select({ id: delegations.etablissementId })
      .from(delegations)
      .where(and(eq(delegations.userId, utilisateur.id), eq(delegations.role, "edt")))
      .limit(1);
    if (delegue) {
      const [ligne] = await db
        .select({ id: etablissements.id, nom: etablissements.nom })
        .from(etablissements)
        .where(eq(etablissements.id, delegue.id))
        .limit(1);
      ecole = ligne ?? null;
    }
  }
  if (!ecole) redirect("/tableau-de-bord");

  const { date } = await searchParams;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const jour = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : aujourdhui;

  // Les enseignants de l'établissement, avec les matières qu'ils portent.
  const attributions = await db
    .select({
      id: users.id,
      prenom: users.prenom,
      nom: users.nom,
      matiere: matieres.nom,
      classe: classes.nom,
    })
    .from(enseignements)
    .innerJoin(classes, eq(classes.id, enseignements.classeId))
    .innerJoin(matieres, eq(matieres.id, enseignements.matiereId))
    .innerJoin(users, eq(users.id, enseignements.enseignantUserId))
    .where(eq(classes.etablissementId, ecole.id))
    .orderBy(asc(users.nom), asc(matieres.nom));

  const parEnseignant = new Map<
    number,
    { id: number; prenom: string; nom: string; matieres: string }
  >();
  for (const a of attributions) {
    const ligne = parEnseignant.get(a.id) ?? {
      id: a.id,
      prenom: a.prenom,
      nom: a.nom,
      matieres: "",
    };
    parEnseignant.set(a.id, ligne);
  }
  const matieresParEnseignant = new Map<number, string[]>();
  for (const a of attributions) {
    const liste = matieresParEnseignant.get(a.id) ?? [];
    const libelle = `${a.matiere} (${a.classe})`;
    if (!liste.includes(libelle)) liste.push(libelle);
    matieresParEnseignant.set(a.id, liste);
  }
  const enseignants = [...parEnseignant.values()].map((e) => ({
    ...e,
    matieres: (matieresParEnseignant.get(e.id) ?? []).join(", "),
  }));

  // Le pointage déjà posé pour la journée choisie.
  const existants = await db
    .select({ enseignantUserId: presencesEnseignants.enseignantUserId, statut: presencesEnseignants.statut })
    .from(presencesEnseignants)
    .where(
      and(eq(presencesEnseignants.etablissementId, ecole.id), eq(presencesEnseignants.date, jour)),
    );
  const dejaPointe: Record<number, string> = Object.fromEntries(
    existants.map((e) => [e.enseignantUserId, e.statut]),
  );

  // Le mois écoulé, par les MÊMES fonctions que le registre du ministère.
  const resume = await assiduiteEnseignants({ etablissementId: ecole.id });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/mon-ecole", label: ecole.nom }]}
        titre="Assiduité des enseignants"
        sousTitre="Le pointage du jour, enseignant par enseignant. Le ministère lit la synthèse à distance, comme dans le système national."
      />

      {enseignants.length === 0 ? (
        <div className="mt-8">
          <EtatVide>
            Aucun enseignant n&apos;est encore rattaché à une classe de
            l&apos;établissement : l&apos;attribution des matières vient d&apos;abord.
          </EtatVide>
        </div>
      ) : (
        <FormulairePointage enseignants={enseignants} date={jour} dejaPointe={dejaPointe} />
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Les trente derniers jours</h2>
        <p className="mt-1 text-sm text-encre-doux">
          {resume.tauxGlobal === null
            ? "Aucun pointage sur la période."
            : `Présence moyenne de l'équipe : ${String(resume.tauxGlobal).replace(".", ",")} %.`}
        </p>
        {resume.parEnseignant.length > 0 && (
          <table className="mt-3 w-full rounded-2xl border border-ligne bg-white text-sm">
            <caption className="sr-only">Assiduité par enseignant</caption>
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Enseignant</th>
                <th scope="col" className="px-4 py-2 font-medium">Présences</th>
                <th scope="col" className="px-4 py-2 font-medium">Retards</th>
                <th scope="col" className="px-4 py-2 font-medium">Absences</th>
                <th scope="col" className="px-4 py-2 font-medium">Taux</th>
              </tr>
            </thead>
            <tbody>
              {resume.parEnseignant.map((l) => (
                <tr key={`${l.prenom}-${l.nom}`} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2 font-medium">
                    {l.prenom} {l.nom}
                  </td>
                  <td className="px-4 py-2">{l.presents}</td>
                  <td className="px-4 py-2">{l.retards}</td>
                  <td className="px-4 py-2">{l.absents}</td>
                  <td className="px-4 py-2 font-semibold">
                    {String(l.taux).replace(".", ",")} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
