import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inscriptions, presences, users } from "@/db/schema";
import { nomComplet } from "@/lib/auth";
import { gardeClasse } from "@/lib/garde-classe";
import FormulaireAppel from "./formulaire-appel";

export const metadata: Metadata = { title: "Appel" };

function aujourdhui() {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${maintenant.getFullYear()}-${mois}-${jour}`;
}

export default async function PageAppel({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: dateDemandee } = await searchParams;
  const contexte = await gardeClasse(Number(id));
  if (!contexte) redirect("/tableau-de-bord");
  const utilisateur = contexte.utilisateur;
  const classe = contexte.classe;
  const idClasse = classe.id;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateDemandee ?? "")
    ? (dateDemandee as string)
    : aujourdhui();

  const eleves = await db
    .select({
      id: users.id,
      prenom: users.prenom,
      nom: users.nom,
    })
    .from(inscriptions)
    .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, idClasse))
    .orderBy(asc(users.nom));

  const dejaSaisi = await db
    .select({
      eleveUserId: presences.eleveUserId,
      statut: presences.statut,
      motif: presences.motif,
    })
    .from(presences)
    .where(and(eq(presences.classeId, idClasse), eq(presences.date, date)));
  const parEleve = new Map(dejaSaisi.map((p) => [p.eleveUserId, p]));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="text-sm text-encre-doux">
        <Link href={`/classes/${classe.id}`} className="underline hover:text-vert">
          {classe.nom}
        </Link>{" "}
        · appel
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        Appel de {classe.nom}
      </h1>

      <form method="get" className="mt-4 flex items-end gap-3">
        <div>
          <label htmlFor="date" className="block text-sm font-medium">
            Date de l&apos;appel
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={date}
            className="mt-1 rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl border border-ligne bg-white px-4 py-2 text-sm font-medium hover:bg-papier"
        >
          Afficher
        </button>
      </form>

      {eleves.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
          Aucun élève inscrit dans cette classe.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-encre-doux">
            {eleves.length} élève{eleves.length > 1 ? "s" : ""}. Tout le monde est
            présélectionné présent : cochez les exceptions. Un appel déjà enregistré
            est repris et corrigé, jamais doublé. Les parents sont prévenus des
            retards et absences non justifiées.
          </p>
          <FormulaireAppel
            classeId={classe.id}
            date={date}
            eleves={eleves.map((e) => ({
              ...e,
              statutActuel: parEleve.get(e.id)?.statut ?? null,
              motifActuel: parEleve.get(e.id)?.motif ?? null,
            }))}
          />
        </>
      )}

      <p className="mt-6 text-sm text-encre-doux">
        Appel fait par {nomComplet(utilisateur)}.
      </p>
    </div>
  );
}
