import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { gardeClasse } from "@/lib/garde-classe";
import { chargerBulletins, formaterMoyenne } from "@/lib/bulletins";
import { publierBulletins } from "./actions";

export const metadata: Metadata = { title: "Bulletins" };

export default async function PageBulletins({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  const contexte = await gardeClasse(idClasse);
  if (!contexte) redirect("/tableau-de-bord");
  const { utilisateur, classe } = contexte;

  const donnees = await chargerBulletins(idClasse);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <p className="text-sm text-encre-doux">
        <Link href={`/classes/${classe.id}`} className="underline hover:text-vert">
          {classe.nom}
        </Link>{" "}
        · bulletins
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Moyennes de {classe.nom}
        </h1>
        {donnees.publie ? (
          <span className="rounded-full bg-vert-clair px-3 py-1 text-sm font-medium text-vert-fonce">
            Publiés : les familles les voient
          </span>
        ) : (
          <span className="rounded-full bg-jaune-clair px-3 py-1 text-sm text-encre">
            Non publiés
          </span>
        )}
      </div>
      <p className="mt-2 text-encre-doux">
        {donnees.periode
          ? `${donnees.periode.nom} (du ${donnees.periode.debut} au ${donnees.periode.fin})`
          : "Année entière (aucune période active)"}
        {" · "}moyennes pondérées par coefficient, notes ramenées sur 20.
      </p>

      {utilisateur.role === "direction" && (
        <form
          action={async (donneesForm: FormData) => {
            "use server";
            await publierBulletins({}, donneesForm);
          }}
          className="mt-4"
        >
          <input type="hidden" name="classeId" value={classe.id} />
          <button
            type="submit"
            className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
          >
            {donnees.publie ? "Republier les bulletins" : "Publier les bulletins"}
          </button>
        </form>
      )}

      {donnees.eleves.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
          Aucun élève inscrit : les moyennes viendront avec les inscriptions.
        </p>
      ) : (
        <table className="mt-6 w-full rounded-2xl border border-ligne bg-white text-sm">
          <caption className="sr-only">Moyennes de la classe</caption>
          <thead>
            <tr className="border-b border-ligne text-left text-encre-doux">
              <th scope="col" className="px-4 py-2 font-medium">Élève</th>
              <th scope="col" className="px-4 py-2 font-medium">Moyenne</th>
              <th scope="col" className="px-4 py-2 font-medium">Rang</th>
              <th scope="col" className="px-4 py-2 font-medium">Absences (non justif. / justif.)</th>
              <th scope="col" className="px-4 py-2 font-medium">Retards</th>
              <th scope="col" className="px-4 py-2">
                <span className="sr-only">Bulletin</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {donnees.eleves.map((e) => (
              <tr key={e.eleveId} className="border-b border-ligne/60 last:border-0">
                <td className="px-4 py-2 font-medium">
                  {e.prenom} {e.nom}
                </td>
                <td className="px-4 py-2 font-semibold text-vert-fonce">
                  {formaterMoyenne(e.moyenneGenerale)}
                </td>
                <td className="px-4 py-2">{e.rang ?? "—"}</td>
                <td className="px-4 py-2">
                  {e.absencesNonJustifiees} / {e.absencesJustifiees}
                </td>
                <td className="px-4 py-2">{e.retards}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/classes/${classe.id}/bulletins/${e.eleveId}`}
                    className="text-sm font-medium text-vert underline hover:text-vert-fonce"
                  >
                    Voir le bulletin
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
