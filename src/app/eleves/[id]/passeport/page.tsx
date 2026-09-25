import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  etablissements,
  inscriptions,
  liensFamille,
  presences,
  transferts,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { chargerBulletins } from "@/lib/bulletins";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import BoutonImprimer from "@/app/classes/[id]/bulletins/[eleveId]/bouton-imprimer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Passeport scolaire" };

function dateFrancaise(iso: string | null) {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/**
 * Le passeport scolaire : le cursus complet de l'élève sur une page
 * imprimable — identité, classes fréquentées, transferts, moyennes
 * par période, absences. Ouvert à l'élève, à son parent lié, à la
 * direction de son école et au ministère. À personne d'autre.
 */
export default async function PasseportScolaire({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idEleve = Number(id);
  if (!Number.isInteger(idEleve)) notFound();

  const utilisateur = await exiger("eleve", "parent", "direction", "ministere");

  const [eleve] = await db
    .select({
      id: users.id,
      prenom: users.prenom,
      nom: users.nom,
      sexe: users.sexe,
      dateNaissance: users.dateNaissance,
      lieuNaissance: users.lieuNaissance,
    })
    .from(users)
    .where(and(eq(users.id, idEleve), eq(users.role, "eleve")))
    .limit(1);
  if (!eleve) notFound();

  /* La garde : quatre places légitimes, personne d'autre. */
  if (utilisateur.role === "eleve") {
    if (utilisateur.id !== eleve.id) notFound();
  } else if (utilisateur.role === "parent") {
    const [lien] = await db
      .select({ id: liensFamille.id })
      .from(liensFamille)
      .where(
        and(
          eq(liensFamille.parentUserId, utilisateur.id),
          eq(liensFamille.eleveUserId, eleve.id),
        ),
      )
      .limit(1);
    if (!lien) notFound();
  } else if (utilisateur.role === "direction") {
    const [dirige] = await db
      .select({ id: inscriptions.id })
      .from(inscriptions)
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
      .where(
        and(
          eq(inscriptions.eleveUserId, eleve.id),
          eq(etablissements.directionUserId, utilisateur.id),
        ),
      )
      .limit(1);
    if (!dirige) notFound();
  }

  /* Le parcours : classes fréquentées, année par année. */
  const parcours = await db
    .select({
      classeId: classes.id,
      classe: classes.nom,
      niveau: classes.niveau,
      annee: classes.anneeScolaire,
      etablissement: etablissements.nom,
      commune: etablissements.commune,
    })
    .from(inscriptions)
    .innerJoin(classes, eq(classes.id, inscriptions.classeId))
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(inscriptions.eleveUserId, eleve.id))
    .orderBy(asc(classes.anneeScolaire), asc(classes.id));

  /* Les transferts où l'élève est apparu. */
  const mouvements = await db
    .select({
      statut: transferts.statut,
      motif: transferts.motif,
      date: transferts.createdAt,
    })
    .from(transferts)
    .where(eq(transferts.eleveUserId, eleve.id))
    .orderBy(asc(transferts.id));

  /* Les moyennes et absences, classe par classe. */
  const parClasse = [] as {
    classeId: number;
    classe: string;
    etablissement: string;
    annee: string;
    periode: string;
    moyenne: number | null;
    absences: number;
  }[];
  for (const p of parcours) {
    const bulletins = await chargerBulletins(p.classeId);
    const bulletin = bulletins.eleves.find((e) => e.eleveId === eleve.id);
    const absences = await db
      .select({ statut: presences.statut })
      .from(presences)
      .where(and(eq(presences.eleveUserId, eleve.id), eq(presences.classeId, p.classeId)));
    parClasse.push({
      classeId: p.classeId,
      classe: p.classe,
      etablissement: p.etablissement,
      annee: p.annee,
      periode: bulletins.periode?.nom ?? "—",
      moyenne: bulletin?.moyenneGenerale ?? null,
      absences: absences.filter((a) => a.statut === "absent").length,
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <EnTetePage
          titre="Passeport scolaire"
          sousTitre="Le cursus complet de l'élève, vérifiable en un coup d'œil : identité, classes fréquentées, résultats, transferts."
        />
        <BoutonImprimer libelle="Imprimer le passeport" />
      </div>

      <section className="mt-6 rounded-2xl border border-ligne bg-white p-6">
        <h2 className="text-lg font-bold tracking-tight">
          {eleve.prenom} {eleve.nom}
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-encre-doux">Sexe</dt>
            <dd>{eleve.sexe === "F" ? "Féminin" : eleve.sexe === "M" ? "Masculin" : "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-encre-doux">Né(e) le</dt>
            <dd>{dateFrancaise(eleve.dateNaissance) || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-encre-doux">Lieu de naissance</dt>
            <dd>{eleve.lieuNaissance || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold tracking-tight">Le cursus</h2>
        {parClasse.length === 0 ? (
          <div className="mt-3">
            <EtatVide>Cet élève n&apos;est inscrit dans aucune classe.</EtatVide>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-ligne bg-white">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-ligne text-left text-encre-doux">
                  <th scope="col" className="px-4 py-2.5 font-medium">Année</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Classe</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Établissement</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Période</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Moyenne</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Absences</th>
                </tr>
              </thead>
              <tbody>
                {parClasse.map((p, i) => (
                  <tr key={`${p.classeId}-${i}`} className="border-b border-ligne/60 last:border-0">
                    <td className="px-4 py-2.5">{p.annee}</td>
                    <td className="px-4 py-2.5 font-medium">{p.classe}</td>
                    <td className="px-4 py-2.5">{p.etablissement}</td>
                    <td className="px-4 py-2.5">{p.periode}</td>
                    <td className="px-4 py-2.5 font-semibold">
                      {p.moyenne === null ? "—" : p.moyenne.toFixed(2).replace(".", ",")}
                    </td>
                    <td className="px-4 py-2.5">{p.absences}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mouvements.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold tracking-tight">Les transferts</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {mouvements.map((m, i) => (
              <li key={i} className="rounded-xl border border-ligne bg-white px-4 py-2.5">
                {m.statut === "valide"
                  ? "Transfert accepté"
                  : m.statut === "refuse"
                    ? "Transfert refusé"
                    : "Transfert en attente"}
                {m.motif ? ` — ${m.motif}` : ""}{" "}
                <span className="text-encre-doux">({dateFrancaise(m.date.toISOString().slice(0, 10))})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
