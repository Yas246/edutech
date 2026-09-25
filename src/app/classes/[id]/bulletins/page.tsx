import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { inscriptions, liensFamille } from "@/db/schema";
import { utilisateurCourant } from "@/lib/auth";
import { gardeClasse } from "@/lib/garde-classe";
import { chargerBulletins, formaterMoyenne } from "@/lib/bulletins";
import { publierBulletins } from "./actions";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Bulletins" };

/**
 * Le tableau de la classe est réservé à l'équipe. Un élève ou un
 * parent qui l'ouvre est conduit à SON bulletin — jamais refusé sec.
 */
async function bulletinPerso(idClasse: number): Promise<number | null> {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) return null;

  if (utilisateur.role === "eleve") {
    const [sienne] = await db
      .select({ id: inscriptions.id })
      .from(inscriptions)
      .where(
        and(
          eq(inscriptions.classeId, idClasse),
          eq(inscriptions.eleveUserId, utilisateur.id),
        ),
      )
      .limit(1);
    return sienne ? utilisateur.id : null;
  }

  if (utilisateur.role === "parent") {
    const [enfant] = await db
      .select({ id: liensFamille.eleveUserId })
      .from(liensFamille)
      .innerJoin(inscriptions, eq(inscriptions.eleveUserId, liensFamille.eleveUserId))
      .where(
        and(
          eq(liensFamille.parentUserId, utilisateur.id),
          eq(inscriptions.classeId, idClasse),
        ),
      )
      .limit(1);
    return enfant?.id ?? null;
  }

  return null;
}

export default async function PageBulletins({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  const contexte = await gardeClasse(idClasse);
  if (!contexte) {
    const perso = await bulletinPerso(idClasse);
    redirect(perso ? `/classes/${idClasse}/bulletins/${perso}` : "/tableau-de-bord");
  }
  const { utilisateur, classe } = contexte;

  const donnees = await chargerBulletins(idClasse);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <EnTetePage
        fil={[{ href: `/classes/${classe.id}`, label: classe.nom }]}
        titre={<>Moyennes de {classe.nom}</>}
        actions={
          donnees.publie ? (
            <Badge ton="vert">Publiés : les familles les voient</Badge>
          ) : (
            <Badge ton="jaune">Non publiés</Badge>
          )
        }
      />
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

      {donnees.eleves.length > 0 && (
        <p className="mt-4">
          <Link
            href={`/classes/${classe.id}/bulletins/serie`}
            className="rounded-xl border border-ligne bg-white px-4 py-2 text-sm font-medium hover:bg-papier"
          >
            Imprimer la série de bulletins ({donnees.eleves.length})
          </Link>
        </p>
      )}

      {donnees.eleves.length === 0 ? (
        <EtatVide>Aucun élève inscrit : les moyennes viendront avec les inscriptions.</EtatVide>
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
