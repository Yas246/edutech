import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  delegations,
  etablissements,
  factures,
  frais,
  liensFamille,
  paiements,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { detailFacture } from "@/lib/finances";
import BoutonImprimer from "@/app/classes/[id]/bulletins/[eleveId]/bouton-imprimer";

export const metadata: Metadata = { title: "Reçu" };

const modes: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  mobile_money: "Mobile Money",
};

export default async function Recu({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idPaiement = Number(id);
  if (!Number.isInteger(idPaiement)) notFound();

  const utilisateur = await exiger("direction", "enseignant", "parent");

  const [paiement] = await db
    .select({
      id: paiements.id,
      recuNumero: paiements.recuNumero,
      montant: paiements.montant,
      mode: paiements.mode,
      note: paiements.note,
      date: paiements.createdAt,
      annule: paiements.annule,
      factureId: paiements.factureId,
      auteurPrenom: users.prenom,
      auteurNom: users.nom,
    })
    .from(paiements)
    .innerJoin(users, eq(users.id, paiements.auteurUserId))
    .where(eq(paiements.id, idPaiement))
    .limit(1);
  if (!paiement || paiement.annule) notFound();

  const dossier = await detailFacture(paiement.factureId);
  if (!dossier) notFound();

  // Garde identique au dossier de facture.
  if (utilisateur.role === "enseignant") {
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
    if (!delegation) redirect("/tableau-de-bord");
  } else if (utilisateur.role === "parent") {
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

  const [ecole] = await db
    .select({ nom: etablissements.nom, commune: etablissements.commune })
    .from(etablissements)
    .where(eq(etablissements.id, dossier.etablissementId))
    .limit(1);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <p className="print:hidden">
        <Link
          href={`/finances/factures/${dossier.id}`}
          className="text-sm font-medium text-vert underline hover:text-vert-fonce"
        >
          ← Retour au dossier
        </Link>
      </p>

      <article className="mt-4 rounded-2xl border border-ligne bg-white p-8 print:rounded-none print:border-0">
        <header className="border-b-2 border-vert pb-3 text-center">
          <p className="text-xs uppercase tracking-widest text-encre-doux">
            République du Bénin
          </p>
          <h1 className="mt-1 text-xl font-bold text-vert-fonce">{ecole.nom}</h1>
          <p className="text-sm text-encre-doux">Reçu de paiement</p>
        </header>

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between border-b border-ligne/60 pb-1">
            <dt className="text-encre-doux">Numéro du reçu</dt>
            <dd className="font-mono font-semibold">{paiement.recuNumero}</dd>
          </div>
          <div className="flex justify-between border-b border-ligne/60 pb-1">
            <dt className="text-encre-doux">Élève</dt>
            <dd className="font-medium">{dossier.eleveNom}</dd>
          </div>
          <div className="flex justify-between border-b border-ligne/60 pb-1">
            <dt className="text-encre-doux">Objet</dt>
            <dd className="font-medium">{dossier.fraisLibelle}</dd>
          </div>
          <div className="flex justify-between border-b border-ligne/60 pb-1">
            <dt className="text-encre-doux">Montant reçu</dt>
            <dd className="text-lg font-bold text-vert">
              {paiement.montant.toLocaleString("fr-FR")} F CFA
            </dd>
          </div>
          <div className="flex justify-between border-b border-ligne/60 pb-1">
            <dt className="text-encre-doux">Mode</dt>
            <dd className="font-medium">{modes[paiement.mode] ?? paiement.mode}</dd>
          </div>
          <div className="flex justify-between border-b border-ligne/60 pb-1">
            <dt className="text-encre-doux">Encaissé par</dt>
            <dd>
              {paiement.auteurPrenom} {paiement.auteurNom} ·{" "}
              {paiement.date.toISOString().slice(0, 10)}
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-right text-xs text-encre-doux">
          Fait à {ecole.commune} · document faisant foi de l&apos;encaissement
        </p>
      </article>

      <div className="mt-4 print:hidden">
        <BoutonImprimer />
      </div>
    </div>
  );
}
