import type { Metadata } from "next";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  commentaires,
  etablissements,
  liensFamille,
  enseignements,
  inscriptions,
  publications,
  reactions,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EtatVide } from "@/components/ui/etat-vide";
import { Bouton, champClasse } from "@/components/ui/formulaire";
import { cerclesDePublication, commenter, publier, reagir } from "./actions";

export const metadata: Metadata = { title: "Fil" };

function depuis(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  return `le ${date.toISOString().slice(0, 10)}`;
}

export default async function Fil() {
  const utilisateur = await exiger();
  const cercles = await cerclesDePublication();

  // Les cercles de LECTURE : pour le parent, l'école et les classes de
  // ses enfants (il lit et commente, il ne publie pas).
  let cerclesLecture = cercles;
  if (utilisateur.role === "parent") {
    const classesEnfants = await db
      .select({ id: classes.id, nom: classes.nom, etablissementId: classes.etablissementId })
      .from(liensFamille)
      .innerJoin(inscriptions, eq(inscriptions.eleveUserId, liensFamille.eleveUserId))
      .innerJoin(classes, eq(classes.id, inscriptions.classeId))
      .where(eq(liensFamille.parentUserId, utilisateur.id));
    cerclesLecture = classesEnfants.map((c) => ({ type: "classe" as const, id: c.id, nom: "Classe " + c.nom }));
    const ecolesVues = [...new Set(classesEnfants.map((c) => c.etablissementId))];
    if (ecolesVues.length) {
      const ecoles = await db
        .select({ id: etablissements.id, nom: etablissements.nom })
        .from(etablissements)
        .where(inArray(etablissements.id, ecolesVues));
      for (const e of ecoles) {
        cerclesLecture.unshift({ type: "etablissement" as const, id: e.id, nom: e.nom });
      }
    }
  }

  // Les publications visibles : celles des cercles de l'utilisateur.
  const conditions = cerclesLecture.map((c) =>
    c.type === "etablissement"
      ? publicationDuCercle("etablissement", c.id)
      : publicationDuCercle("classe", c.id),
  );
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
          .where(or(...conditions))
          .orderBy(desc(publications.id))
          .limit(30)
      : [];

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

  // Libellés de portée pour l'affichage.
  const classesVisibles = cerclesLecture.filter((c) => c.type === "classe");
  const ecoles = cerclesLecture.filter((c) => c.type === "etablissement");

  function porteeAffichee(type: string, id: number) {
    if (type === "etablissement") {
      return ecoles.find((e) => e.id === id)?.nom ?? "L'établissement";
    }
    return classesVisibles.find((c) => c.id === id)?.nom ?? "La classe";
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Le fil</h1>
      <p className="mt-2 text-encre-doux">
        Les annonces de votre école et la vie de vos classes.
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
            placeholder="Partagez une annonce avec votre classe ou votre école…"
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
            Vous n'avez pas encore de classe ni d'école : le fil s'ouvrira
            après votre inscription dans un établissement.
          </EtatVide>
        </div>
      )}

      <section className="mt-8 space-y-4">
        {liste.length === 0 && cercles.length > 0 && (
          <EtatVide>
            Aucune publication pour l'instant. Lancez la vie de votre classe !
          </EtatVide>
        )}
        {liste.map((p) => {
          const sesCommentaires = tousCommentaires.filter((c) => c.publicationId === p.id);
          const sesReactions = toutesReactions.filter((r) => r.publicationId === p.id);
          const dejaReagi = sesReactions.some((r) => r.userId === utilisateur.id);
          return (
            <article key={p.id} className="rounded-2xl border border-ligne bg-white p-5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className="font-semibold">
                    {p.auteurPrenom} {p.auteurNom}
                  </span>{" "}
                  <span className="text-encre-doux">
                    · {porteeAffichee(p.porteeType, p.porteeId)} · {depuis(p.date)}
                  </span>
                </p>
              </div>
              <p className="mt-2 whitespace-pre-line">{p.contenu}</p>

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

function publicationDuCercle(type: "etablissement" | "classe", id: number) {
  return and(eq(publications.porteeType, type), eq(publications.porteeId, id));
}
