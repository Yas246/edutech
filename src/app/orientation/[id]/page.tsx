import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { relevesOrientation } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { orienter } from "@/lib/orientation";
import { recommander } from "@/lib/orientation-moteur";
import { EnTetePage } from "@/components/ui/en-tete";
import { Alerte } from "@/components/ui/alerte";
import FormulaireCorrection from "./formulaire-correction";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mon orientation" };

export default async function ReleveOrientation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const utilisateur = await exiger("eleve");
  const { id } = await params;
  const [releve] = await db
    .select()
    .from(relevesOrientation)
    .where(
      and(
        eq(relevesOrientation.id, Number(id)),
        eq(relevesOrientation.eleveUserId, utilisateur.id),
      ),
    )
    .limit(1);
  if (!releve) notFound();

  const valide = releve.statut === "valide";

  // Les familles d'intérêt déclarées aux premiers pas nourrissent l'affinité.
  const familles = orienter(utilisateur.interets).map((r) => r.famille);
  const notes = Object.fromEntries(
    Object.entries(releve.matieres)
      .filter(([, v]) => v.note !== null)
      .map(([k, v]) => [k, v.note as number]),
  );
  const pistes = valide && releve.serie
    ? recommander({ serie: releve.serie, notes }, familles, { tri: "classement", top: 12 })
    : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/orientation", label: "Mon orientation" }]}
        titre={valide ? "Mes pistes d'orientation" : "Vérifier mon relevé"}
        sousTitre={
          valide
            ? "Les filières du guide officiel 2026-2027, classées par votre moyenne de classement et votre affinité. Chaque piste porte ses raisons."
            : "La lecture automatique a fait son travail : les coefficients viennent du barème officiel, la moyenne est recalculée ici. Corrigez ce qui est faux, puis validez."
        }
      />

      {releve.controle.length > 0 && (
        <div className="mt-6">
          <Alerte erreur={`Écarts détectés : ${releve.controle.map((c) => `${c.champ} — ${c.probleme}`).join(" ; ")}.`} />
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <p className="text-xs text-encre-doux">Série</p>
          <p className="text-xl font-bold">{releve.serie || "à choisir"}</p>
        </div>
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <p className="text-xs text-encre-doux">Moyenne recalculée</p>
          <p className="text-xl font-bold">
            {releve.moyenne === null ? "—" : `${releve.moyenne}/20`}
          </p>
        </div>
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <p className="text-xs text-encre-doux">Mention</p>
          <p className="text-xl font-bold">{releve.mention || "—"}</p>
        </div>
      </section>

      {!valide && (
        <>
          {releve.fichier && (
            <details className="mt-6 rounded-2xl border border-ligne bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Voir la photo envoyée
              </summary>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={releve.fichier} alt="Photo du relevé envoyé" className="mt-3 max-w-full rounded-xl border border-ligne" />
            </details>
          )}
          <div className="mt-6">
            <FormulaireCorrection
              releveId={releve.id}
              serie={releve.serie}
              nom={releve.nom}
              numTable={releve.numTable}
              moyenneAnnoncee={
                String(
                  (releve.brut as { moyenne?: number | null } | null)?.moyenne ??
                    releve.moyenne ??
                    "",
                )
              }
              decision={releve.decision}
              matieres={releve.matieres}
            />
          </div>
        </>
      )}

      {valide && (
        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">
            Filières conseillées ({pistes.length})
            {familles.length > 0 && (
              <span className="ml-2 text-sm font-normal text-encre-doux">
                affinité : {familles.join(", ")}
              </span>
            )}
          </h2>
          <ol className="mt-3 space-y-3">
            {pistes.map((p, i) => (
              <li key={`${p.etablissement}-${p.filiere}`} className="rounded-2xl border border-ligne bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">
                    {i + 1}. {p.filiere}
                  </h3>
                  <p className="text-sm font-medium text-vert-fonce">
                    {p.moyenneClassement === null
                      ? "classement incomplet"
                      : `M = ${p.moyenneClassement}/20`}
                  </p>
                </div>
                <p className="text-sm text-encre-doux">
                  {p.etablissement} · {p.institution}
                  {p.ville ? ` · ${p.ville}` : ""}
                  {p.modeEntree ? ` · entrée : ${p.modeEntree.toLowerCase()}` : ""}
                  {p.quota !== "0" ? ` · ${p.quota} places de bourse` : ""}
                </p>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
                  {p.raisons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-encre-doux">
            M : moyenne pondérée de vos notes sur les matières de classement
            de la fiche, coefficients du barème officiel de la série{" "}
            {releve.serie}. Source : guide officiel de l&apos;orientation
            2026-2027.{" "}
            <Link href="/orientation" className="text-vert underline">
              Modifier mon relevé
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
