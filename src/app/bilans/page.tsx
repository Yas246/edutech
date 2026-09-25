import type { Metadata } from "next";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bilans, enseignements, inscriptions, liensFamille, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import FormulaireBilan from "./formulaire";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bilans" };

function quand(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Les bilans : un fil de suivi par enfant, à deux voix. Le professeur
 * écrit ses appréciations, le parent répond. Un parent ne voit jamais
 * que ses propres enfants.
 */
export default async function PageBilans() {
  const utilisateur = await exiger("enseignant", "parent");

  if (utilisateur.role === "enseignant") {
    /* Les enfants éligibles : ceux de mes classes. */
    const enfants = await db
      .selectDistinct({ id: users.id, prenom: users.prenom, nom: users.nom })
      .from(enseignements)
      .innerJoin(inscriptions, eq(inscriptions.classeId, enseignements.classeId))
      .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
      .where(eq(enseignements.enseignantUserId, utilisateur.id))
      .orderBy(asc(users.nom));

    const idsEnfants = enfants.map((e) => e.id);
    const fil = idsEnfants.length
      ? await db
          .select({
            id: bilans.id,
            contenu: bilans.contenu,
            date: bilans.createdAt,
            eleveUserId: bilans.eleveUserId,
            auteurPrenom: users.prenom,
            auteurNom: users.nom,
          })
          .from(bilans)
          .innerJoin(users, eq(users.id, bilans.auteurUserId))
          .where(inArray(bilans.eleveUserId, idsEnfants))
          .orderBy(desc(bilans.id))
          .limit(40)
      : [];

    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EnTetePage
          titre="Bilans"
          sousTitre="Un fil discret de suivi, par enfant : vous écrivez, le parent répond. Les autres parents ne voient rien d'autre que leurs propres enfants."
        />

        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">Écrire un bilan</h2>
          {enfants.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
              Aucun enfant dans vos classes pour l&apos;instant.
            </p>
          ) : (
            <div className="mt-3">
              <FormulaireBilan
                enfants={enfants.map((e) => ({ id: e.id, nom: `${e.prenom} ${e.nom}` }))}
                etiquetaBouton="Envoyer le bilan"
              />
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Le fil de suivi</h2>
          {fil.length === 0 ? (
            <div className="mt-3">
              <EtatVide>Aucun bilan pour l&apos;instant.</EtatVide>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {fil.map((b) => {
                const enfant = enfants.find((e) => e.id === b.eleveUserId);
                return (
                  <li key={b.id} className="rounded-2xl border border-ligne bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-encre-doux">
                      {enfant ? `${enfant.prenom} ${enfant.nom}` : "Élève"} ·{" "}
                      <span className="font-normal normal-case">{quand(b.date)}</span>
                    </p>
                    <p className="mt-1.5 whitespace-pre-line text-sm">{b.contenu}</p>
                    <p className="mt-1.5 text-xs text-encre-doux">
                      {b.auteurPrenom} {b.auteurNom}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    );
  }

  /* ---- Le parent : un fil par enfant relié ---- */
  const enfantsRelies = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(liensFamille)
    .innerJoin(users, eq(users.id, liensFamille.eleveUserId))
    .where(eq(liensFamille.parentUserId, utilisateur.id))
    .orderBy(asc(users.nom));

  const idsEnfants = enfantsRelies.map((e) => e.id);
  const fil = idsEnfants.length
    ? await db
        .select({
          id: bilans.id,
          contenu: bilans.contenu,
          date: bilans.createdAt,
          eleveUserId: bilans.eleveUserId,
          auteurPrenom: users.prenom,
          auteurNom: users.nom,
        })
        .from(bilans)
        .innerJoin(users, eq(users.id, bilans.auteurUserId))
        .where(inArray(bilans.eleveUserId, idsEnfants))
        .orderBy(desc(bilans.id))
        .limit(40)
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        titre="Bilans"
        sousTitre="Le fil de suivi de chacun de vos enfants : vous lisez les appréciations des professeurs et vous répondez."
      />

      {enfantsRelies.length === 0 ? (
        <div className="mt-8">
          <EtatVide>
            Aucun enfant relié pour l&apos;instant : croisez vos codes famille
            dans « Mes enfants » pour ouvrir le suivi.
          </EtatVide>
        </div>
      ) : (
        <section className="mt-8 space-y-8">
          {enfantsRelies.map((enfant) => {
            const sonFil = fil.filter((b) => b.eleveUserId === enfant.id);
            return (
              <div key={enfant.id}>
                <h2 className="text-lg font-bold tracking-tight">
                  {enfant.prenom} {enfant.nom}
                </h2>
                {sonFil.length === 0 ? (
                  <p className="mt-2 rounded-2xl border border-dashed border-ligne bg-white p-5 text-center text-sm text-encre-doux">
                    Aucun bilan pour cet enfant pour l&apos;instant.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {sonFil.map((b) => (
                      <li key={b.id} className="rounded-2xl border border-ligne bg-white p-4">
                        <p className="text-xs text-encre-doux">
                          {b.auteurPrenom} {b.auteurNom} · {quand(b.date)}
                        </p>
                        <p className="mt-1.5 whitespace-pre-line text-sm">{b.contenu}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3">
                  <FormulaireBilan
                    enfants={[]}
                    enfantFige={enfant.id}
                    etiquetaBouton={`Répondre pour ${enfant.prenom}`}
                  />
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
