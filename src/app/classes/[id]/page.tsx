import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  adhesionsClasse,
  classes,
  codesClasse,
  communautes,
  commentaires,
  delegues,
  enseignements,
  equipes,
  etablissements,
  inscriptions,
  matieres,
  publications,
  reactions,
  users,
} from "@/db/schema";
import { exiger, nomComplet } from "@/lib/auth";
import { droitsClasse } from "@/lib/espace";
import { EtatVide } from "@/components/ui/etat-vide";
import { Bouton, champClasse } from "@/components/ui/formulaire";
import { commenter, reagir } from "@/app/fil/actions";
import { publierDansClasseFormulaire } from "./actions";

export const metadata: Metadata = { title: "Classe" };

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

/**
 * L'espace de la classe : le mur où la direction, les professeurs et
 * les délégués parlent à la classe, le programme, et les membres par
 * rôle. Les outils de la vie scolaire restent à portée de bouton.
 */
export default async function PageClasse({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  if (!Number.isInteger(idClasse)) notFound();

  const utilisateur = await exiger();
  const droits = await droitsClasse(idClasse, utilisateur);
  if (!droits.lire) notFound();

  const [classe] = await db
    .select({
      id: classes.id,
      nom: classes.nom,
      niveau: classes.niveau,
      annee: classes.anneeScolaire,
      etabId: etablissements.id,
      etabNom: etablissements.nom,
      commune: etablissements.commune,
    })
    .from(classes)
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe) notFound();

  const programme = await db
    .select({
      id: matieres.id,
      nom: matieres.nom,
      coefficient: matieres.coefficient,
      enseignantPrenom: users.prenom,
      enseignantNom: users.nom,
    })
    .from(matieres)
    .leftJoin(enseignements, eq(enseignements.matiereId, matieres.id))
    .leftJoin(users, eq(users.id, enseignements.enseignantUserId))
    .where(eq(matieres.classeId, idClasse))
    .orderBy(asc(matieres.nom));

  /* Les membres par rôle, calculés sur-le-champ. */
  const eleves = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(inscriptions)
    .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, idClasse))
    .orderBy(asc(users.nom));

  const profs = await db
    .selectDistinct({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(enseignements)
    .innerJoin(users, eq(users.id, enseignements.enseignantUserId))
    .where(eq(enseignements.classeId, idClasse))
    .orderBy(asc(users.nom));

  const [directionTitulaire] = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(etablissements)
    .innerJoin(users, eq(users.id, etablissements.directionUserId))
    .where(eq(etablissements.id, classe.etabId))
    .limit(1);

  const autresDirigeants = await db
    .selectDistinct({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(equipes)
    .innerJoin(users, eq(users.id, equipes.userId))
    .where(
      and(
        eq(equipes.etablissementId, classe.etabId),
        eq(equipes.statut, "confirme"),
        eq(users.role, "direction"),
      ),
    );

  const parents = await db
    .selectDistinct({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(adhesionsClasse)
    .innerJoin(users, eq(users.id, adhesionsClasse.userId))
    .where(eq(adhesionsClasse.classeId, idClasse))
    .orderBy(asc(users.nom));

  const mesDelegues = await db
    .select({ eleveUserId: delegues.eleveUserId })
    .from(delegues)
    .where(eq(delegues.classeId, idClasse));
  const idsDelegues = new Set(mesDelegues.map((d) => d.eleveUserId));

  /* Le code d'adhésion, affiché à ceux qui tiennent l'espace. */
  const [codeClasse] = droits.publier
    ? await db
        .select({ code: codesClasse.code })
        .from(codesClasse)
        .where(eq(codesClasse.classeId, idClasse))
        .limit(1)
    : [];

  /* La communauté principale de l'établissement, pour le fil d'ariane. */
  const [communauteEcole] = await db
    .select({ id: communautes.id })
    .from(communautes)
    .where(eq(communautes.etablissementId, classe.etabId))
    .limit(1);

  /* Le mur de la classe. */
  const mur = await db
    .select({
      id: publications.id,
      contenu: publications.contenu,
      date: publications.createdAt,
      auteurPrenom: users.prenom,
      auteurNom: users.nom,
    })
    .from(publications)
    .innerJoin(users, eq(users.id, publications.auteurUserId))
    .where(and(eq(publications.porteeType, "classe"), eq(publications.porteeId, idClasse)))
    .orderBy(desc(publications.id))
    .limit(30);

  const idsMur = mur.map((p) => p.id);
  const sesCommentaires = idsMur.length
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
        .where(inArray(commentaires.publicationId, idsMur))
    : [];
  const sesReactions = idsMur.length
    ? await db
        .select({ publicationId: reactions.publicationId, userId: reactions.userId })
        .from(reactions)
        .where(inArray(reactions.publicationId, idsMur))
    : [];

  const directionNoms = [
    ...(directionTitulaire ? [nomComplet(directionTitulaire)] : []),
    ...autresDirigeants
      .filter((d) => d.id !== directionTitulaire?.id)
      .map((d) => nomComplet(d)),
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      {/* La bannière de l'espace */}
      <p className="text-sm text-encre-doux">
        <Link
          href={communauteEcole ? `/communautes/${communauteEcole.id}` : "/etablissements"}
          className="underline hover:text-vert"
        >
          {classe.etabNom}
        </Link>
        {classe.commune ? `, ${classe.commune}` : ""}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Classe {classe.nom}</h1>
        {codeClasse && (
          <span
            className="rounded-lg border border-vert/30 bg-vert-clair/60 px-3 py-1.5 font-mono text-sm font-bold tracking-widest text-vert-fonce"
            title="Code d'adhésion de la classe"
          >
            {codeClasse.code}
          </span>
        )}
      </div>
      <p className="mt-1 text-encre-doux">
        {classe.niveau} · {classe.annee} · {eleves.length} élève
        {eleves.length > 1 ? "s" : ""} ·{" "}
        {idsDelegues.size > 0
          ? `${idsDelegues.size} délégué${idsDelegues.size > 1 ? "s" : ""}`
          : "aucun délégué"}
      </p>

      {/* Les outils de la classe */}
      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Outils de la classe">
        <Outil href={`/classes/${classe.id}/devoirs`}>Cahier de textes</Outil>
        <Outil href={`/classes/${classe.id}/emploi-du-temps`}>Emploi du temps</Outil>
        <Outil href={`/classes/${classe.id}/bulletins`}>Bulletins</Outil>
        {droits.publier && (
          <>
            <Outil href={`/classes/${classe.id}/appel`} fort>
              Faire l&apos;appel
            </Outil>
            <Outil href={`/classes/${classe.id}/evaluations`}>Évaluations et notes</Outil>
            {(classe.niveau.toLowerCase().match(/terminale|tle|3e|3ème|3eme|troisieme|troisième/) ||
              utilisateur.role === "direction") && (
              <Outil href={`/classes/${classe.id}/candidatures`}>Candidatures</Outil>
            )}
            {utilisateur.role === "direction" && (
              <Outil href={`/classes/${classe.id}/delegues`}>Délégués</Outil>
            )}
          </>
        )}
      </nav>

      {/* Le mur de la classe */}
      <section className="mt-8">
        <h2 className="text-xl font-bold tracking-tight">Discussions de la classe</h2>
        {droits.publier ? (
          <form
            action={publierDansClasseFormulaire}
            className="mt-3 rounded-2xl border border-ligne bg-white p-4"
          >
            <input type="hidden" name="classeId" value={classe.id} />
            <textarea
              name="contenu"
              required
              rows={2}
              maxLength={2000}
              placeholder="Parlez à la classe : annonce, rappel, consigne…"
              className={champClasse}
            />
            <div className="mt-2 flex justify-end">
              <Bouton type="submit">Publier</Bouton>
            </div>
          </form>
        ) : (
          <p className="mt-2 text-sm text-encre-doux">
            {droits.commenter
              ? "La direction, les professeurs et les délégués publient ; vous commentez et réagissez."
              : "Vous suivez la classe en lecture : la direction, les professeurs et les délégués y publient."}
          </p>
        )}

        <div className="mt-4 space-y-4">
          {mur.length === 0 && (
            <EtatVide>
              Le mur de la classe est encore vide : la première publication
              l&apos;ouvrira.
            </EtatVide>
          )}
          {mur.map((p) => {
            const cs = sesCommentaires.filter((c) => c.publicationId === p.id);
            const rs = sesReactions.filter((r) => r.publicationId === p.id);
            const dejaReagi = rs.some((r) => r.userId === utilisateur.id);
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
                    <p className="truncate text-xs text-encre-doux">{depuis(p.date)}</p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm">{p.contenu}</p>

                <div className="mt-3 flex items-center gap-4 text-sm">
                  {droits.reagir && (
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
                        Utile · {rs.length}
                      </button>
                    </form>
                  )}
                  <span className="text-encre-doux">
                    {cs.length} commentaire{cs.length > 1 ? "s" : ""}
                  </span>
                </div>

                {cs.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-ligne/60 pt-3 text-sm">
                    {cs.map((c) => (
                      <li key={c.id}>
                        <span className="font-medium">
                          {c.auteurPrenom} {c.auteurNom}
                        </span>{" "}
                        {c.contenu}
                      </li>
                    ))}
                  </ul>
                )}

                {droits.commenter && (
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
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Le programme */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">
          Programme ({programme.length} matière{programme.length > 1 ? "s" : ""})
        </h2>
        {programme.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
            Le programme de cette classe n&apos;est pas encore posé.
          </p>
        ) : (
          <table className="mt-3 w-full rounded-2xl border border-ligne bg-white text-sm">
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Matière</th>
                <th scope="col" className="px-4 py-2 font-medium">Coefficient</th>
                <th scope="col" className="px-4 py-2 font-medium">Enseignant</th>
              </tr>
            </thead>
            <tbody>
              {programme.map((m) => (
                <tr key={m.id} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{m.nom}</td>
                  <td className="px-4 py-2">{m.coefficient}</td>
                  <td className="px-4 py-2 text-encre-doux">
                    {m.enseignantPrenom
                      ? `${m.enseignantPrenom} ${m.enseignantNom}`
                      : "À confier"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Les membres par rôle */}
      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Membres par rôle</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <GroupeMembres
            titre={`Direction (${directionNoms.length})`}
            noms={directionNoms.map((n) => ({ label: n }))}
          />
          <GroupeMembres
            titre={`Enseignants (${profs.length})`}
            noms={profs.map((p) => ({ label: `${p.prenom} ${p.nom}` }))}
          />
          <GroupeMembres
            titre={`Élèves (${eleves.length})`}
            noms={eleves.map((e) => ({
              label: idsDelegues.has(e.id)
                ? `${e.prenom} ${e.nom} · délégué`
                : `${e.prenom} ${e.nom}`,
              href:
                droits.publier && utilisateur.role !== "eleve"
                  ? `/eleves/${e.id}/passeport`
                  : undefined,
            }))}
          />
          <GroupeMembres
            titre={`Parents (${parents.length})`}
            noms={
              droits.publier
                ? parents.map((p) => ({ label: `${p.prenom} ${p.nom}` }))
                : []
            }
            texte={
              droits.publier
                ? undefined
                : "Ils rejoignent la classe avec son code."
            }
          />
        </div>
      </section>
    </div>
  );
}

function Outil({
  href,
  fort,
  children,
}: {
  href: string;
  fort?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        fort
          ? "bg-vert text-white hover:bg-vert-fonce"
          : "border border-ligne bg-white text-encre hover:bg-vert-clair hover:text-vert-fonce"
      }`}
    >
      {children}
    </Link>
  );
}

function GroupeMembres({
  titre,
  noms,
  texte,
}: {
  titre: string;
  noms: { label: string; href?: string }[];
  texte?: string;
}) {
  return (
    <div className="rounded-2xl border border-ligne bg-white p-4">
      <p className="text-sm font-semibold">{titre}</p>
      {noms.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-encre">
          {noms.map((n) => (
            <li key={n.label}>
              {n.href ? (
                <Link href={n.href} className="underline decoration-ligne hover:text-vert">
                  {n.label}
                </Link>
              ) : (
                n.label
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-encre-doux">{texte ?? "Aucun pour l'instant."}</p>
      )}
    </div>
  );
}
