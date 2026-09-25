import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { communautes, communautesMembres, inscriptions, liensFamille } from "@/db/schema";
import { mesClassesMembre, mesEtablissementsMembre } from "@/lib/espace";
import type { Utilisateur } from "@/lib/auth";

/**
 * Mes communautés : la carte de mes espaces, comme dans le rail
 * d'origine. D'abord la communauté principale de chaque établissement
 * fréquenté (ouverte à tous), puis les classes — les communautés
 * privées —, puis les communautés rejointes : les miennes et, pour un
 * parent, celles de ses enfants.
 */
export default async function MesEspaces({ utilisateur }: { utilisateur: Utilisateur }) {
  if (utilisateur.role === "ministere") return null;

  const idsEcoles = await mesEtablissementsMembre(utilisateur);
  const classesMembre = await mesClassesMembre(utilisateur);

  /* Les communautés principales des établissements fréquentés. */
  const principales =
    idsEcoles.length > 0
      ? await db
          .select({ id: communautes.id, nom: communautes.nom })
          .from(communautes)
          .where(inArray(communautes.etablissementId, idsEcoles))
          .orderBy(asc(communautes.nom))
      : [];

  /* Les communautés ouvertes que JE suis. */
  const rejointes = await db
    .select({ id: communautes.id, nom: communautes.nom })
    .from(communautesMembres)
    .innerJoin(communautes, eq(communautes.id, communautesMembres.communauteId))
    .where(eq(communautesMembres.userId, utilisateur.id))
    .orderBy(asc(communautes.nom))
    .limit(6);

  /* Pour un parent : les communautés où ses enfants sont. */
  const communautesEnfants =
    utilisateur.role === "parent"
      ? await db
          .selectDistinct({ id: communautes.id, nom: communautes.nom })
          .from(liensFamille)
          .innerJoin(inscriptions, eq(inscriptions.eleveUserId, liensFamille.eleveUserId))
          .innerJoin(communautesMembres, eq(communautesMembres.userId, inscriptions.eleveUserId))
          .innerJoin(communautes, eq(communautes.id, communautesMembres.communauteId))
          .where(eq(liensFamille.parentUserId, utilisateur.id))
          .orderBy(asc(communautes.nom))
      : [];

  const vues = new Set<string>();
  const entrees: { href: string; nom: string }[] = [];
  const pousser = (href: string, nom: string) => {
    if (vues.has(href)) return;
    vues.add(href);
    entrees.push({ href, nom });
  };

  for (const c of principales) pousser(`/communautes/${c.id}`, c.nom);
  for (const c of classesMembre) pousser(`/classes/${c.id}`, c.nom);
  for (const c of rejointes) pousser(`/communautes/${c.id}`, c.nom);
  for (const c of communautesEnfants) pousser(`/communautes/${c.id}`, c.nom);

  if (entrees.length === 0) return null;
  const visibles = entrees.slice(0, 12);

  return (
    <div className="mt-5 border-t border-ligne pt-4">
      <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-encre-doux">
        Mes communautés
      </p>
      <ul className="space-y-0.5">
        {visibles.map((e) => (
          <li key={e.href}>
            <Link
              href={e.href}
              className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-encre transition hover:bg-vert-clair hover:text-vert-fonce"
              title={e.nom}
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-encre text-[10px] font-bold text-white"
              >
                {e.nom.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{e.nom}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
