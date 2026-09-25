import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { annulationsCreneaux } from "@/db/schema";
import { annulerSeanceFormulaire, retablirSeance } from "./actions";

/**
 * Le bloc d'annulation d'une séance (direction) : la date porte la
 * séance à annuler, le motif part aux familles. Les annulations posées
 * se listent en dessous, rétablisables.
 */
export default async function BlocAnnulation({
  creneauId,
  jour,
  matiere,
  peutGerer,
}: {
  creneauId: number;
  jour: string;
  matiere: string;
  peutGerer: boolean;
}) {
  if (!peutGerer) return null;

  const annulations = await db
    .select({ date: annulationsCreneaux.date, motif: annulationsCreneaux.motif })
    .from(annulationsCreneaux)
    .where(eq(annulationsCreneaux.creneauId, creneauId))
    .orderBy(asc(annulationsCreneaux.date));

  return (
    <div className="mt-2 border-t border-ligne/60 pt-2 text-sm">
      <p className="text-xs text-encre-doux">
        {jour} · {matiere} — annuler une séance à venir :
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <form action={annulerSeanceFormulaire} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="creneauId" value={creneauId} />
          <input
            type="date"
            name="date"
            required
            className="rounded-lg border border-ligne bg-white px-2 py-1 text-xs"
          />
          <input
            name="motif"
            maxLength={140}
            placeholder="Motif (prof absent, jour férié…)"
            className="w-56 rounded-lg border border-ligne bg-white px-2 py-1 text-xs"
          />
          <button
            type="submit"
            className="rounded-lg border border-rouge/40 px-3 py-1 text-xs font-medium text-rouge hover:bg-rouge-clair"
          >
            Annuler cette séance
          </button>
        </form>
      </div>
      {annulations.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {annulations.map((a) => (
            <li key={a.date} className="flex items-center gap-2 text-xs">
              <span className="rounded bg-rouge-clair px-2 py-0.5 font-medium text-rouge">
                {a.date} annulé{a.motif ? ` — ${a.motif}` : ""}
              </span>
              <form action={retablirSeance}>
                <input type="hidden" name="creneauId" value={creneauId} />
                <input type="hidden" name="date" value={a.date} />
                <button type="submit" className="text-encre-doux underline hover:text-encre">
                  Rétablir
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
