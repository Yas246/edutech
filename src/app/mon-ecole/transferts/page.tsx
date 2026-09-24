import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  etablissements,
  inscriptions,
  transferts,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import { statuerTransfertOrigine } from "./actions";
import FormulaireDemande from "./formulaire-demande";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Transferts d'élèves" };

const libellesStatut: Record<string, string> = {
  demande: "En attente de l'école d'origine",
  valide: "Accepté",
  refuse: "Refusé",
};

export default async function Transferts() {
  const utilisateur = await exiger("direction");
  const [monEcole] = await db
    .select({ id: etablissements.id, nom: etablissements.nom })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, utilisateur.id))
    .limit(1);
  if (!monEcole) redirect("/tableau-de-bord");

  const mesClasses = await db
    .select({ id: classes.id, nom: classes.nom })
    .from(classes)
    .where(eq(classes.etablissementId, monEcole.id))
    .orderBy(asc(classes.nom));

  const lignes = await db
    .select({
      id: transferts.id,
      statut: transferts.statut,
      statutArrivee: transferts.statutArrivee,
      motif: transferts.motif,
      elevePrenom: users.prenom,
      eleveNom: users.nom,
      depart: transferts.etablissementDepart,
      arrivee: transferts.etablissementArrivee,
      classeArrivee: classes.nom,
      creeLe: transferts.createdAt,
    })
    .from(transferts)
    .innerJoin(users, eq(users.id, transferts.eleveUserId))
    .leftJoin(classes, eq(classes.id, transferts.classeArriveeId))
    .where(
      or(
        eq(transferts.etablissementArrivee, monEcole.id),
        eq(transferts.etablissementDepart, monEcole.id),
      ),
    )
    .orderBy(desc(transferts.id))
    .limit(50);

  const nomsEcoles = new Map<number, string>();
  const idsEcoles = new Set<number>();
  for (const l of lignes) {
    idsEcoles.add(l.depart);
    idsEcoles.add(l.arrivee);
  }
  if (idsEcoles.size > 0) {
    const ecoles = await db
      .select({ id: etablissements.id, nom: etablissements.nom })
      .from(etablissements);
    for (const e of ecoles) nomsEcoles.set(e.id, e.nom);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/mon-ecole", label: monEcole.nom }]}
        titre="Transferts d'élèves"
        sousTitre="Le mouvement inter-établissements, comme dans le système national : une demande par élève, la validation du ministère, l'historique préservé."
      />

      <div className="mt-8">
        <FormulaireDemande mesClasses={mesClasses} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">Mes dossiers</h2>
        {lignes.length === 0 ? (
          <div className="mt-3">
            <EtatVide>Aucun dossier de transfert pour l&apos;instant.</EtatVide>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
            {lignes.map((l) => {
              const entrant = l.arrivee === monEcole.id;
              return (
                <li key={l.id} className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {l.elevePrenom} {l.eleveNom}
                      <span className="text-sm font-normal text-encre-doux">
                        {" "}
                        · {entrant ? "entrant" : "sortant"} · {l.statutArrivee}
                      </span>
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        l.statut === "valide"
                          ? "bg-vert-clair text-vert-fonce"
                          : l.statut === "refuse"
                            ? "bg-rouge-clair text-rouge"
                            : "border border-ligne text-encre-doux"
                      }`}
                    >
                      {libellesStatut[l.statut] ?? l.statut}
                    </span>
                  </div>
                  <p className="text-sm text-encre-doux">
                    {nomsEcoles.get(l.depart)} → {nomsEcoles.get(l.arrivee)}
                    {l.classeArrivee ? ` · classe d'accueil : ${l.classeArrivee}` : ""}
                  </p>
                  {l.motif && (
                    <p className="mt-1 text-sm text-encre-doux">Motif : {l.motif}</p>
                  )}
                  {!entrant && l.statut === "demande" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-encre-doux">
                        L&apos;élève vous porte cette demande : acceptez-vous
                        de le libérer ?
                      </p>
                      <form action={statuerTransfertOrigine}>
                        <input type="hidden" name="transfertId" value={l.id} />
                        <input type="hidden" name="decision" value="valide" />
                        <button
                          type="submit"
                          className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
                        >
                          Accepter (transfert numérique)
                        </button>
                      </form>
                      <form action={statuerTransfertOrigine}>
                        <input type="hidden" name="transfertId" value={l.id} />
                        <input type="hidden" name="decision" value="refuse" />
                        <button
                          type="submit"
                          className="rounded-xl border border-rouge/40 px-4 py-2 text-sm font-medium text-rouge hover:bg-rouge-clair"
                        >
                          Refuser
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
