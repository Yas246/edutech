import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  abonnementsTransport,
  arrets,
  inscriptions,
  lignesTransport,
  liensFamille,
  tickets,
  users,
} from "@/db/schema";
import { utilisateurCourant, exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import { Bouton, champClasse } from "@/components/ui/formulaire";
import { acheterTicket, abonner } from "./actions";
import FormulaireTransport from "./formulaire-transport";

export const metadata: Metadata = {
  title: "Transport scolaire",
  description:
    "Les lignes de bus du dispositif national : arrêts, horaires et ticket à 200 F, achetable en ligne ou par code USSD.",
};

export default async function Transport() {
  const utilisateur = await utilisateurCourant();

  const lignes = await db
    .select()
    .from(lignesTransport)
    .where(eq(lignesTransport.active, true))
    .orderBy(asc(lignesTransport.ville));
  const tousArrets = await db
    .select()
    .from(arrets)
    .orderBy(asc(arrets.ordre));

  // Espace élève : abonnement et tickets.
  let monAbonnement: { ligneNom: string; arretNom: string; ligneId: number } | null = null;
  let mesTickets: { id: number; code: string; ligne: string; date: Date }[] = [];
  if (utilisateur?.role === "eleve") {
    await exiger("eleve");
    const [abonnement] = await db
      .select({ ligneId: lignesTransport.id, ligneNom: lignesTransport.nom, arretNom: arrets.nom })
      .from(abonnementsTransport)
      .innerJoin(lignesTransport, eq(lignesTransport.id, abonnementsTransport.ligneId))
      .innerJoin(arrets, eq(arrets.id, abonnementsTransport.arretId))
      .where(eq(abonnementsTransport.eleveUserId, utilisateur.id))
      .limit(1);
    monAbonnement = abonnement ?? null;
    mesTickets = await db
      .select({ id: tickets.id, code: tickets.code, ligne: lignesTransport.nom, date: tickets.acheteLe })
      .from(tickets)
      .innerJoin(lignesTransport, eq(lignesTransport.id, tickets.ligneId))
      .where(eq(tickets.eleveUserId, utilisateur.id))
      .orderBy(desc(tickets.id))
      .limit(10);
  }

  // Espace parent : la ligne et les derniers tickets de chaque enfant.
  let enfantsTransport: { enfant: string; ligne: string | null; arret: string | null; dernierTicket: string | null }[] = [];
  if (utilisateur?.role === "parent") {
    const enfants = await db
      .select({ id: users.id, prenom: users.prenom, nom: users.nom })
      .from(liensFamille)
      .innerJoin(users, eq(users.id, liensFamille.eleveUserId))
      .where(eq(liensFamille.parentUserId, utilisateur.id));
    for (const enfant of enfants) {
      const [abonnement] = await db
        .select({ ligneNom: lignesTransport.nom, arretNom: arrets.nom })
        .from(abonnementsTransport)
        .innerJoin(lignesTransport, eq(lignesTransport.id, abonnementsTransport.ligneId))
        .innerJoin(arrets, eq(arrets.id, abonnementsTransport.arretId))
        .where(eq(abonnementsTransport.eleveUserId, enfant.id))
        .limit(1);
      const [dernier] = await db
        .select({ code: tickets.code })
        .from(tickets)
        .where(eq(tickets.eleveUserId, enfant.id))
        .orderBy(desc(tickets.id))
        .limit(1);
      enfantsTransport.push({
        enfant: `${enfant.prenom} ${enfant.nom}`,
        ligne: abonnement?.ligneNom ?? null,
        arret: abonnement?.arretNom ?? null,
        dernierTicket: dernier?.code ?? null,
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <EnTetePage
        titre="Transport scolaire"
        sousTitre="Le dispositif national de bus : ticket à 200 F, achetable en ligne ou par code USSD *611# pour ceux qui n'ont pas de smartphone."
      />

      {/* Espace élève */}
      {utilisateur?.role === "eleve" && (
        <section className="mt-8 rounded-2xl border border-ligne bg-white p-5">
          <h2 className="text-xl font-bold tracking-tight">Mon transport</h2>
          {monAbonnement ? (
            <p className="mt-2 text-sm">
              Abonné à la ligne <span className="font-semibold">{monAbonnement.ligneNom}</span>,
              arrêt {monAbonnement.arretNom}.
            </p>
          ) : (
            <div className="mt-3">
              <FormulaireTransport
                lignes={lignes.map((l) => ({ id: l.id, nom: l.nom }))}
                arrets={tousArrets.map((a) => ({ id: a.id, nom: a.nom, ligneId: a.ligneId }))}
              />
            </div>
          )}
          {monAbonnement && (
            <form action={acheterTicketFormulaire} className="mt-3">
              <input type="hidden" name="ligneId" value={monAbonnement.ligneId} />
              <Bouton type="submit">Acheter un ticket à 200 F</Bouton>
            </form>
          )}
          {mesTickets.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {mesTickets.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="font-mono">{t.code}</span>
                  <span className="text-encre-doux">
                    {t.ligne} · {t.date.toISOString().slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Espace parent */}
      {utilisateur?.role === "parent" && enfantsTransport.length > 0 && (
        <section className="mt-8 rounded-2xl border border-ligne bg-white p-5">
          <h2 className="text-xl font-bold tracking-tight">Le transport de mes enfants</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {enfantsTransport.map((e) => (
              <li key={e.enfant} className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{e.enfant}</span>
                <span className="text-encre-doux">
                  {e.ligne ? `${e.ligne}, arrêt ${e.arret}` : "pas d'abonnement"}
                  {e.dernierTicket ? ` · dernier ticket ${e.dernierTicket}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Lignes publiques */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          Les lignes ({lignes.length})
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {lignes.map((l) => (
            <article key={l.id} className="rounded-2xl border border-ligne bg-white p-5">
              <h3 className="font-semibold text-vert-fonce">{l.nom}</h3>
              <p className="mt-1 text-sm text-encre-doux">
                {l.ville} → {l.destination} · {l.horaireDebut} à {l.horaireFin}
              </p>
              <p className="mt-3 text-xs uppercase tracking-wide text-encre-doux">Arrêts</p>
              <ol className="mt-1 flex flex-wrap gap-1.5 text-xs">
                {tousArrets
                  .filter((a) => a.ligneId === l.id)
                  .map((a) => (
                    <li key={a.id} className="rounded-full bg-papier px-2.5 py-1">
                      {a.ordre}. {a.nom}
                    </li>
                  ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm text-encre-doux">
        Pas de smartphone ? Le ticket s'achète aussi avec le code USSD{" "}
        <span className="font-mono font-semibold text-encre">*611#</span> sur
        n'importe quel téléphone.{" "}
        {!utilisateur && (
          <Link href="/inscription" className="text-vert underline hover:text-vert-fonce">
            Créez un compte élève pour vous abonner
          </Link>
        )}
      </p>
    </div>
  );
}

async function acheterTicketFormulaire(donnees: FormData) {
  "use server";
  await acheterTicket({}, donnees);
}
