import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  delegations,
  etablissements,
  factures,
  frais,
  paiements,
  periodes,
  tranches,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { calculerEtat, libelleFrais } from "@/lib/finances";
import { BadgeEtatFacture } from "@/components/ui/badge";
import { EtatVide } from "@/components/ui/etat-vide";
import {
  FormulaireDelegation,
  FormulaireFrais,
  FormulaireGeneration,
} from "./formulaires";

export const metadata: Metadata = { title: "Finances" };

export default async function PageFinances() {
  const utilisateur = await exiger("direction", "enseignant");

  // L'établissement dont on tient (ou délègue) les finances.
  let idEcole: number | null = null;
  if (utilisateur.role === "direction") {
    const [ecole] = await db
      .select({ id: etablissements.id, nom: etablissements.nom })
      .from(etablissements)
      .where(eq(etablissements.directionUserId, utilisateur.id))
      .limit(1);
    idEcole = ecole?.id ?? null;
  } else {
    const [delegation] = await db
      .select({ etablissementId: delegations.etablissementId })
      .from(delegations)
      .where(and(eq(delegations.userId, utilisateur.id), eq(delegations.role, "finances")))
      .limit(1);
    idEcole = delegation?.etablissementId ?? null;
  }
  if (!idEcole) redirect("/tableau-de-bord");

  const [ecole] = await db
    .select({ nom: etablissements.nom })
    .from(etablissements)
    .where(eq(etablissements.id, idEcole));

  const mesClasses = await db
    .select({ id: classes.id, nom: classes.nom })
    .from(classes)
    .where(eq(classes.etablissementId, idEcole))
    .orderBy(asc(classes.nom));

  const mesPeriodes = await db
    .select({ id: periodes.id, nom: periodes.nom })
    .from(periodes)
    .where(eq(periodes.etablissementId, idEcole))
    .orderBy(asc(periodes.debut));

  const mesFrais = await db
    .select({
      id: frais.id,
      categorie: frais.categorie,
      libelle: frais.libelle,
      montant: frais.montant,
      cibleType: frais.cibleType,
      cibleClasseId: frais.cibleClasseId,
      cibleNiveau: frais.cibleNiveau,
      periodeNom: periodes.nom,
    })
    .from(frais)
    .leftJoin(periodes, eq(periodes.id, frais.periodeId))
    .where(eq(frais.etablissementId, idEcole))
    .orderBy(asc(frais.id));

  const listeFactures = await db
    .select({
      id: factures.id,
      numero: factures.numero,
      elevePrenom: users.prenom,
      eleveNom: users.nom,
      fraisId: factures.fraisId,
    })
    .from(factures)
    .innerJoin(users, eq(users.id, factures.eleveUserId))
    .innerJoin(frais, eq(frais.id, factures.fraisId))
    .where(eq(frais.etablissementId, idEcole))
    .orderBy(asc(factures.numero));

  // Statuts recalculés à la volée (jamais stockés).
  const idsFactures = listeFactures.map((f) => f.id);
  const toutesTranches = idsFactures.length
    ? await db.select().from(tranches).where(inArray(tranches.factureId, idsFactures))
    : [];
  const tousPaiements = idsFactures.length
    ? await db
        .select({ factureId: paiements.factureId, montant: paiements.montant, annule: paiements.annule })
        .from(paiements)
        .where(inArray(paiements.factureId, idsFactures))
    : [];

  const parFacture = listeFactures.map((f) => {
    const tr = toutesTranches.filter((t) => t.factureId === f.id);
    const paye = tousPaiements
      .filter((p) => p.factureId === f.id && !p.annule)
      .reduce((a, p) => a + p.montant, 0);
    const total = tr.reduce((a, t) => a + t.montant, 0);
    return {
      ...f,
      total,
      paye,
      etat: calculerEtat(tr, paye),
    };
  });

  const attendu = parFacture.reduce((a, f) => a + f.total, 0);
  const encaisse = parFacture.reduce((a, f) => a + f.paye, 0);
  const enRetard = parFacture
    .filter((f) => f.etat === "en_retard")
    .reduce((a, f) => a + (f.total - f.paye), 0);

  // Délégation : la direction seul juge.
  const [direction] = utilisateur.role === "direction"
    ? [{ id: utilisateur.id }]
    : [];
  const membresEquipe = direction
    ? await db
        .select({ id: users.id, prenom: users.prenom, nom: users.nom })
        .from(users)
        .where(eq(users.role, "enseignant"))
        .orderBy(asc(users.nom))
    : [];
  const delegues = direction
    ? (
        await db
          .select({ userId: delegations.userId })
          .from(delegations)
          .where(and(eq(delegations.etablissementId, idEcole), eq(delegations.role, "finances")))
      ).map((d) => d.userId)
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Finances — {ecole.nom}</h1>
      <p className="mt-2 max-w-2xl text-encre-doux">
        Le suivi des recettes scolaires : qui doit quoi, combien est payé, ce
        qui reste. Le suivi, sans remplacer la comptabilité.
      </p>

      {/* Tableau de bord */}
      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <dt className="text-sm text-encre-doux">Attendu</dt>
          <dd className="text-xl font-bold">{attendu.toLocaleString("fr-FR")} F</dd>
        </div>
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <dt className="text-sm text-encre-doux">Encaissé</dt>
          <dd className="text-xl font-bold text-vert">{encaisse.toLocaleString("fr-FR")} F</dd>
        </div>
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <dt className="text-sm text-encre-doux">Restant dû</dt>
          <dd className="text-xl font-bold">{(attendu - encaisse).toLocaleString("fr-FR")} F</dd>
        </div>
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <dt className="text-sm text-encre-doux">Dont en retard</dt>
          <dd className={`text-xl font-bold ${enRetard > 0 ? "text-rouge" : ""}`}>
            {enRetard.toLocaleString("fr-FR")} F
          </dd>
        </div>
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <FormulaireFrais classesList={mesClasses} periodesList={mesPeriodes} />
        <FormulaireGeneration
          frais={mesFrais.map((f) => ({
            id: f.id,
            libelleComplet: libelleFrais({
              categorie: f.categorie,
              libelle: f.libelle,
              periodeNom: f.periodeNom,
            }),
            montant: f.montant,
          }))}
        />
      </div>

      {/* Les frais posés */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Les frais ({mesFrais.length})</h2>
        {mesFrais.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-5 text-sm text-encre-doux">
            Aucun frais posé. Commencez par la scolarité.
          </p>
        ) : (
          <table className="mt-3 w-full rounded-2xl border border-ligne bg-white text-sm">
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Frais</th>
                <th scope="col" className="px-4 py-2 font-medium">Montant</th>
                <th scope="col" className="px-4 py-2 font-medium">Visé</th>
              </tr>
            </thead>
            <tbody>
              {mesFrais.map((f) => (
                <tr key={f.id} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2 font-medium">
                    {libelleFrais({
                      categorie: f.categorie,
                      libelle: f.libelle,
                      periodeNom: f.periodeNom,
                    })}
                  </td>
                  <td className="px-4 py-2">{f.montant.toLocaleString("fr-FR")} F</td>
                  <td className="px-4 py-2 text-encre-doux">
                    {f.cibleType === "classe"
                      ? (mesClasses.find((c) => c.id === f.cibleClasseId)?.nom ?? "classe")
                      : `niveau ${f.cibleNiveau}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Les factures */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          Les factures ({listeFactures.length})
        </h2>
        {listeFactures.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-5 text-sm text-encre-doux">
            Aucune facture encore générée.
          </p>
        ) : (
          <table className="mt-3 w-full rounded-2xl border border-ligne bg-white text-sm">
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Numéro</th>
                <th scope="col" className="px-4 py-2 font-medium">Élève</th>
                <th scope="col" className="px-4 py-2 font-medium">Total</th>
                <th scope="col" className="px-4 py-2 font-medium">Payé</th>
                <th scope="col" className="px-4 py-2 font-medium">État</th>
                <th scope="col" className="px-4 py-2">
                  <span className="sr-only">Dossier</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {parFacture.map((f) => (
                <tr key={f.id} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{f.numero}</td>
                  <td className="px-4 py-2 font-medium">
                    {f.elevePrenom} {f.eleveNom}
                  </td>
                  <td className="px-4 py-2">{f.total.toLocaleString("fr-FR")} F</td>
                  <td className="px-4 py-2">{f.paye.toLocaleString("fr-FR")} F</td>
                  <td className="px-4 py-2">
                    <BadgeEtatFacture etat={f.etat} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/finances/factures/${f.id}`}
                      className="text-sm font-medium text-vert underline hover:text-vert-fonce"
                    >
                      Dossier
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Délégation : la direction seulement */}
      {direction && (
        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Délégation</h2>
          <div className="mt-3">
            <FormulaireDelegation membres={membresEquipe} delegues={delegues} />
          </div>
        </section>
      )}
    </div>
  );
}
