import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { delegations, etablissements, liensFamille } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { detailFacture, libellesEtat } from "@/lib/finances";
import { FormulaireAnnulation, FormulaireEncaisser } from "../../formulaires";

export const metadata: Metadata = { title: "Dossier de facture" };

const modes: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  mobile_money: "Mobile Money",
};

export default async function DossierFacture({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idFacture = Number(id);
  if (!Number.isInteger(idFacture)) notFound();

  const dossier = await detailFacture(idFacture);
  if (!dossier) notFound();

  const utilisateur = await exiger("direction", "enseignant", "parent");

  // Qui peut ouvrir ce dossier : la direction ou le délégué finances de
  // l'établissement, ou le parent de l'élève concerné.
  let equipe = false;
  if (utilisateur.role === "direction") {
    const [ecole] = await db
      .select({ id: etablissements.id })
      .from(etablissements)
      .where(
        and(
          eq(etablissements.id, dossier.etablissementId),
          eq(etablissements.directionUserId, utilisateur.id),
        ),
      )
      .limit(1);
    equipe = Boolean(ecole);
  } else if (utilisateur.role === "enseignant") {
    const [delegation] = await db
      .select({ id: delegations.id })
      .from(delegations)
      .where(
        and(
          eq(delegations.etablissementId, dossier.etablissementId),
          eq(delegations.userId, utilisateur.id),
          eq(delegations.role, "finances"),
        ),
      )
      .limit(1);
    equipe = Boolean(delegation);
  } else {
    const [lien] = await db
      .select({ id: liensFamille.id })
      .from(liensFamille)
      .where(
        and(
          eq(liensFamille.parentUserId, utilisateur.id),
          eq(liensFamille.eleveUserId, dossier.eleveUserId),
        ),
      )
      .limit(1);
    if (!lien) redirect("/tableau-de-bord");
  }
  if (!equipe && utilisateur.role !== "parent") redirect("/tableau-de-bord");

  const [ecole] = await db
    .select({ nom: etablissements.nom })
    .from(etablissements)
    .where(eq(etablissements.id, dossier.etablissementId))
    .limit(1);

  const restant = dossier.montantTotal - dossier.paye;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <p className="text-sm text-encre-doux">
        {utilisateur.role === "parent" ? (
          <Link href="/mes-finances" className="underline hover:text-vert">
            Mes finances
          </Link>
        ) : (
          <Link href="/finances" className="underline hover:text-vert">
            Finances
          </Link>
        )}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Facture {dossier.numero}
        </h1>
        <span className="rounded-full bg-papier px-3 py-1 text-sm font-medium">
          {libellesEtat[dossier.etat]}
        </span>
      </div>
      <p className="mt-1 text-encre-doux">
        {dossier.fraisLibelle} — {dossier.eleveNom} · {ecole.nom}
      </p>

      {/* Tranches */}
      <section className="mt-6">
        <h2 className="font-semibold">Les tranches</h2>
        <table className="mt-2 w-full rounded-2xl border border-ligne bg-white text-sm">
          <thead>
            <tr className="border-b border-ligne text-left text-encre-doux">
              <th scope="col" className="px-4 py-2 font-medium">#</th>
              <th scope="col" className="px-4 py-2 font-medium">Montant</th>
              <th scope="col" className="px-4 py-2 font-medium">Échéance</th>
              <th scope="col" className="px-4 py-2 font-medium">Couvert</th>
            </tr>
          </thead>
          <tbody>
            {dossier.tranches.map((t) => (
              <tr key={t.id} className="border-b border-ligne/60 last:border-0">
                <td className="px-4 py-2">{t.ordre}</td>
                <td className="px-4 py-2">{t.montant.toLocaleString("fr-FR")} F</td>
                <td className="px-4 py-2">
                  {t.echeance}
                  {t.echue && (
                    <span className="ml-2 rounded-full bg-rouge-clair px-2 py-0.5 text-xs text-rouge">
                      échue
                    </span>
                  )}
                </td>
                <td className={`px-4 py-2 ${t.couverte ? "text-vert-fonce" : ""}`}>
                  {t.couvert.toLocaleString("fr-FR")} F
                  {t.couverte ? " ✓" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-encre-doux">
          Total {dossier.montantTotal.toLocaleString("fr-FR")} F · payé{" "}
          {dossier.paye.toLocaleString("fr-FR")} F · restant{" "}
          <span className="font-semibold text-encre">{restant.toLocaleString("fr-FR")} F</span>
        </p>
      </section>

      {/* Encaissement (équipe seulement) */}
      {equipe && (
        <section className="mt-8 rounded-2xl border border-ligne bg-white p-4">
          <h2 className="font-semibold">Enregistrer un paiement au guichet</h2>
          <FormulaireEncaisser factureId={dossier.id} restant={restant} />
        </section>
      )}

      {/* Paiements */}
      <section className="mt-8">
        <h2 className="font-semibold">Paiements ({dossier.paiements.length})</h2>
        {dossier.paiements.length === 0 ? (
          <p className="mt-2 text-sm text-encre-doux">Aucun paiement enregistré.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {dossier.paiements.map((p) => (
              <li
                key={p.id}
                className={`rounded-2xl border p-4 text-sm ${
                  p.annule ? "border-ligne bg-papier opacity-80" : "border-ligne bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {p.montant.toLocaleString("fr-FR")} F · {modes[p.mode] ?? p.mode}{" "}
                    <span className="font-mono text-xs text-encre-doux">{p.recuNumero || ""}</span>
                  </p>
                  {p.annule ? (
                    <span className="rounded-full bg-rouge-clair px-2 py-0.5 text-xs text-rouge">
                      annulé — {p.motifAnnulation}
                    </span>
                  ) : (
                    equipe && <FormulaireAnnulation paiementId={p.id} />
                  )}
                </div>
                <p className="mt-1 text-xs text-encre-doux">
                  {p.date} · encaissé par {p.auteur}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
                {!p.annule && (
                  <p className="mt-1">
                    <Link
                      href={`/finances/recus/${p.id}`}
                      className="text-xs font-medium text-vert underline hover:text-vert-fonce"
                    >
                      Voir le reçu imprimable
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
