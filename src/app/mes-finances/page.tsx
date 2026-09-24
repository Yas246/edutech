import type { Metadata } from "next";
import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { factures, frais, liensFamille, periodes, tranches, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { detailFacture, libelleFrais, libellesEtat, type EtatFacture } from "@/lib/finances";
import FormulaireMobileMoney from "./formulaire-mobile-money";

export const metadata: Metadata = { title: "Mes finances" };

const couleursEtat: Record<EtatFacture, string> = {
  a_payer: "bg-papier text-encre-doux",
  partiellement_paye: "bg-jaune-clair text-encre",
  paye: "bg-vert-clair text-vert-fonce",
  en_retard: "bg-rouge-clair text-rouge",
  annule: "bg-papier text-encre-doux",
};

export default async function MesFinances() {
  const parent = await exiger("parent");

  const enfants = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(liensFamille)
    .innerJoin(users, eq(users.id, liensFamille.eleveUserId))
    .where(eq(liensFamille.parentUserId, parent.id));

  const idsEnfants = enfants.map((e) => e.id);

  const listeFactures = idsEnfants.length
    ? await db
        .select({
          id: factures.id,
          eleveUserId: factures.eleveUserId,
          numero: factures.numero,
          categorie: frais.categorie,
          libelle: frais.libelle,
          periodeNom: periodes.nom,
        })
        .from(factures)
        .innerJoin(frais, eq(frais.id, factures.fraisId))
        .leftJoin(periodes, eq(periodes.id, factures.periodeId))
        .where(inArray(factures.eleveUserId, idsEnfants))
        .orderBy(factures.id)
    : [];

  const dossiers = [];
  for (const f of listeFactures) {
    dossiers.push(await detailFacture(f.id));
  }

  // Totaux consolidés de tous les enfants.
  const attendu = dossiers.reduce((a, d) => a + (d?.montantTotal ?? 0), 0);
  const paye = dossiers.reduce((a, d) => a + (d?.paye ?? 0), 0);
  const enRetard = dossiers
    .filter((d) => d?.etat === "en_retard")
    .reduce((a, d) => a + (d!.montantTotal - d!.paye), 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Mes finances</h1>
      <p className="mt-2 text-encre-doux">
        La situation scolaire de vos enfants : factures, échéances et reçus.
      </p>

      {enfants.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
          Aucun enfant relié à votre compte.{" "}
          <Link href="/mes-enfants" className="text-vert underline">
            Reliez votre premier enfant
          </Link>
          .
        </p>
      ) : (
        <dl className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-ligne bg-white p-4">
            <dt className="text-sm text-encre-doux">Attendu</dt>
            <dd className="text-xl font-bold">{attendu.toLocaleString("fr-FR")} F</dd>
          </div>
          <div className="rounded-2xl border border-ligne bg-white p-4">
            <dt className="text-sm text-encre-doux">Payé</dt>
            <dd className="text-xl font-bold text-vert">{paye.toLocaleString("fr-FR")} F</dd>
          </div>
          <div className="rounded-2xl border border-ligne bg-white p-4">
            <dt className="text-sm text-encre-doux">En retard</dt>
            <dd className={`text-xl font-bold ${enRetard > 0 ? "text-rouge" : ""}`}>
              {enRetard.toLocaleString("fr-FR")} F
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-8 space-y-8">
        {dossiers.map((d) => {
          if (!d) return null;
          const enfant = enfants.find((e) => e.id === d.eleveUserId);
          const restant = d.montantTotal - d.paye;
          return (
            <article key={d.id} className="rounded-2xl border border-ligne bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    {d.fraisLibelle} — {enfant?.prenom} {enfant?.nom}
                  </h2>
                  <p className="text-sm text-encre-doux">
                    Facture {d.numero} · total {d.montantTotal.toLocaleString("fr-FR")} F · payé{" "}
                    {d.paye.toLocaleString("fr-FR")} F
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${couleursEtat[d.etat]}`}>
                  {libellesEtat[d.etat]}
                </span>
              </div>

              <ul className="mt-3 space-y-1 text-sm">
                {d.tranches.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span>
                      Tranche {t.ordre} · échéance {t.echeance}
                      {t.echue && (
                        <span className="ml-2 rounded-full bg-rouge-clair px-2 py-0.5 text-xs text-rouge">
                          échue
                        </span>
                      )}
                    </span>
                    <span className={t.couverte ? "text-vert-fonce" : "font-medium"}>
                      {t.montant.toLocaleString("fr-FR")} F
                      {t.couverte ? " ✓" : ` — reste ${(t.montant - t.couvert).toLocaleString("fr-FR")} F`}
                    </span>
                  </li>
                ))}
              </ul>

              {restant > 0 && (
                <div className="mt-4 border-t border-ligne pt-4">
                  <FormulaireMobileMoney factureId={d.id} restant={restant} />
                </div>
              )}

              {d.paiements.length > 0 && (
                <div className="mt-4 border-t border-ligne pt-3">
                  <h3 className="text-sm font-semibold">Paiements</h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {d.paiements.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span className={p.annule ? "text-encre-doux line-through" : ""}>
                          {p.montant.toLocaleString("fr-FR")} F · {p.date}
                          {p.annule ? ` (annulé : ${p.motifAnnulation})` : ""}
                        </span>
                        {!p.annule && (
                          <Link
                            href={`/finances/recus/${p.id}`}
                            className="text-xs font-medium text-vert underline hover:text-vert-fonce"
                          >
                            Reçu {p.recuNumero}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
