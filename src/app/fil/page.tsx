import type { Metadata } from "next";
import { and, asc, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  communautes,
  commentaires,
  devoirs,
  matieres,
  publications,
  reactions,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EtatVide } from "@/components/ui/etat-vide";
import { Bouton, champClasse } from "@/components/ui/formulaire";
import { cerclesDeLecture, cerclesDePublication, commenter, publier, reagir } from "./actions";

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

export default async function Fil() {
  const utilisateur = await exiger();
  const cercles = await cerclesDePublication();
  const { cercles: cerclesLecture, classesIds } = await cerclesDeLecture(
    utilisateur.id,
    utilisateur.role,
  );

  // Les communautés suivies complètent la lecture.
  const nomsCercles = new Map(cerclesLecture.map((c) => [`${c.type}:${c.id}`, c.nom]));
  const mesCommunautes = await db
    .select({ id: communautes.id, nom: communautes.nom })
    .from(communautes)
    .where(
      sql`EXISTS (SELECT 1 FROM communautes_membres m
        WHERE m.communaute_id = communautes.id AND m.user_id = ${utilisateur.id})`,
    );
  for (const c of mesCommunautes) nomsCercles.set(`communaute:${c.id}`, c.nom);

  // Les conditions de lecture : écoles, classes et communautés de l'utilisateur.
  const ecolesIds = cerclesLecture
    .filter((c) => c.type === "etablissement")
    .map((c) => c.id);
  const conditions: (SQL | undefined)[] = [];
  if (ecolesIds.length) {
    conditions.push(and(eq(publications.porteeType, "etablissement"), inArray(publications.porteeId, ecolesIds)));
  }
  if (classesIds.length) {
    conditions.push(and(eq(publications.porteeType, "classe"), inArray(publications.porteeId, classesIds)));
  }
  const communautesIds = mesCommunautes.map((c) => c.id);
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
            auteurRole: users.role,
          })
          .from(publications)
          .innerJoin(users, eq(users.id, publications.auteurUserId))
          .where(or(...conditions.filter((c): c is SQL => Boolean(c))))
          .orderBy(desc(publications.id))
          .limit(30)
      : [];

  // La chronologie mêle publications et devoirs, du plus récent au plus ancien.
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
    return nomsCercles.get(`${type}:${id}`) ?? (type === "etablissement" ? "L'établissement" : type === "classe" ? "La classe" : "La communauté");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Le fil</h1>
      <p className="mt-2 text-encre-doux">
        Votre école, vos classes, vos communautés — et les devoirs à venir,
        dans une seule chronologie.
      </p>

      {cercles.length > 0 ? (
        <form
          action={publier}
          className="mt-6 rounded-2xl border border-ligne bg-white p-4"
        >
          <textarea
            name="contenu"
            required
            rows={2}
            maxLength={2000}
            placeholder="Partagez une annonce avec votre classe, votre école ou une communauté…"
            className={champClasse}
          />
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div className="w-64">
              <label className="block text-sm font-medium">Publier dans</label>
              <select name="cercle" required className={champClasse}>
                {cercles.map((c) => (
                  <option key={`${c.type}:${c.id}`} value={`${c.type}:${c.id}`}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <Bouton type="submit">Publier</Bouton>
          </div>
        </form>
      ) : (
        <div className="mt-6">
          <EtatVide>
            Vous n'avez pas encore de classe, d'école ni de communauté : le
            fil s'ouvrira avec votre premier rattachement.
          </EtatVide>
        </div>
      )}

      <section className="mt-8 space-y-4">
        {entrees.length === 0 && (
          <EtatVide>
            Rien pour l'instant. Rejoignez une communauté ou lancez la vie de
            votre classe !
          </EtatVide>
        )}
        {entrees.map((entree, index) => {
          if (entree.genre === "devoir") {
            const d = entree.devoir;
            return (
              <article
                key={`devoir-${d.id}`}
                className="rounded-2xl border border-vert/30 bg-vert-clair/40 p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-vert-fonce">
                    Devoir à rendre · {d.classeNom}
                  </p>
                  <span className="rounded-full bg-jaune px-2.5 py-0.5 text-xs font-bold text-encre">
                    pour le {d.aRendreLe}
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
          return (
            <article key={p.id} className="rounded-2xl border border-ligne bg-white p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vert text-sm font-bold text-white">
                  {p.auteurPrenom.charAt(0)}
                  {p.auteurNom.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {p.auteurPrenom} {p.auteurNom}
                  </p>
                  <p className="truncate text-xs text-encre-doux">
                    {porteeAffichee(p.porteeType, p.porteeId)} · {depuis(p.date)}
                  </p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{p.contenu}</p>

              <div className="mt-3 flex items-center gap-4 text-sm">
                <form action={reagir}>
                  <input type="hidden" name="publicationId" value={p.id} />
                  <button
                    type="submit"
                    className={`rounded-full px-3 py-1 font-medium ${
                      dejaReagi
                        ? "bg-jaune-clair text-encre"
                        : "border border-ligne text-encre-doux hover:bg-papier"
                    }`}
                  >
                    Utile · {sesReactions.length}
                  </button>
                </form>
                <span className="text-encre-doux">
                  {sesCommentaires.length} commentaire{sesCommentaires.length > 1 ? "s" : ""}
                </span>
                {index !== undefined && <span />}
              </div>

              {sesCommentaires.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-ligne/60 pt-3 text-sm">
                  {sesCommentaires.map((c) => (
                    <li key={c.id}>
                      <span className="font-medium">
                        {c.auteurPrenom} {c.auteurNom}
                      </span>{" "}
                      {c.contenu}
                    </li>
                  ))}
                </ul>
              )}

              <form action={commenter} className="mt-3 flex items-center gap-2">
                <input type="hidden" name="publicationId" value={p.id} />
                <input
                  name="contenu"
                  required
                  maxLength={500}
                  placeholder="Écrire un commentaire…"
                  className="flex-1 rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
                />
                <Bouton taille="petit" type="submit">
                  Envoyer
                </Bouton>
              </form>
            </article>
          );
        })}
      </section>
    </div>
  );
}
