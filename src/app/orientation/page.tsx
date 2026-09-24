import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { relevesOrientation } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import { Badge } from "@/components/ui/badge";
import { FormulairePhoto, FormulaireSaisie } from "./formulaires";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mon orientation" };

export default async function Orientation() {
  const utilisateur = await exiger("eleve");

  const mesReleves = await db
    .select({
      id: relevesOrientation.id,
      serie: relevesOrientation.serie,
      moyenne: relevesOrientation.moyenne,
      mention: relevesOrientation.mention,
      statut: relevesOrientation.statut,
      createdAt: relevesOrientation.createdAt,
    })
    .from(relevesOrientation)
    .where(eq(relevesOrientation.eleveUserId, utilisateur.id))
    .orderBy(desc(relevesOrientation.id))
    .limit(10);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <EnTetePage
        titre="Mon orientation"
        sousTitre="Votre relevé du baccalauréat, vérifié ligne à ligne, puis les filières du guide officiel 2026-2027 qui correspondent : série acceptée, moyenne de classement, affinité avec vos centres d'intérêt."
      />

      {mesReleves.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">Mes relevés</h2>
          <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
            {mesReleves.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    Série {r.serie || "à préciser"} ·{" "}
                    {r.moyenne === null ? "moyenne à compléter" : `${r.moyenne}/20`}
                    {r.mention ? ` · ${r.mention}` : ""}
                  </p>
                  <p className="text-sm text-encre-doux">
                    {r.statut === "valide"
                      ? "Validé : vos pistes d'orientation sont prêtes."
                      : "À confirmer : vérifiez la lecture ligne par ligne."}
                  </p>
                </div>
                <Link
                  href={`/orientation/${r.id}`}
                  className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
                >
                  {r.statut === "valide" ? "Voir mes pistes" : "Vérifier et valider"}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-encre-doux">
            Un relevé validé porte le badge de confirmation ; les pistes
            citent le guide, jamais une supposition.
          </p>
          <div className="mt-1">
            <Badge>{mesReleves.filter((r) => r.statut === "valide").length} validé(s)</Badge>
          </div>
        </section>
      )}

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <FormulairePhoto />
        <FormulaireSaisie />
      </section>

      {mesReleves.length === 0 && (
        <div className="mt-8">
          <EtatVide>
            Aucun relevé pour l&apos;instant : envoyez la photo de votre
            relevé du baccalauréat ou saisissez vos notes pour découvrir vos
            filières.
          </EtatVide>
        </div>
      )}
    </div>
  );
}
