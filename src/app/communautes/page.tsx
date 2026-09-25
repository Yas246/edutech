import type { Metadata } from "next";
import Link from "next/link";
import { asc, ilike } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { communautes, communautesMembres } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import { basculerAdhesion, creerCommunauteFormulaire } from "./actions";

export const dynamic = "force-dynamic";

const libellesType: Record<string, string> = {
  matiere: "Matière",
  groupe_travail: "Groupe de travail",
  club: "Club",
  communaute: "Communauté",
};

const ordreTypes = ["communaute", "club", "groupe_travail", "matiere"];

export const metadata: Metadata = { title: "Communautés" };

export default async function Communautes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const utilisateur = await exiger();
  const { q = "" } = await searchParams;
  const terme = q.trim().slice(0, 100);

  const lignes = await db
    .select({
      id: communautes.id,
      nom: communautes.nom,
      description: communautes.description,
      type: communautes.type,
      membres: sql<number>`(
        SELECT count(*) FROM communautes_membres m
        WHERE m.communaute_id = communautes.id
      )`,
      jeSuisMembre: sql<number>`(
        SELECT count(*) FROM communautes_membres m
        WHERE m.communaute_id = communautes.id AND m.user_id = ${utilisateur.id}
      )`,
    })
    .from(communautes)
    .where(terme ? ilike(communautes.nom, `%${terme}%`) : undefined)
    .orderBy(asc(communautes.nom))
    .limit(400);

  const monId = utilisateur.id;
  const parType = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const liste = parType.get(l.type) ?? [];
    liste.push(l);
    parType.set(l.type, liste);
  }
  const ordreTypes = ["communaute", "club", "groupe_travail", "matiere"];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <EnTetePage
        titre="Communautés"
        sousTitre={`Le réseau entier : les ${lignes.length} canaux du recensement national, plus les clubs et groupes qui se créent. Rejoignez votre école, votre quartier d'intérêt — et faites vivre le fil.`}
      />

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <form method="get" role="search" className="flex items-end gap-3">
          <div>
            <label htmlFor="q" className="block text-sm font-medium">Rechercher</label>
            <input
              id="q"
              name="q"
              defaultValue={terme}
              placeholder="Nom de la communauté"
              className="mt-1 w-64 rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="rounded-xl border border-ligne bg-white px-4 py-2 text-sm font-medium hover:bg-papier">
            Chercher
          </button>
        </form>
      </div>

      {lignes.length === 0 ? (
        <div className="mt-8">
          <EtatVide>
            {terme
              ? `Aucune communauté ne s'appelle ainsi.`
              : "Aucune communauté pour l'instant : créez la première."}
          </EtatVide>
        </div>
      ) : (
        ordreTypes
          .filter((t) => parType.has(t))
          .map((type) => (
            <section key={type} className="mt-10">
              <h2 className="text-lg font-bold tracking-tight">
                {libellesType[type] ?? type} ({parType.get(type)!.length})
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {parType.get(type)!.map((c) => {
                  const membre = Number(c.jeSuisMembre) > 0;
                  return (
                    <li key={c.id} className="flex flex-col rounded-2xl border border-ligne bg-white p-4">
                      <Link href={`/communautes/${c.id}`} className="font-semibold hover:text-vert-fonce">
                        {c.nom}
                      </Link>
                      {c.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-encre-doux">{c.description}</p>
                      )}
                      <p className="mt-1 text-xs text-encre-doux">
                        {Number(c.membres)} membre{Number(c.membres) > 1 ? "s" : ""}
                      </p>
                      <div className="mt-3 flex-1" />
                      <form action={basculerAdhesion}>
                        <input type="hidden" name="communauteId" value={c.id} />
                        <input type="hidden" name="retour" value={`/communautes?q=${encodeURIComponent(terme)}`} />
                        <button
                          type="submit"
                          className={`w-full rounded-xl px-4 py-2 text-sm font-medium transition ${
                            membre
                              ? "border border-ligne text-encre-doux hover:bg-papier"
                              : "bg-vert text-white hover:bg-vert-fonce"
                          }`}
                        >
                          {membre ? "Membre · quitter" : "Rejoindre"}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
      )}

      <section className="mt-12 rounded-2xl border border-ligne bg-white p-5">
        <h2 className="font-semibold">Créer une communauté</h2>
        <form action={creerCommunauteFormulaire} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            name="nom"
            required
            placeholder="Nom de la communauté"
            className="rounded-xl border border-ligne bg-white px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="description"
            placeholder="Description (facultative)"
            className="rounded-xl border border-ligne bg-white px-3 py-2 text-sm sm:col-span-2"
          />
          <select
            name="type"
            required
            defaultValue="communaute"
            className="rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          >
            {ordreTypes.map((t) => (
              <option key={t} value={t}>{libellesType[t]}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
          >
            Créer la communauté
          </button>
        </form>
      </section>
    </div>
  );
}
