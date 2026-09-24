import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { delegations, etablissements, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { Bouton } from "@/components/ui/formulaire";
import { EtatVide } from "@/components/ui/etat-vide";
import { poserDelegation, retirerDelegation } from "./actions";

export const metadata: Metadata = { title: "Délégations" };

const roles = [
  {
    valeur: "finances",
    titre: "Finances",
    texte: "Frais, factures, encaissements, journal.",
  },
  {
    valeur: "vie_scolaire",
    titre: "Vie scolaire",
    texte: "Appel, évaluations, notes et bulletins de toutes les classes.",
  },
  {
    valeur: "edt",
    titre: "Emploi du temps",
    texte: "Créneaux et salles de l'établissement.",
  },
];

export default async function Delegations() {
  const direction = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, direction.id))
    .limit(1);

  const equipe = ecole
    ? await db
        .select({ id: users.id, prenom: users.prenom, nom: users.nom })
        .from(users)
        .where(eq(users.role, "enseignant"))
        .orderBy(asc(users.nom))
    : [];

  const posees = ecole
    ? await db
        .select({ userId: delegations.userId, role: delegations.role })
        .from(delegations)
        .where(eq(delegations.etablissementId, ecole.id))
    : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/mon-ecole", label: "Mon école" }]}
        titre="Délégations"
        sousTitre="Confiez un rôle à un membre de votre équipe : il n'obtient rien d'autre. Le retrait est immédiat et tout est inscrit au journal."
      />

      {ecole ? (
        <section className="mt-8">
          <h2 className="text-xl font-bold tracking-tight">Votre équipe</h2>
          <table className="mt-3 w-full rounded-2xl border border-ligne bg-white text-sm">
            <caption className="sr-only">Délégations par membre et par rôle</caption>
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Membre</th>
                {roles.map((r) => (
                  <th key={r.valeur} scope="col" className="px-4 py-2 font-medium">
                    {r.titre}
                    <span className="block text-xs font-normal">{r.texte}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipe.map((membre) => (
                <tr key={membre.id} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {membre.prenom} {membre.nom}
                  </td>
                  {roles.map((r) => {
                    const posee = posees.some(
                      (p) => p.userId === membre.id && p.role === r.valeur,
                    );
                    return (
                      <td key={r.valeur} className="px-4 py-3">
                        {posee ? (
                          <form action={retirerFormulaire}>
                            <input type="hidden" name="userId" value={membre.id} />
                            <input type="hidden" name="role" value={r.valeur} />
                            <Bouton variante="danger" taille="petit" type="submit">
                              Retirer
                            </Bouton>
                          </form>
                        ) : (
                          <form action={poserFormulaire}>
                            <input type="hidden" name="userId" value={membre.id} />
                            <input type="hidden" name="role" value={r.valeur} />
                            <Bouton taille="petit" type="submit">
                              Déléguer
                            </Bouton>
                          </form>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {equipe.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EtatVide>
                      Aucun enseignant sur la plateforme : ils se créent un compte
                      et vous les verrez ici.
                    </EtatVide>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="mt-6">
          <EtatVide>Aucun établissement rattaché à votre compte.</EtatVide>
        </p>
      )}

      <p className="mt-8 text-sm text-encre-doux">
        <Link href="/mon-ecole" className="text-vert underline hover:text-vert-fonce">
          Retour à mon école
        </Link>
      </p>
    </div>
  );
}

async function poserFormulaire(donnees: FormData) {
  "use server";
  await poserDelegation(donnees);
}

async function retirerFormulaire(donnees: FormData) {
  "use server";
  await retirerDelegation(donnees);
}
