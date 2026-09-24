import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { etablissements, salles } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { Alerte } from "@/components/ui/alerte";
import { Bouton, Champ, champClasse } from "@/components/ui/formulaire";
import { EnTetePage } from "@/components/ui/en-tete";
import { creerSalle, supprimerSalle } from "./actions";
import FormulaireSalle from "./formulaire-salle";

export const metadata: Metadata = { title: "Salles" };

export default async function PageSalles() {
  const direction = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, direction.id))
    .limit(1);

  const liste = ecole
    ? await db
        .select()
        .from(salles)
        .where(eq(salles.etablissementId, ecole.id))
        .orderBy(asc(salles.nom))
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/mon-ecole", label: "Mon école" }]}
        titre="Les salles"
        sousTitre="Les salles servent à l'emploi du temps : un même créneau ne peut pas être posé deux fois dans la même salle."
      />

      {ecole ? (
        <>
          <section className="mt-8">
            <h2 className="text-xl font-bold tracking-tight">
              Salles de l'établissement ({liste.length})
            </h2>
            {liste.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
                Aucune salle encore créée. Commencez par la principale.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
                {liste.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <p className="font-medium">
                      {s.nom}
                      {s.capacite > 0 && (
                        <span className="ml-2 text-sm text-encre-doux">
                          {s.capacite} places
                        </span>
                      )}
                    </p>
                    <form
                      action={async (donnees: FormData) => {
                        "use server";
                        await supprimerSalle({}, donnees);
                      }}
                    >
                      <input type="hidden" name="salleId" value={s.id} />
                      <Bouton variante="danger" taille="petit" type="submit">
                        Retirer
                      </Bouton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <FormulaireSalle />
        </>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
          Aucun établissement rattaché à votre compte.
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
