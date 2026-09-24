import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  enseignements,
  evaluations,
  factures,
  frais,
  paiements,
  tranches,
  inscriptions,
  liensFamille,
  matieres,
  notes,
  periodes,
  presences,
  publicationsBulletins,
  users,
} from "@/db/schema";
import { exiger, nomComplet } from "@/lib/auth";
import { libellesRole } from "@/lib/roles";
import { seDeconnecter } from "@/app/deconnexion";

export const metadata: Metadata = { title: "Mon espace" };

type LigneNote = {
  date: string;
  valeur: string;
  bareme: number;
  matiere: string;
  titre: string;
  classeId: number;
  classeNom: string;
};

function sur20(valeur: string, bareme: number) {
  return ((Number(valeur) / bareme) * 20).toFixed(2).replace(".", ",");
}

function formaterDate(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/** Les notes d'un élève, toutes classes confondues, les plus récentes d'abord. */
async function notesDeLeleve(idEleve: number, limite = 6): Promise<LigneNote[]> {
  return db
    .select({
      date: evaluations.date,
      valeur: notes.valeur,
      bareme: evaluations.bareme,
      matiere: matieres.nom,
      titre: evaluations.titre,
      classeId: classes.id,
      classeNom: classes.nom,
    })
    .from(notes)
    .innerJoin(evaluations, eq(evaluations.id, notes.evaluationId))
    .innerJoin(matieres, eq(matieres.id, evaluations.matiereId))
    .innerJoin(classes, eq(classes.id, evaluations.classeId))
    .where(eq(notes.eleveUserId, idEleve))
    .orderBy(desc(evaluations.date))
    .limit(limite);
}

/** Les dernières présences signalées d'un élève. */
async function presencesDeLeleve(idEleve: number, limite = 4) {
  return db
    .select({
      date: presences.date,
      statut: presences.statut,
      motif: presences.motif,
      classeNom: classes.nom,
    })
    .from(presences)
    .innerJoin(classes, eq(classes.id, presences.classeId))
    .where(eq(presences.eleveUserId, idEleve))
    .orderBy(desc(presences.date))
    .limit(limite);
}

const libellesPresence: Record<string, string> = {
  present: "Présent",
  retard: "Retard",
  absent: "Absent",
  absent_justifie: "Absence justifiée",
};

function CarteEnfant({
  enfant,
  classeId,
  classe,
  periode,
  publie,
  notes: sesNotes,
  presences: sesPresences,
}: {
  enfant: { id: number; prenom: string; nom: string };
  classeId: number | null;
  classe: string;
  periode: string;
  publie: boolean;
  notes: LigneNote[];
  presences: Awaited<ReturnType<typeof presencesDeLeleve>>;
}) {
  return (
    <article className="rounded-2xl border border-ligne bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">
          {enfant.prenom} {enfant.nom}
        </h3>
        <p className="text-sm text-encre-doux">{classe} · {periode}</p>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <section>
          <h4 className="text-sm font-semibold">Dernières notes</h4>
          {sesNotes.length === 0 ? (
            <p className="mt-1 text-sm text-encre-doux">Pas encore de note.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {sesNotes.map((n, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    <span className="font-medium">{n.matiere}</span>{" "}
                    <span className="text-encre-doux">
                      ({n.titre}, {formaterDate(n.date)})
                    </span>
                  </span>
                  <span className="font-semibold text-vert-fonce">
                    {sur20(n.valeur, n.bareme)}/20
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="text-sm font-semibold">Présences récentes</h4>
          {sesPresences.length === 0 ? (
            <p className="mt-1 text-sm text-encre-doux">Aucun signalement.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {sesPresences.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    <span
                      className={
                        p.statut === "absent"
                          ? "font-medium text-rouge"
                          : p.statut === "retard"
                            ? "font-medium"
                            : "font-medium text-encre-doux"
                      }
                    >
                      {libellesPresence[p.statut]}
                    </span>{" "}
                    <span className="text-encre-doux">
                      {formaterDate(p.date)}
                      {p.motif ? ` · ${p.motif}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-4 text-sm">
        {publie ? (
          <Link
            href={`/classes/${classeId ?? ""}/bulletins/${enfant.id}`}
            className="font-medium text-vert underline hover:text-vert-fonce"
          >
            Voir le bulletin du trimestre
          </Link>
        ) : (
          <span className="text-encre-doux">
            Bulletin du trimestre : paraîtra ici dès sa publication par la direction.
          </span>
        )}
      </p>
    </article>
  );
}

export default async function TableauDeBord() {
  const utilisateur = await exiger();
  const titre = `Bienvenue, ${nomComplet(utilisateur)}`;

  /* ---------------------------- PARENT ---------------------------- */
  if (utilisateur.role === "parent") {
    const enfants = await db
      .select({ id: users.id, prenom: users.prenom, nom: users.nom })
      .from(liensFamille)
      .innerJoin(users, eq(users.id, liensFamille.eleveUserId))
      .where(eq(liensFamille.parentUserId, utilisateur.id));

    const inscriptionsEnfants = enfants.length
      ? await db
          .select({
            eleveUserId: inscriptions.eleveUserId,
            classeId: classes.id,
            classeNom: classes.nom,
            etablissementId: classes.etablissementId,
          })
          .from(inscriptions)
          .innerJoin(classes, eq(classes.id, inscriptions.classeId))
          .where(inArray(inscriptions.eleveUserId, enfants.map((e) => e.id)))
      : [];

    const [periode] = inscriptionsEnfants.length
      ? await db
          .select()
          .from(periodes)
          .where(
            inArray(
              periodes.etablissementId,
              inscriptionsEnfants.map((i) => i.etablissementId),
            ),
          )
          .limit(1)
      : [];

    const publications = inscriptionsEnfants.length
      ? await db
          .select({ classeId: publicationsBulletins.classeId })
          .from(publicationsBulletins)
          .where(
            inArray(
              publicationsBulletins.classeId,
              inscriptionsEnfants.map((i) => i.classeId),
            ),
          )
      : [];

    // Les cartes sont préparées avant le rendu (une passe par enfant).
    const cartes = [];
    for (const enfant of enfants) {
      const inscription = inscriptionsEnfants.find((i) => i.eleveUserId === enfant.id);
      cartes.push(
        <CarteEnfant
          key={enfant.id}
          enfant={enfant}
          classe={inscription?.classeNom ?? "Pas encore inscrit"}
          periode={periode?.nom ?? "Année 2026-2027"}
          classeId={inscription?.classeId ?? null}
          publie={publications.some((p) => p.classeId === inscription?.classeId)}
          notes={await notesDeLeleve(enfant.id)}
          presences={await presencesDeLeleve(enfant.id)}
        />,
      );
    }

    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{titre}</h1>
        <p className="mt-2 text-encre-doux">
          Le suivi de chacun de vos enfants : notes, présences et bulletins,
          toutes classes confondues.
        </p>
        <div className="mt-8 space-y-6">
          {enfants.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
              Aucun enfant relié à votre compte.{" "}
              <Link href="/mes-enfants" className="text-vert underline">
                Reliez votre premier enfant
              </Link>
              .
            </p>
          )}
          {cartes}
        </div>
      </div>
    );
  }

  /* ---------------------------- ÉLÈVE ----------------------------- */
  if (utilisateur.role === "eleve") {
    const [mesNotes, mesPresences, monInscription] = await Promise.all([
      notesDeLeleve(utilisateur.id, 8),
      presencesDeLeleve(utilisateur.id, 6),
      db
        .select({
          classeId: classes.id,
          classeNom: classes.nom,
          etablissementId: classes.etablissementId,
        })
        .from(inscriptions)
        .innerJoin(classes, eq(classes.id, inscriptions.classeId))
        .where(eq(inscriptions.eleveUserId, utilisateur.id))
        .limit(1),
    ]);
    const classe = monInscription[0];
  const echeances: { libelle: string; echeance: string; etat: "respectee" | "manquee" | "a_venir" }[] = [];
  if (classe) {
    const mesFactures = await db
      .select({ id: factures.id, categorie: frais.categorie, libelle: frais.libelle })
      .from(factures)
      .innerJoin(frais, eq(frais.id, factures.fraisId))
      .where(eq(factures.eleveUserId, utilisateur.id));
    const aujourdhui = new Date().toISOString().slice(0, 10);
    for (const mf of mesFactures) {
      const ts = await db.select().from(tranches).where(eq(tranches.factureId, mf.id));
      const ps = await db
        .select({ montant: paiements.montant, annule: paiements.annule })
        .from(paiements)
        .where(eq(paiements.factureId, mf.id));
      const paye = ps.filter((p) => !p.annule).reduce((a, p) => a + p.montant, 0);
      let reste = paye;
      const categories: Record<string, string> = { scolarite: "Scolarité", inscription: "Inscription", tenue: "Tenue scolaire", cantine: "Cantine", transport: "Transport", examen: "Examen", td: "Travaux dirigés", fournitures: "Fournitures", etude_dossier: "Étude de dossier", autre: "Frais" };
      for (const t of ts.sort((a, b) => a.ordre - b.ordre)) {
        const couvert = Math.min(reste, t.montant);
        reste -= couvert;
        echeances.push({
          libelle: mf.categorie === "autre" && mf.libelle ? mf.libelle : (categories[mf.categorie] ?? "Frais") + " — tranche " + t.ordre,
          echeance: t.echeance,
          etat: couvert >= t.montant ? "respectee" : t.echeance < aujourdhui ? "manquee" : "a_venir",
        });
      }
    }
  }
    const [publication] = classe
      ? await db
          .select({ id: publicationsBulletins.id })
          .from(publicationsBulletins)
          .where(eq(publicationsBulletins.classeId, classe.classeId))
          .limit(1)
      : [];

    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{titre}</h1>
        <p className="mt-2 text-encre-doux">
          {classe
            ? `Votre classe : ${classe.classeNom}.`
            : "Vous n'êtes pas encore inscrit dans une classe."}{" "}
          Votre coach d'orientation arrive dans votre menu.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-ligne bg-white p-5">
            <h2 className="font-semibold">Mes notes</h2>
            {mesNotes.length === 0 ? (
              <p className="mt-2 text-sm text-encre-doux">Pas encore de note.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {mesNotes.map((n, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      <span className="font-medium">{n.matiere}</span>{" "}
                      <span className="text-encre-doux">
                        {n.titre} · {formaterDate(n.date)}
                      </span>
                    </span>
                    <span className="font-semibold text-vert-fonce">
                      {sur20(n.valeur, n.bareme)}/20
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-ligne bg-white p-5">
            <h2 className="font-semibold">Mes présences</h2>
            {mesPresences.length === 0 ? (
              <p className="mt-2 text-sm text-encre-doux">Aucun signalement : bravo.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {mesPresences.map((p, i) => (
                  <li key={i}>
                    <span
                      className={p.statut === "absent" ? "font-medium text-rouge" : "font-medium"}
                    >
                      {libellesPresence[p.statut]}
                    </span>{" "}
                    <span className="text-encre-doux">
                      {formaterDate(p.date)}
                      {p.motif ? ` · ${p.motif}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>


        {classe && (
          <section className="mt-6 rounded-2xl border border-ligne bg-white p-5">
            <h2 className="font-semibold">Mes échéances de paiement</h2>
            {echeances.length === 0 ? (
              <p className="mt-2 text-sm text-encre-doux">Aucune échéance enregistrée.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {echeances.map((e, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{e.libelle}</span>
                    <span
                      className={
                        e.etat === "manquee"
                          ? "font-medium text-rouge"
                          : e.etat === "respectee"
                            ? "font-medium text-vert-fonce"
                            : "font-medium"
                      }
                    >
                      {e.etat === "respectee" ? "Respectée" : e.etat === "manquee" ? "Manquée" : "À venir"} · {formaterDate(e.echeance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-encre-doux">
              Les échéances se règlent entre l'établissement et vos parents :
              les montants ne sont pas affichés ici.
            </p>
          </section>
        )}

        {classe && publication && (
          <p className="mt-6">
            <Link
              href={`/classes/${classe.classeId}/bulletins/${utilisateur.id}`}
              className="font-medium text-vert underline hover:text-vert-fonce"
            >
              Voir mon bulletin du trimestre
            </Link>
          </p>
        )}
      </div>
    );
  }

  /* -------------------------- ENSEIGNANT -------------------------- */
  if (utilisateur.role === "enseignant") {
    const mesClasses = await db
      .selectDistinct({ id: classes.id, nom: classes.nom, niveau: classes.niveau })
      .from(enseignements)
      .innerJoin(classes, eq(classes.id, enseignements.classeId))
      .where(eq(enseignements.enseignantUserId, utilisateur.id));

    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{titre}</h1>
        <p className="mt-2 text-encre-doux">Vos classes et vos outils du quotidien.</p>
        <ul className="mt-8 space-y-3">
          {mesClasses.length === 0 && (
            <li className="rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
              Aucune classe ne vous est encore confiée : la direction vous
              affectera une matière.
            </li>
          )}
          {mesClasses.map((c) => (
            <li key={c.id} className="rounded-2xl border border-ligne bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  <Link
                    href={`/classes/${c.id}`}
                    className="hover:text-vert-fonce"
                  >
                    {c.nom}
                  </Link>{" "}
                  <span className="text-sm font-normal text-encre-doux">({c.niveau})</span>
                </p>
                <div className="flex gap-3 text-sm">
                  <Link
                    href={`/classes/${c.id}/appel`}
                    className="rounded-lg bg-vert px-3 py-1.5 font-medium text-white hover:bg-vert-fonce"
                  >
                    Faire l&apos;appel
                  </Link>
                  <Link
                    href={`/classes/${c.id}/evaluations`}
                    className="rounded-lg border border-ligne px-3 py-1.5 font-medium hover:bg-papier"
                  >
                    Évaluations
                  </Link>
                  <Link
                    href={`/classes/${c.id}/bulletins`}
                    className="rounded-lg border border-ligne px-3 py-1.5 font-medium hover:bg-papier"
                  >
                    Bulletins
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* -------------------- DIRECTION et MINISTÈRE -------------------- */
  const raccourcis =
    utilisateur.role === "direction"
      ? [
          { href: "/mon-ecole", titre: "Mon école", texte: "Classes, programme, inscriptions." },
          { href: "/finances", titre: "Finances", texte: "Frais, factures, encaissements, délégation." },
        ]
      : [
          {
            href: "/ministere",
            titre: "Espace ministère",
            texte: "Validation des écoles et lecture de la nation.",
          },
        ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{titre}</h1>
      <p className="mt-2 text-encre-doux">
        Votre espace en tant que {libellesRole[utilisateur.role]}.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {raccourcis.map((r) => (
          <li key={r.href} className="rounded-2xl border border-ligne bg-white p-5">
            <Link href={r.href} className="font-semibold text-vert-fonce hover:underline">
              {r.titre}
            </Link>
            <p className="mt-1 text-sm text-encre-doux">{r.texte}</p>
          </li>
        ))}
      </ul>
      <form action={seDeconnecter} className="mt-10">
        <button
          type="submit"
          className="rounded-xl border border-ligne px-4 py-2 text-sm font-medium hover:bg-papier"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
