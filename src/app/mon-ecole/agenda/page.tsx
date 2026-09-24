import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, etablissements, evenements } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { Bouton } from "@/components/ui/formulaire";
import FormulaireEvenement from "./formulaire-evenement";
import { creerEvenement, supprimerEvenement } from "./actions";

export const metadata: Metadata = { title: "Agenda de l'école" };

export default async function Agenda() {
  const direction = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, direction.id))
    .limit(1);

  const liste = ecole
    ? await db
        .select({
          id: evenements.id,
          titre: evenements.titre,
          description: evenements.description,
          date: evenements.date,
          portee: evenements.portee,
          classeNom: classes.nom,
        })
        .from(evenements)
        .leftJoin(classes, eq(classes.id, evenements.classeId))
        .where(eq(evenements.etablissementId, ecole.id))
        .orderBy(asc(evenements.date))
    : [];

  const mesClasses = ecole
    ? await db
        .select({ id: classes.id, nom: classes.nom })
        .from(classes)
        .where(eq(classes.etablissementId, ecole.id))
        .orderBy(asc(classes.nom))
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/mon-ecole", label: "Mon école" }]}
        titre="Agenda de l'école"
        sousTitre="Ce que vous posez ici apparaît dans le calendrier des familles : conseils de classe, réunions, examens blancs…"
      />

      {ecole ? (
        <>
          <section className="mt-8">
            <h2 className="text-xl font-bold tracking-tight">
              Événements ({liste.length})
            </h2>
            {liste.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
                Aucun événement posé pour l&apos;instant.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
                {liste.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium">{e.titre}</p>
                      <p className="text-sm text-encre-doux">
                        le {e.date} ·{" "}
                        {e.portee === "classe" ? `classe ${e.classeNom}` : "toute l'école"}
                      </p>
                    </div>
                    <form
                      action={async (donnees: FormData) => {
                        "use server";
                        await supprimerEvenement({}, donnees);
                      }}
                    >
                      <input type="hidden" name="evenementId" value={e.id} />
                      <Bouton variante="danger" taille="petit" type="submit">
                        Retirer
                      </Bouton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-bold tracking-tight">Poser un événement</h2>
            <FormulaireEvenement classesList={mesClasses} />
          </section>
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
