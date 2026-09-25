import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  communautes,
  communautesMembres,
  publications,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { basculerAdhesion, publierSurCommunaute } from "../actions";
import FormulaireMur from "./formulaire-mur";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Communauté" };

export default async function MurCommunaute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const utilisateur = await exiger();
  const { id } = await params;

  const [communaute] = await db
    .select()
    .from(communautes)
    .where(eq(communautes.id, Number(id)))
    .limit(1);
  if (!communaute) notFound();

  const [membre] = await db
    .select({ role: communautesMembres.role })
    .from(communautesMembres)
    .where(
      sql`${communautesMembres.communauteId} = ${communaute.id} AND ${communautesMembres.userId} = ${utilisateur.id}`,
    )
    .limit(1);
  const estMembre = Boolean(membre);

  const [compte] = await db
    .select({ n: sql<number>`count(*)` })
    .from(communautesMembres)
    .where(eq(communautesMembres.communauteId, communaute.id));

  const membres = await db
    .select({
      id: users.id,
      prenom: users.prenom,
      nom: users.nom,
      pseudo: users.pseudo,
      role: communautesMembres.role,
    })
    .from(communautesMembres)
    .innerJoin(users, eq(users.id, communautesMembres.userId))
    .where(eq(communautesMembres.communauteId, communaute.id))
    .limit(12);

  const mesPublications = await db
    .select({
      id: publications.id,
      contenu: publications.contenu,
      creeLe: publications.createdAt,
      auteurPrenom: users.prenom,
      auteurNom: users.nom,
      auteurPseudo: users.pseudo,
    })
    .from(publications)
    .innerJoin(users, eq(users.id, publications.auteurUserId))
    .where(
      sql`${publications.porteeType} = 'communaute' AND ${publications.porteeId} = ${communaute.id}`,
    )
    .orderBy(desc(publications.id))
    .limit(30);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/communautes", label: "Communautés" }]}
        titre={communaute.nom}
        sousTitre={communaute.description || undefined}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-encre-doux">
          {Number(compte.n)} membre{Number(compte.n) > 1 ? "s" : ""}
        </p>
        <form action={basculerAdhesion}>
          <input type="hidden" name="communauteId" value={communaute.id} />
          <input type="hidden" name="retour" value={`/communautes/${communaute.id}`} />
          <button
            type="submit"
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              estMembre
                ? "border border-ligne text-encre-doux hover:bg-papier"
                : "bg-vert text-white hover:bg-vert-fonce"
            }`}
          >
            {estMembre ? "Membre · quitter" : "Rejoindre la communauté"}
          </button>
        </form>
      </div>

      {estMembre && (
        <div className="mt-6">
          <FormulaireMur communauteId={communaute.id} />
        </div>
      )}

      <section className="mt-8 space-y-4">
        {mesPublications.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-sm text-encre-doux">
            {estMembre
              ? "Aucune publication : écrivez la première."
              : "Rejoignez la communauté pour lire et publier."}
          </p>
        ) : (
          mesPublications.map((p) => (
            <article key={p.id} className="rounded-2xl border border-ligne bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vert text-sm font-bold text-white">
                  {p.auteurPrenom.charAt(0)}
                  {p.auteurNom.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    {p.auteurPrenom} {p.auteurNom}
                  </p>
                  <p className="text-xs text-encre-doux">@{p.auteurPseudo}</p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{p.contenu}</p>
            </article>
          ))
        )}
      </section>

      {membres.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-encre-doux">Membres</h2>
          <p className="mt-1 text-sm">
            {membres.map((m, i) => (
              <span key={m.id}>
                {i > 0 && " · "}
                {m.prenom} {m.nom}
                {m.role === "admin" ? " (animateur)" : ""}
              </span>
            ))}
          </p>
        </section>
      )}
    </div>
  );
}
