import type { Metadata } from "next";
import Link from "next/link";
import {
  IconClipboardCheck,
  IconMessageCircle,
  IconSend,
  IconThumbUp,
  IconUsersGroup,
} from "@tabler/icons-react";
import { and, asc, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  communautes,
  commentaires,
  etablissements,
  devoirs,
  evenements,
  matieres,
  publications,
  reactions,
  users,
} from "@/db/schema";
import { exiger, nomComplet } from "@/lib/auth";
import {
  droitsClasse,
  droitsCommunaute,
  droitsEtablissement,
  mesClassesMembre,
} from "@/lib/espace";
import { EtatVide } from "@/components/ui/etat-vide";
import { Bouton } from "@/components/ui/formulaire";
import {
  cerclesDeLecture,
  cerclesDePublication,
  commenter,
  publier,
  reagir,
} from "./actions";

export const metadata: Metadata = { title: "Fil" };

function depuis(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  if (jours < 7) return `il y a ${jours} j`;
  return `le ${date.toISOString().slice(0, 10)}`;
}

function jour(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

export default async function Fil() {
  const utilisateur = await exiger();
  const cercles = await cerclesDePublication();
  const { classesIds, ecolesIds, communautesIds } = await cerclesDeLecture(utilisateur);

  /* Mes droits dans chacun de mes cercles : les boutons du fil en
     découlent (un parent lecteur lit sans bouton d'action). */
  const droitsParCercle = new Map<string, { lire: boolean; commenter: boolean; reagir: boolean; publier: boolean }>();
  for (const id of classesIds) {
    droitsParCercle.set(`classe:${id}`, await droitsClasse(id, utilisateur));
  }
  for (const id of ecolesIds) {
    droitsParCercle.set(`etablissement:${id}`, await droitsEtablissement(id, utilisateur));
  }
  for (const id of communautesIds) {
    droitsParCercle.set(`communaute:${id}`, await droitsCommunaute(id, utilisateur.id));
  }

  /* Les noms des cercles lus : mes espaces, mes écoles, mes communautés. */
  const nomsCercles = new Map<string, string>();
  const classesMembre = await mesClassesMembre(utilisateur);
  for (const c of classesMembre) nomsCercles.set(`classe:${c.id}`, `Classe ${c.nom}`);
  const ecolesMembre =
    ecolesIds.length > 0
      ? await db
          .select({ id: etablissements.id, nom: etablissements.nom })
          .from(etablissements)
          .where(inArray(etablissements.id, ecolesIds))
      : [];
  for (const e of ecolesMembre) nomsCercles.set(`etablissement:${e.id}`, e.nom);
  const mesCommunautes =
    communautesIds.length > 0
      ? await db
          .select({ id: communautes.id, nom: communautes.nom })
          .from(communautes)
          .where(inArray(communautes.id, communautesIds))
      : [];
  for (const c of mesCommunautes) nomsCercles.set(`communaute:${c.id}`, c.nom);

  const conditions: (SQL | undefined)[] = [];
  if (ecolesIds.length) {
    conditions.push(and(eq(publications.porteeType, "etablissement"), inArray(publications.porteeId, ecolesIds)));
  }
  if (classesIds.length) {
    conditions.push(and(eq(publications.porteeType, "classe"), inArray(publications.porteeId, classesIds)));
  }
  if (communautesIds.length) {
    conditions.push(and(eq(publications.porteeType, "communaute"), inArray(publications.porteeId, communautesIds)));
  }

  // Les devoirs à venir des classes suivies : ils s'intercalent dans le fil.
  const devoirsAVenir = classesIds.length
    ? await db
        .select({
          id: devoirs.id,
          titre: devoirs.titre,
          aRendreLe: devoirs.aRendreLe,
          classeNom: classes.nom,
          matiere: matieres.nom,
        })
        .from(devoirs)
        .innerJoin(classes, eq(classes.id, devoirs.classeId))
        .innerJoin(matieres, eq(matieres.id, devoirs.matiereId))
        .where(and(inArray(devoirs.classeId, classesIds), gte(devoirs.aRendreLe, sql`CURRENT_DATE`)))
        .orderBy(asc(devoirs.aRendreLe))
        .limit(10)
    : [];

  const liste =
    conditions.length > 0
      ? await db
          .select({
            id: publications.id,
            contenu: publications.contenu,
            porteeType: publications.porteeType,
            porteeId: publications.porteeId,
            date: publications.createdAt,
            auteurPrenom: users.prenom,
            auteurNom: users.nom,
          })
          .from(publications)
          .innerJoin(users, eq(users.id, publications.auteurUserId))
          .where(or(...conditions.filter((c): c is SQL => Boolean(c))))
          .orderBy(desc(publications.id))
          .limit(30)
      : [];

  type Entree =
    | { genre: "publication"; date: Date; publication: (typeof liste)[number] }
    | { genre: "devoir"; date: Date; devoir: (typeof devoirsAVenir)[number] };
  const entrees: Entree[] = [
    ...liste.map((p) => ({ genre: "publication" as const, date: p.date, publication: p })),
    ...devoirsAVenir.map((d) => ({
      genre: "devoir" as const,
      date: new Date(`${d.aRendreLe}T08:00:00`),
      devoir: d,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const ids = liste.map((p) => p.id);
  const tousCommentaires = ids.length
    ? await db
        .select({
          id: commentaires.id,
          publicationId: commentaires.publicationId,
          contenu: commentaires.contenu,
          auteurPrenom: users.prenom,
          auteurNom: users.nom,
        })
        .from(commentaires)
        .innerJoin(users, eq(users.id, commentaires.auteurUserId))
        .where(inArray(commentaires.publicationId, ids))
    : [];
  const toutesReactions = ids.length
    ? await db
        .select({ publicationId: reactions.publicationId, userId: reactions.userId })
        .from(reactions)
        .where(inArray(reactions.publicationId, ids))
    : [];

  function porteeAffichee(type: string, id: number) {
    return (
      nomsCercles.get(`${type}:${id}`) ??
      (type === "etablissement"
        ? "L'établissement"
        : type === "classe"
          ? "La classe"
          : "La communauté")
    );
  }

  /* Les repères de droite, selon la place de chacun. */
  const mesEvenements = ecolesIds.length
    ? await db
        .select({
          titre: evenements.titre,
          date: evenements.date,
        })
        .from(evenements)
        .where(
          and(
            inArray(evenements.etablissementId, ecolesIds),
            gte(evenements.date, sql`CURRENT_DATE`),
          ),
        )
        .orderBy(asc(evenements.date))
        .limit(4)
    : [];

  const syntheseDirection =
    utilisateur.role === "direction"
      ? (
          await db
            .select({
              effectifs: sql<number>`(SELECT count(*) FROM inscriptions i
                JOIN classes c ON c.id = i.classe_id
                WHERE c.etablissement_id = (SELECT id FROM etablissements WHERE direction_user_id = ${utilisateur.id}))`,
              transferts: sql<number>`(SELECT count(*) FROM transferts
                WHERE statut = 'demande' AND (etablissement_depart = (SELECT id FROM etablissements WHERE direction_user_id = ${utilisateur.id})
                   OR etablissement_arrivee = (SELECT id FROM etablissements WHERE direction_user_id = ${utilisateur.id})))`,
            })
            .from(sql`(SELECT 1) t`)
        )[0]
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10">
      {/* La chronologie */}
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">Le fil</h1>
        <p className="mt-2 text-encre-doux">
          {nomComplet(utilisateur)} — votre école, vos classes, vos
          communautés et vos devoirs, dans une seule chronologie.
        </p>

        {cercles.length > 0 ? (
          <form
            action={publier}
            className="mt-6 rounded-2xl border border-ligne bg-white shadow-xs"
          >
            <div className="flex gap-3 p-4 pb-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-vert to-vert-fonce text-sm font-bold text-white">
                {utilisateur.prenom.charAt(0)}
                {utilisateur.nom.charAt(0)}
              </span>
              <textarea
                name="contenu"
                required
                rows={2}
                maxLength={2000}
                placeholder="Quoi de neuf ? Partagez avec votre classe, votre école ou une communauté…"
                className="w-full resize-none rounded-xl bg-papier px-4 py-3 text-sm text-encre placeholder:text-discret focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ligne/70 px-4 py-2.5">
              <label className="flex items-center gap-2 text-sm text-encre-doux">
                <IconUsersGroup className="h-[18px] w-[18px] text-vert" stroke={1.7} />
                <span className="sr-only">Publier dans</span>
                <select
                  name="cercle"
                  required
                  className="max-w-56 rounded-lg border-0 bg-papier px-2 py-1.5 text-sm font-medium text-encre focus:outline-none"
                >
                  {cercles.map((c) => (
                    <option key={`${c.type}:${c.id}`} value={`${c.type}:${c.id}`}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </label>
              <Bouton type="submit">Publier</Bouton>
            </div>
          </form>
        ) : (
          <div className="mt-6">
            <EtatVide>
              Vous suivez vos classes et vos communautés ici. Pour
              publier, rejoignez une communauté ouverte — dans l'espace
              d'une classe, la parole est à la direction, aux professeurs
              et aux délégués.
            </EtatVide>
          </div>
        )}

        <section className="mt-8 space-y-4">
          {entrees.length === 0 && (
            <EtatVide>
              Rien pour l'instant. Rejoignez une communauté ou lancez la vie
              de votre classe !
            </EtatVide>
          )}
          {entrees.map((entree) => {
            if (entree.genre === "devoir") {
              const d = entree.devoir;
              return (
                <article
                  key={`devoir-${d.id}`}
                  className="rounded-2xl border border-vert/20 bg-vert-clair/50 p-5 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-vert-fonce">
                      <IconClipboardCheck className="h-4 w-4" stroke={1.7} />
                      Devoir à rendre · {d.classeNom}
                    </p>
                    <span className="rounded-full border border-jaune/40 bg-jaune-clair px-2.5 py-0.5 text-xs font-bold text-encre">
                      pour le {jour(d.aRendreLe)}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold">
                    {d.matiere} — {d.titre}
                  </p>
                </article>
              );
            }

            const p = entree.publication;
            const sesCommentaires = tousCommentaires.filter((c) => c.publicationId === p.id);
            const sesReactions = toutesReactions.filter((r) => r.publicationId === p.id);
            const dejaReagi = sesReactions.some((r) => r.userId === utilisateur.id);
            // Mes droits dans le cercle de cette publication : un
            // parent lecteur lit sans bouton d'action.
            const droitsIci =
              droitsParCercle.get(`${p.porteeType}:${p.porteeId}`) ?? {
                lire: true,
                commenter: false,
                reagir: false,
                publier: false,
              };
            return (
              <article key={p.id} className="rounded-2xl border border-ligne bg-white shadow-xs">
                <div className="flex items-center gap-3 p-4 pb-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-vert to-vert-fonce text-sm font-bold text-white">
                    {p.auteurPrenom.charAt(0)}
                    {p.auteurNom.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {p.auteurPrenom} {p.auteurNom}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-discret">
                      {porteeAffichee(p.porteeType, p.porteeId)}
                      <span aria-hidden="true">·</span>
                      {depuis(p.date)}
                    </p>
                  </div>
                </div>
                <p className="whitespace-pre-line px-4 pb-3 text-[15px] leading-relaxed">
                  {p.contenu}
                </p>

                <div className="flex items-center gap-2 border-t border-ligne/70 px-3 py-2 text-sm">
                  {droitsIci.reagir && (
                    <form action={reagir}>
                      <input type="hidden" name="publicationId" value={p.id} />
                      <button
                        type="submit"
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition ${
                          dejaReagi
                            ? "bg-vert-clair text-vert-fonce"
                            : "text-encre-doux hover:bg-papier"
                        }`}
                      >
                        <IconThumbUp className="h-[18px] w-[18px]" stroke={1.7} />
                        Utile
                        {sesReactions.length > 0 && (
                          <span className="tabular-nums">· {sesReactions.length}</span>
                        )}
                      </button>
                    </form>
                  )}
                  <span className="flex items-center gap-1.5 px-2 py-1.5 text-encre-doux">
                    <IconMessageCircle className="h-[18px] w-[18px]" stroke={1.7} />
                    {sesCommentaires.length} commentaire{sesCommentaires.length > 1 ? "s" : ""}
                  </span>
                </div>

                {sesCommentaires.length > 0 && (
                  <ul className="space-y-2 px-4 pb-3 text-sm">
                    {sesCommentaires.map((c) => (
                      <li key={c.id} className="flex items-start gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-papier text-[10px] font-bold text-encre-doux">
                          {c.auteurPrenom.charAt(0)}
                          {c.auteurNom.charAt(0)}
                        </span>
                        <span className="min-w-0 rounded-2xl bg-papier px-3 py-2">
                          <span className="font-medium">
                            {c.auteurPrenom} {c.auteurNom}
                          </span>{" "}
                          {c.contenu}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {droitsIci.commenter && (
                  <form
                    action={commenter}
                    className="flex items-center gap-2 border-t border-ligne/70 px-4 py-2.5"
                  >
                    <input type="hidden" name="publicationId" value={p.id} />
                    <input
                      name="contenu"
                      required
                      maxLength={500}
                      placeholder="Écrire un commentaire…"
                      className="flex-1 rounded-full border border-ligne bg-papier px-4 py-2 text-sm focus:border-vert/40 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Envoyer le commentaire"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vert text-white transition hover:bg-vert-fonce"
                    >
                      <IconSend className="h-4 w-4" stroke={1.8} />
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </section>
      </div>

      {/* Les repères de droite */}
      <aside className="mt-10 space-y-4 xl:sticky xl:top-6 xl:mt-14 xl:self-start">
        {devoirsAVenir.length > 0 && (
          <section className="rounded-2xl border border-ligne bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-encre-doux">Mes tâches</h2>
              <Link href="/calendrier" className="text-xs font-medium text-vert underline hover:text-vert-fonce">
                Tout voir
              </Link>
            </div>
            <ul className="mt-2 space-y-2 text-sm">
              {devoirsAVenir.slice(0, 5).map((d) => {
                const enRetard = d.aRendreLe < new Date().toISOString().slice(0, 10);
                return (
                  <li key={d.id} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full border-2 ${
                        enRetard ? "border-rouge" : "border-vert"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        <span className="font-medium">{d.matiere}</span> · {d.titre}
                      </span>
                      <span className={`block text-xs ${enRetard ? "font-semibold text-rouge" : "text-encre-doux"}`}>
                        {enRetard ? "EN RETARD — " : ""}à rendre le {jour(d.aRendreLe)} · {d.classeNom}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 border-t border-ligne/60 pt-2 text-xs text-encre-doux">
              {devoirsAVenir.length} tâche{devoirsAVenir.length > 1 ? "s" : ""} en cours.
            </p>
          </section>
        )}

        {mesEvenements.length > 0 && (
          <section className="rounded-2xl border border-ligne bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-encre-doux">Événements à venir</h2>
              <Link href="/calendrier" className="text-xs font-medium text-vert underline hover:text-vert-fonce">
                Tout voir
              </Link>
            </div>
            <ul className="mt-2 space-y-2 text-sm">
              {mesEvenements.map((e, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{e.titre}</span>
                  <span className="shrink-0 font-medium text-vert-fonce">{jour(e.date)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {utilisateur.role === "direction" && syntheseDirection && (
          <section className="rounded-2xl border border-ligne bg-white p-4">
            <h2 className="text-sm font-semibold text-encre-doux">Mon école</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span>Effectifs</span>
                <span className="font-medium">{Number(syntheseDirection.effectifs)}</span>
              </li>
              <li className="flex justify-between">
                <span>Transferts en attente</span>
                <span className="font-medium">{Number(syntheseDirection.transferts)}</span>
              </li>
            </ul>
            <Link
              href="/tableau-de-bord"
              className="mt-2 block text-xs font-medium text-vert underline hover:text-vert-fonce"
            >
              Le tableau de bord complet
            </Link>
          </section>
        )}

        <section className="rounded-2xl border border-ligne bg-white p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-encre-doux">Mes communautés</h2>
            <Link href="/communautes" className="text-xs font-medium text-vert underline hover:text-vert-fonce">
              Découvrir
            </Link>
          </div>
          {mesCommunautes.length === 0 ? (
            <p className="mt-2 text-sm text-encre-doux">
              Aucune communauté rejointe pour le moment.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {mesCommunautes.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`/communautes/${c.id}`} className="hover:text-vert-fonce">
                    {c.nom}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
