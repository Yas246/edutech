import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { gardeClasse } from "@/lib/garde-classe";
import { chargerBulletins, formaterMoyenne } from "@/lib/bulletins";
import { EnTetePage } from "@/components/ui/en-tete";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Série de bulletins" };

/**
 * La série imprimable de la classe : une feuille par élève, au format
 * du relevé officiel (matière, moyenne, coefficient, points), prête
 * pour l'imprimante ou le PDF du navigateur.
 */
export default async function SerieBulletins({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  const contexte = await gardeClasse(idClasse);
  if (!contexte) notFound();
  const { classe } = contexte;

  const donnees = await chargerBulletins(idClasse);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 print:py-0">
      <EnTetePage
        fil={[
          { href: `/classes/${classe.id}`, label: classe.nom },
          { href: `/classes/${classe.id}/bulletins`, label: "Bulletins" },
        ]}
        titre="Série de bulletins"
        sousTitre={`${donnees.eleves.length} feuille(s), une par élève — ${donnees.periode ? donnees.periode.nom : "année entière"}.`}
        actions={
          <div className="flex gap-2 print:hidden">
            <Link
              href={`/classes/${idClasse}/bulletins`}
              className="rounded-xl border border-ligne bg-white px-4 py-2 text-sm font-medium hover:bg-papier"
            >
              Retour aux moyennes
            </Link>
          </div>
        }
      />

      {donnees.eleves.map((e) => (
        <article
          key={e.eleveId}
          className="mt-6 break-after-page rounded-2xl border border-ligne bg-white p-6 print:rounded-none print:border-0"
        >
          <header className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide">
              {donnees.etablissementNom}
              {donnees.commune ? ` — ${donnees.commune}` : ""}
            </p>
            <h2 className="mt-1 text-lg font-bold">
              Bulletin de {e.prenom} {e.nom}
            </h2>
            <p className="text-sm text-encre-doux">
              {donnees.classeNom} ·{" "}
              {donnees.periode
                ? `${donnees.periode.nom} (du ${donnees.periode.debut} au ${donnees.periode.fin})`
                : "Année entière"}
            </p>
          </header>

          <table className="mt-4 w-full border-collapse text-sm">
            <caption className="sr-only">Relevé de notes de {e.prenom} {e.nom}</caption>
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="py-1.5 font-medium">Matière</th>
                <th scope="col" className="py-1.5 text-right font-medium">Coefficient</th>
                <th scope="col" className="py-1.5 text-right font-medium">Moyenne /20</th>
                <th scope="col" className="py-1.5 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody>
              {e.matieres.map((m) => (
                <tr key={m.nom} className="border-b border-ligne/60">
                  <td className="py-1.5">{m.nom}</td>
                  <td className="py-1.5 text-right">{m.coefficient}</td>
                  <td className="py-1.5 text-right">
                    {m.moyenneSur20 === null ? "—" : formaterMoyenne(m.moyenneSur20)}
                  </td>
                  <td className="py-1.5 text-right">
                    {m.moyenneSur20 === null ? "—" : formaterMoyenne(m.moyenneSur20 * m.coefficient)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap justify-between gap-4 text-sm">
            <p>
              Moyenne générale :{" "}
              <strong>
                {e.moyenneGenerale === null ? "—" : `${formaterMoyenne(e.moyenneGenerale)}/${donnees.echelle}`}
              </strong>{" "}
              · Rang : <strong>{e.rang ?? "—"}</strong>
            </p>
            <p>
              Absences : <strong>{e.absencesNonJustifiees}</strong> non justifiée(s),{" "}
              <strong>{e.absencesJustifiees}</strong> justifiée(s) · Retards :{" "}
              <strong>{e.retards}</strong>
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
