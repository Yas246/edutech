import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, delegues, etablissements, inscriptions, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { ecoleDeLaDirection } from "@/lib/ecole";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import { basculerDelegue } from "../actions";

export const metadata: Metadata = { title: "Délégués" };

/**
 * Les délégués de la classe : des élèves que la direction désigne et
 * qui peuvent, en plus des professeurs, publier dans la classe et
 * donner les devoirs.
 */
export default async function PageDelegues({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idClasse = Number(id);
  if (!Number.isInteger(idClasse)) notFound();

  const utilisateur = await exiger("direction");
  const ecole = await ecoleDeLaDirection(utilisateur);

  const [classe] = await db
    .select({
      id: classes.id,
      nom: classes.nom,
      etablissementNom: etablissements.nom,
      directionUserId: etablissements.directionUserId,
    })
    .from(classes)
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(classes.id, idClasse))
    .limit(1);
  if (!classe || classe.directionUserId !== utilisateur.id) notFound();

  const eleves = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(inscriptions)
    .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
    .where(eq(inscriptions.classeId, idClasse))
    .orderBy(asc(users.nom));

  const designes = await db
    .select({ eleveUserId: delegues.eleveUserId })
    .from(delegues)
    .where(eq(delegues.classeId, idClasse));
  const idsDelegues = new Set(designes.map((d) => d.eleveUserId));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        fil={[
          { href: "/mon-ecole", label: classe.etablissementNom },
          { href: `/classes/${classe.id}`, label: classe.nom },
        ]}
        titre={`Délégués de ${classe.nom}`}
        sousTitre="Un délégué publie dans la classe et donne les devoirs, en plus des professeurs. Un clic suffit pour désigner ou retirer."
      />

      <section className="mt-8">
        {eleves.length === 0 ? (
          <EtatVide>
            Aucun élève inscrit dans cette classe : les délégués se
            désignent parmi les inscrits.
          </EtatVide>
        ) : (
          <ul className="space-y-2">
            {eleves.map((e) => {
              const estDelegue = idsDelegues.has(e.id);
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-ligne bg-white px-4 py-3"
                >
                  <span className="text-sm font-medium">
                    {e.prenom} {e.nom}
                    {estDelegue && (
                      <span className="ml-2 rounded-full bg-vert-clair px-2.5 py-0.5 text-xs font-semibold text-vert-fonce">
                        délégué
                      </span>
                    )}
                  </span>
                  <form action={basculerDelegue}>
                    <input type="hidden" name="classeId" value={classe.id} />
                    <input type="hidden" name="eleveUserId" value={e.id} />
                    <button
                      type="submit"
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        estDelegue
                          ? "border border-ligne text-encre-doux hover:bg-rouge-clair hover:text-rouge"
                          : "bg-vert text-white hover:bg-vert-fonce"
                      }`}
                    >
                      {estDelegue ? "Retirer" : "Désigner"}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
