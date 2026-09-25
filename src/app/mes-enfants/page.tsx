import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  declarationsEnfant,
  inscriptions,
  liensFamille,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import {
  declarerEnfantFormulaire,
  croiserCodeFormulaire,
  regenererCodeFamille,
  retirerDeclaration,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mes enfants" };

const relations: Record<string, string> = {
  pere: "Père",
  mere: "Mère",
  tuteur: "Tuteur / Tutrice",
};

export default async function MesEnfants() {
  const parent = await exiger("parent");

  // Les enfants LIÉS : le suivi n'existe que pour eux.
  const enfants = await db
    .select({
      id: users.id,
      prenom: users.prenom,
      nom: users.nom,
      pseudo: users.pseudo,
      classe: classes.nom,
      niveau: classes.niveau,
    })
    .from(liensFamille)
    .innerJoin(users, eq(users.id, liensFamille.eleveUserId))
    .leftJoin(inscriptions, eq(inscriptions.eleveUserId, users.id))
    .leftJoin(classes, eq(classes.id, inscriptions.classeId))
    .where(eq(liensFamille.parentUserId, parent.id))
    .orderBy(asc(users.nom));

  const declarations = await db
    .select()
    .from(declarationsEnfant)
    .where(eq(declarationsEnfant.parentUserId, parent.id))
    .orderBy(declarationsEnfant.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        titre="Mes enfants"
        sousTitre="Vous déclarez votre enfant, votre enfant confirme avec votre code : le suivi ne s'ouvre que par cette preuve mutuelle. Tous vos enfants, même dans des établissements différents, suivis depuis un seul compte."
      />

      {declarations.length > 0 && (
        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-bold tracking-tight">Mes déclarations</h2>
          {declarations.map((d) => (
            <article key={d.id} className="rounded-2xl border border-ligne bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  {d.prenom} {d.nom}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    d.eleveUserId
                      ? "bg-vert-clair text-vert-fonce"
                      : "border border-ligne text-encre-doux"
                  }`}
                >
                  {d.eleveUserId ? "Suivi ouvert" : "En attente du code de l'enfant"}
                </span>
              </div>
              <p className="text-sm text-encre-doux">{relations[d.relation] ?? d.relation}</p>

              {d.eleveUserId ? (
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <Link
                    href="/tableau-de-bord"
                    className="font-medium text-vert underline hover:text-vert-fonce"
                  >
                    Voir le suivi dans mon espace
                  </Link>
                  <Link
                    href={`/eleves/${d.eleveUserId}/passeport`}
                    className="font-medium text-vert underline hover:text-vert-fonce"
                  >
                    Passeport scolaire
                  </Link>
                </p>
              ) : (
                <div className="mt-3 rounded-xl bg-papier p-3">
                  <p className="text-sm">
                    Code famille à donner à{" "}
                    <span className="font-semibold">{d.prenom}</span> :
                    <span className="ml-2 rounded-lg border border-vert/30 bg-vert-clair/60 px-3 py-1 font-mono font-bold tracking-widest text-vert-fonce">
                      {d.codeFamille}
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <form action={croiserCodeFormulaire} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="declarationId" value={d.id} />
                      <input
                        name="code"
                        required
                        maxLength={12}
                        placeholder="Code personnel de l'élève (VMP-XXXX)"
                        className="w-64 rounded-xl border border-ligne bg-white px-3 py-1.5 text-sm uppercase tracking-wider"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-vert px-4 py-1.5 text-sm font-medium text-white hover:bg-vert-fonce"
                      >
                        Ouvrir le suivi
                      </button>
                    </form>
                    <form action={regenererCodeFamille}>
                      <input type="hidden" name="declarationId" value={d.id} />
                      <button
                        type="submit"
                        className="text-xs text-encre-doux underline hover:text-encre"
                      >
                        Régénérer le code famille
                      </button>
                    </form>
                    <form action={retirerDeclaration}>
                      <input type="hidden" name="declarationId" value={d.id} />
                      <button
                        type="submit"
                        className="text-xs text-rouge underline hover:brightness-90"
                      >
                        Retirer la déclaration
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {enfants.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">
            Suivi ouvert ({enfants.length})
          </h2>
          <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
            {enfants.map((e) => (
              <li
                key={`${e.id}-${e.classe ?? ""}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">
                    {e.prenom} {e.nom}
                  </p>
                  <p className="text-sm text-encre-doux">
                    {e.classe ? `${e.classe} (${e.niveau})` : "Pas encore inscrit"} · @{e.pseudo}
                  </p>
                </div>
                <Link
                  href="/tableau-de-bord"
                  className="text-sm font-medium text-vert underline hover:text-vert-fonce"
                >
                  Le suivi
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-ligne bg-white p-5">
        <h2 className="font-semibold">Déclarer un enfant</h2>
        <form action={declarerEnfantFormulaire} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            name="prenom"
            required
            placeholder="Prénom de l'enfant"
            className="rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
          <input
            name="nom"
            required
            placeholder="Nom de l'enfant"
            className="rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
          <select
            name="relation"
            required
            defaultValue="mere"
            className="rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          >
            <option value="pere">Je suis le père</option>
            <option value="mere">Je suis la mère</option>
            <option value="tuteur">Tuteur / Tutrice</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce sm:col-span-3"
          >
            Déclarer et obtenir mon code famille
          </button>
        </form>
      </section>

      {declarations.length === 0 && enfants.length === 0 && (
        <div className="mt-8">
          <EtatVide>
            Aucun enfant déclaré pour l&apos;instant : déclarez votre premier
            enfant ci-dessus, puis croisez vos codes pour ouvrir le suivi.
          </EtatVide>
        </div>
      )}
    </div>
  );
}
