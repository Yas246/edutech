import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, etablissements, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { gardeClasse } from "@/lib/garde-classe";
import { chargerBulletins } from "@/lib/bulletins";
import { EnTetePage } from "@/components/ui/en-tete";
import BoutonImprimer from "../bulletins/[eleveId]/bouton-imprimer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Liste de candidature" };

function dateFrancaise(iso: string | null) {
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/**
 * La liste de candidature au examen national de la classe : BEPC ou
 * BAC selon le niveau. Elle sort des inscriptions et des bulletins —
 * zéro ressaisie d'état civil, zéro copier-coller de moyennes.
 */
export default async function PageCandidatures({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  if (!Number.isInteger(idClasse)) notFound();

  const utilisateur = await exiger("direction", "enseignant", "ministere");
  if (utilisateur.role === "ministere") {
    const [existe] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.id, idClasse))
      .limit(1);
    if (!existe) notFound();
  } else {
    const garde = await gardeClasse(idClasse);
    if (!garde) notFound();
  }

  const [classe] = await db
    .select({
      id: classes.id,
      nom: classes.nom,
      niveau: classes.niveau,
      etabNom: etablissements.nom,
      commune: etablissements.commune,
      echelle: etablissements.echelle,
    })
    .from(classes)
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) notFound();

  // L'examen se déduit du niveau de la classe.
  const niveauBas = classe.niveau.toLowerCase();
  const estBac = /terminale|tle/.test(niveauBas);
  const estBepc = /3e|3ème|3eme|troisieme|troisième/.test(niveauBas);
  const examen = estBac
    ? "Baccalauréat"
    : estBepc
      ? "BEPC"
      : null;

  const bulletins = await chargerBulletins(idClasse);
  const idsEleves = bulletins.eleves.map((e) => e.eleveId);
  const etatCivil =
    idsEleves.length > 0
      ? await db
          .select({
            id: users.id,
            sexe: users.sexe,
            dateNaissance: users.dateNaissance,
            lieuNaissance: users.lieuNaissance,
          })
          .from(users)
          .where(inArray(users.id, idsEleves))
      : [];
  const civilParId = new Map(etatCivil.map((c) => [c.id, c]));

  const lignes = bulletins.eleves
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .map((e, i) => {
      const civil = civilParId.get(e.eleveId);
      return {
        ordre: i + 1,
        eleveId: e.eleveId,
        nom: e.nom,
        prenom: e.prenom,
        sexe: civil?.sexe ?? "",
        dateNaissance: civil?.dateNaissance ?? null,
        lieuNaissance: civil?.lieuNaissance ?? "",
        moyenne: e.moyenneGenerale,
      };
    });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <EnTetePage
          fil={[{ href: `/classes/${classe.id}`, label: classe.nom }]}
          titre="Liste de candidature"
          sousTitre="Générée depuis les inscriptions et les bulletins : aucune ressaisie d'état civil, aucune copie de moyenne."
        />
        {examen !== null && lignes.length > 0 && <BoutonImprimer libelle="Imprimer la liste" />}
      </div>

      {examen === null ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
          Le niveau « {classe.niveau} » ne mène pas à un examen national :
          les listes de candidature concernent la 3e (BEPC) et la
          Terminale (BAC).
        </div>
      ) : lignes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
          Aucun élève inscrit dans cette classe.
        </div>
      ) : (
        <section className="mt-6">
          <header className="rounded-2xl border border-ligne bg-white p-5">
            <p className="text-center text-lg font-bold tracking-tight">
              République du Bénin — Liste de candidature au {examen}
            </p>
            <p className="mt-1 text-center text-sm text-encre-doux">
              {classe.etabNom} — {classe.nom} · {lignes.length} candidat
              {lignes.length > 1 ? "s" : ""} · Année scolaire{" "}
              {new Date().getFullYear()}-{new Date().getFullYear() + 1}
            </p>
          </header>

          <table className="mt-4 w-full rounded-2xl border border-ligne bg-white text-sm">
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-3 py-2 font-medium">N°</th>
                <th scope="col" className="px-3 py-2 font-medium">Nom</th>
                <th scope="col" className="px-3 py-2 font-medium">Prénom</th>
                <th scope="col" className="px-3 py-2 font-medium">Sexe</th>
                <th scope="col" className="px-3 py-2 font-medium">Né(e) le</th>
                <th scope="col" className="px-3 py-2 font-medium">à</th>
                <th scope="col" className="px-3 py-2 font-medium">Moyenne</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.eleveId} className="border-b border-ligne/60 last:border-0">
                  <td className="px-3 py-2 tabular-nums">{l.ordre}</td>
                  <td className="px-3 py-2 font-medium uppercase">{l.nom}</td>
                  <td className="px-3 py-2">{l.prenom}</td>
                  <td className="px-3 py-2">{l.sexe}</td>
                  <td className="px-3 py-2">{dateFrancaise(l.dateNaissance) || "—"}</td>
                  <td className="px-3 py-2">{l.lieuNaissance || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {l.moyenne === null ? "—" : l.moyenne.toFixed(2).replace(".", ",")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-right text-xs text-encre-doux">
            Échelle de l&apos;établissement : /{Number(classe.echelle)}
          </p>
        </section>
      )}
    </div>
  );
}
