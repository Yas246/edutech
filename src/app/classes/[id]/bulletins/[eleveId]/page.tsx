import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { liensFamille } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { chargerBulletins, formaterMoyenne } from "@/lib/bulletins";
import BoutonImprimer from "./bouton-imprimer";

export const metadata: Metadata = { title: "Bulletin" };

export default async function BulletinEleve({
  params,
}: {
  params: Promise<{ id: string; eleveId: string }>;
}) {
  const { id, eleveId: idEleveBrut } = await params;
  const idClasse = Number(id);
  const idEleve = Number(idEleveBrut);
  if (!Number.isInteger(idClasse) || !Number.isInteger(idEleve)) notFound();

  const utilisateur = await exiger("direction", "enseignant", "parent", "eleve", "ministere");

  const donnees = await chargerBulletins(idClasse);
  const eleve = donnees.eleves.find((e) => e.eleveId === idEleve);
  if (!eleve) notFound();

  // Qui peut lire ce bulletin : l'équipe de la classe, l'élève lui-même,
  // son parent — et toujours si les bulletins sont publiés.
  const equipe = utilisateur.role === "direction" || utilisateur.role === "enseignant" || utilisateur.role === "ministere";
  const luiMeme = utilisateur.role === "eleve" && utilisateur.id === idEleve;
  let parent = false;
  if (utilisateur.role === "parent") {
    const [lien] = await db
      .select({ id: liensFamille.id })
      .from(liensFamille)
      .where(
        and(eq(liensFamille.parentUserId, utilisateur.id), eq(liensFamille.eleveUserId, idEleve)),
      )
      .limit(1);
    parent = Boolean(lien);
  }
  if (!equipe && !luiMeme && !parent) redirect("/tableau-de-bord");
  if (!equipe && !donnees.publie) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Bulletins non publiés</h1>
        <p className="mt-3 text-encre-doux">
          Le bulletin de {eleve.prenom} {eleve.nom} paraîtra ici dès que la
          direction de {donnees.etablissementNom} l&apos;aura publié.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="vmt-barre-actions flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/classes/${idClasse}/bulletins`}
          className="text-sm font-medium text-vert underline hover:text-vert-fonce"
        >
          ← Retour aux moyennes
        </Link>
        <BoutonImprimer />
      </div>

      {/* Feuille A4 */}
      <article className="vmt-feuille mt-6 rounded-2xl border border-ligne bg-white p-8 print:mt-0 print:rounded-none print:border-0">
        <header className="border-b-2 border-vert pb-3 text-center">
          <p className="text-xs uppercase tracking-widest text-encre-doux">
            République du Bénin · Ministère de l&apos;Éducation
          </p>
          <h1 className="mt-1 text-xl font-bold text-vert-fonce">
            {donnees.etablissementNom}
          </h1>
          <p className="text-sm text-encre-doux">
            {donnees.commune}, {donnees.departement} — Bulletin de {donnees.periode?.nom ?? "l'année"}
          </p>
        </header>

        <section className="mt-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">
            {eleve.prenom} {eleve.nom}
          </h2>
          <p className="text-sm text-encre-doux">
            Classe : {donnees.classeNom} · Année 2026-2027
          </p>
        </section>

        <table className="mt-4 w-full border-collapse text-sm">
          <caption className="sr-only">Résultats par matière</caption>
          <thead>
            <tr className="bg-vert-clair text-left text-vert-fonce">
              <th scope="col" className="border border-ligne px-3 py-2">Matière</th>
              <th scope="col" className="border border-ligne px-3 py-2 text-center">Coefficient</th>
              <th scope="col" className="border border-ligne px-3 py-2 text-center">Moyenne / 20</th>
            </tr>
          </thead>
          <tbody>
            {eleve.matieres.map((m) => (
              <tr key={m.nom}>
                <td className="border border-ligne px-3 py-1.5">{m.nom}</td>
                <td className="border border-ligne px-3 py-1.5 text-center">{m.coefficient}</td>
                <td className="border border-ligne px-3 py-1.5 text-center font-medium">
                  {formaterMoyenne(m.moyenneSur20)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-5 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-xl border border-ligne p-3">
            <p className="text-xs uppercase tracking-wide text-encre-doux">Moyenne générale</p>
            <p className="text-2xl font-bold text-vert">
              {formaterMoyenne(eleve.moyenneGenerale)}
            </p>
          </div>
          <div className="rounded-xl border border-ligne p-3">
            <p className="text-xs uppercase tracking-wide text-encre-doux">Rang</p>
            <p className="text-2xl font-bold text-vert-fonce">
              {eleve.rang ?? "—"}
              <span className="text-sm font-normal text-encre-doux">
                {eleve.rang ? ` / ${donnees.eleves.length}` : ""}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-ligne p-3">
            <p className="text-xs uppercase tracking-wide text-encre-doux">Absences</p>
            <p className="text-2xl font-bold text-vert-fonce">
              {eleve.absencesNonJustifiees + eleve.absencesJustifiees}
              <span className="text-sm font-normal text-encre-doux">
                {" "}
                ({eleve.absencesNonJustifiees} non justif.)
              </span>
            </p>
          </div>
        </section>

        <footer className="mt-6 flex items-end justify-between border-t border-ligne pt-3 text-xs text-encre-doux">
          <p>
            Retards : {eleve.retards} · Notes ramenées sur 20, puis pondérées
            par coefficient. Les matières non notées n&apos;entrent pas dans la
            moyenne générale.
          </p>
          <p className="text-right">
            Fait à {donnees.commune},
            <br />
            La Direction
          </p>
        </footer>
      </article>
    </div>
  );
}
