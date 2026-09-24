import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, inscriptions, liensFamille, users } from "@/db/schema";
import { exiger, nomComplet } from "@/lib/auth";
import FormulaireLier from "./formulaire-lier";

export const metadata: Metadata = { title: "Mes enfants" };

export default async function MesEnfants() {
  const parent = await exiger("parent");

  const enfants = await db
    .select({
      id: users.id,
      prenom: users.prenom,
      nom: users.nom,
      classe: classes.nom,
      niveau: classes.niveau,
    })
    .from(liensFamille)
    .innerJoin(users, eq(users.id, liensFamille.eleveUserId))
    .leftJoin(inscriptions, eq(inscriptions.eleveUserId, users.id))
    .leftJoin(classes, eq(classes.id, inscriptions.classeId))
    .where(eq(liensFamille.parentUserId, parent.id))
    .orderBy(asc(users.nom));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Mes enfants</h1>
      <p className="mt-2 text-encre-doux">
        Tous vos enfants, même dans des établissements différents, suivis depuis
        un seul compte.
      </p>

      {enfants.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
          Aucun enfant relié pour l&apos;instant. Indiquez ci-dessous l&apos;email
          du compte de votre enfant.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {enfants.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-2xl border border-ligne bg-white p-4"
            >
              <div>
                <p className="font-semibold">{nomComplet(e)}</p>
                <p className="text-sm text-encre-doux">
                  {e.classe ? `${e.classe} (${e.niveau})` : "Pas encore inscrit dans une classe"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-xl font-bold tracking-tight">Relier un enfant</h2>
      <FormulaireLier />
    </div>
  );
}
