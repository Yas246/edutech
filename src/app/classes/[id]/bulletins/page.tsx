import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { IconFileText, IconRefresh, IconTrophy } from "@tabler/icons-react";
import { db } from "@/db";
import { inscriptions, liensFamille } from "@/db/schema";
import { utilisateurCourant } from "@/lib/auth";
import { gardeClasse } from "@/lib/garde-classe";
import { chargerBulletins, formaterMoyenne } from "@/lib/bulletins";
import { publierBulletins } from "./actions";
import { EtatVide } from "@/components/ui/etat-vide";

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

/** La teinte du badge de moyenne : l'échelle de l'établissement est
 * ramenée sur 20 pour juger. */
function teinteMoyenne(moyenne: number | null, echelle: number) {
  if (moyenne === null) return "bg-papier text-discret";
  const sur20 = (moyenne / echelle) * 20;
  if (sur20 >= 14) return "bg-vert-clair text-vert-fonce font-bold";
  if (sur20 >= 10) return "bg-vert-clair/60 text-vert-fonce";
  return "bg-rouge-clair text-rouge font-medium";
}

/** Le rang médaillé : les trois premiers sortent du lot. */
function rangBadge(rang: number | null) {
  if (rang === null) return <span className="text-discret">—</span>;
  const medaille =
    rang === 1
      ? "border-jaune/60 bg-jaune-clair text-encre"
      : rang === 2
        ? "border-ligne bg-papier text-encre"
        : rang === 3
          ? "border-jaune/30 bg-jaune-clair/60 text-encre-doux"
          : "border-ligne text-encre-doux";
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold tabular-nums ${medaille}`}
    >
      {rang}
    </span>
  );
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
  const notés = donnees.eleves.filter((e) => e.moyenneGenerale !== null);
  const moyenneClasse =
    notés.length > 0
      ? notés.reduce((s, e) => s + (e.moyenneGenerale ?? 0), 0) / notés.length
      : null;
  const auDessus = notés.filter((e) => (e.moyenneGenerale ?? 0) >= donnees.echelle / 2).length;
  const tauxReussite = notés.length > 0 ? Math.round((100 * auDessus) / notés.length) : null;
  const totalAbsences = donnees.eleves.reduce(
    (s, e) => s + e.absencesNonJustifiees + e.absencesJustifiees,
    0,
  );
  const meilleur = notés.reduce<(typeof notés)[number] | null>(
    (meilleur, e) =>
      !meilleur || (e.moyenneGenerale ?? 0) > (meilleur.moyenneGenerale ?? 0) ? e : meilleur,
    null,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      {/* L'en-tête : titre, état de publication, actions */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/classes/${classe.id}`}
            className="text-xs font-medium text-discret underline hover:text-encre"
          >
            ← {classe.nom}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Moyennes de {classe.nom}
          </h1>
          <p className="mt-1 text-sm text-encre-doux">
            {donnees.periode
              ? `${donnees.periode.nom} (du ${donnees.periode.debut} au ${donnees.periode.fin})`
              : "Année entière (aucune période active)"}
            {" · "}pondérées par coefficient, échelle /{donnees.echelle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              donnees.publie
                ? "border-vert/30 bg-vert-clair text-vert-fonce"
                : "border-jaune/40 bg-jaune-clair text-encre"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                donnees.publie ? "animate-pulse bg-vert" : "bg-jaune"
              }`}
            />
            {donnees.publie ? "Publiés aux familles" : "Non publiés"}
          </span>
          {utilisateur.role === "direction" && (
            <form
              action={async (donneesForm: FormData) => {
                "use server";
                await publierBulletins({}, donneesForm);
              }}
            >
              <input type="hidden" name="classeId" value={classe.id} />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-vert-fonce"
              >
                <IconRefresh className="h-4 w-4" stroke={1.8} />
                {donnees.publie ? "Republier" : "Publier les bulletins"}
              </button>
            </form>
          )}
          {donnees.eleves.length > 0 && (
            <Link
              href={`/classes/${classe.id}/bulletins/serie`}
              className="flex items-center gap-1.5 rounded-xl border border-ligne bg-white px-4 py-2 text-sm font-medium text-encre transition hover:bg-papier"
            >
              <IconFileText className="h-4 w-4" stroke={1.7} />
              Série imprimable ({donnees.eleves.length})
            </Link>
          )}
        </div>
      </div>

      {donnees.eleves.length === 0 ? (
        <div className="mt-8">
          <EtatVide>Aucun élève inscrit : les moyennes viendront avec les inscriptions.</EtatVide>
        </div>
      ) : (
        <>
          {/* Les quatre chiffres qui résument la classe */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CarteKpi libelle="Moyenne de la classe" valeur={
              moyenneClasse === null ? "—" : `${formaterMoyenne(moyenneClasse)}/${donnees.echelle}`
            } />
            <CarteKpi
              libelle="Ont la moyenne"
              valeur={tauxReussite === null ? "—" : `${tauxReussite} %`}
              detail={`${auDessus} élève${auDessus > 1 ? "s" : ""} sur ${notés.length}`}
            />
            <CarteKpi
              libelle="Absences cumulées"
              valeur={String(totalAbsences)}
              detail="justifiées et non justifiées"
            />
            <CarteKpi
              libelle="Premier de la classe"
              valeur={
                meilleur && meilleur.moyenneGenerale !== null
                  ? `${formaterMoyenne(meilleur.moyenneGenerale)}/${donnees.echelle}`
                  : "—"
              }
              detail={meilleur ? `${meilleur.prenom} ${meilleur.nom}` : undefined}
              icone
            />
          </div>

          {/* Le tableau des élèves */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-ligne bg-white shadow-xs">
            <table className="w-full text-sm">
              <caption className="sr-only">Moyennes de la classe</caption>
              <thead>
                <tr className="border-b border-ligne bg-papier/70 text-left text-[11px] uppercase tracking-wider text-discret">
                  <th scope="col" className="px-4 py-3 font-semibold">Élève</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Moyenne</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Rang</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Absences</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Retards</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Bulletin</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {donnees.eleves.map((e) => (
                  <tr key={e.eleveId} className="border-b border-ligne/60 last:border-0 hover:bg-papier/50">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-vert to-vert-fonce text-[11px] font-bold text-white">
                          {e.prenom.charAt(0)}
                          {e.nom.charAt(0)}
                        </span>
                        <span className="font-medium">
                          {e.prenom} {e.nom}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 tabular-nums ${teinteMoyenne(e.moyenneGenerale, donnees.echelle)}`}
                      >
                        {formaterMoyenne(e.moyenneGenerale)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{rangBadge(e.rang)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex gap-1">
                        <span className="rounded-md border border-rouge/20 bg-rouge-clair px-2 py-0.5 text-xs tabular-nums text-rouge">
                          {e.absencesNonJustifiees}
                        </span>
                        <span className="rounded-md border border-ligne bg-papier px-2 py-0.5 text-xs tabular-nums text-encre-doux">
                          {e.absencesJustifiees}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{e.retards}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/classes/${classe.id}/bulletins/${e.eleveId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-papier px-3 py-1.5 text-xs font-medium text-encre transition hover:bg-vert-clair hover:text-vert-fonce"
                      >
                        <IconFileText className="h-3.5 w-3.5" stroke={1.7} />
                        Bulletin
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CarteKpi({
  libelle,
  valeur,
  detail,
  icone,
}: {
  libelle: string;
  valeur: string;
  detail?: string;
  icone?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-ligne bg-white p-4 shadow-xs">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-discret">
        {icone && <IconTrophy className="h-4 w-4 text-jaune" stroke={1.7} />}
        {libelle}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{valeur}</p>
      {detail && <p className="mt-0.5 text-xs text-encre-doux">{detail}</p>}
    </div>
  );
}
