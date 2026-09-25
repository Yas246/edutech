import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { codesEquipe, equipes, etablissements, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { genererCode } from "@/lib/codes";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import {
  confirmerMembre,
  regenererCodeEquipe,
  revoquerMembre,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mon équipe" };

export default async function MonEquipe() {
  const utilisateur = await exiger("direction");
  const [ecole] = await db
    .select({ id: etablissements.id, nom: etablissements.nom })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, utilisateur.id))
    .limit(1);
  if (!ecole) redirect("/tableau-de-bord");

  const membres = await db
    .select({
      userId: users.id,
      prenom: users.prenom,
      nom: users.nom,
      pseudo: users.pseudo,
      statut: equipes.statut,
    })
    .from(equipes)
    .innerJoin(users, eq(users.id, equipes.userId))
    .where(eq(equipes.etablissementId, ecole.id))
    .orderBy(asc(users.nom));

  const confirmes = membres.filter((m) => m.statut === "confirme");
  const candidats = membres.filter((m) => m.statut === "declare");

  // Le code d'invitation, créé paresseusement à la première visite.
  let [codeRow] = await db
    .select({ code: codesEquipe.code })
    .from(codesEquipe)
    .where(eq(codesEquipe.etablissementId, ecole.id))
    .limit(1);
  if (!codeRow) {
    const code = await genererCode("VME-", async (c) =>
      Boolean(
        await db
          .select({ id: codesEquipe.etablissementId })
          .from(codesEquipe)
          .where(eq(codesEquipe.code, c))
          .limit(1)
          .then((r) => r.length),
      ),
    );
    await db.insert(codesEquipe).values({ etablissementId: ecole.id, code });
    codeRow = { code };
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/mon-ecole", label: ecole.nom }]}
        titre="Mon équipe"
        sousTitre="Les enseignants entrent par le code d'invitation ou se déclarent ; vous confirmez. Seuls les membres confirmés portent des matières."
      />

      <section className="mt-8 rounded-2xl border border-ligne bg-vert-clair/40 p-5">
        <h2 className="text-sm font-semibold text-encre-doux">Code d&apos;invitation de l&apos;école</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="rounded-xl border border-vert/30 bg-white px-4 py-2 font-mono text-lg font-bold tracking-widest text-vert-fonce">
            {codeRow.code}
          </p>
          <form action={regenererCodeEquipe}>
            <button
              type="submit"
              className="rounded-xl border border-ligne bg-white px-4 py-2 text-sm font-medium hover:bg-papier"
            >
              Régénérer (l&apos;ancien ne marche plus)
            </button>
          </form>
        </div>
        <p className="mt-2 text-xs text-encre-doux">
          À donner à un collègue enseignant : il le saisit dans « Rejoindre »
          et rejoint l&apos;équipe confirmé.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">
          Équipe confirmée ({confirmes.length})
        </h2>
        {confirmes.length === 0 ? (
          <div className="mt-3">
            <EtatVide>
              Aucun membre confirmé : partagez le code d&apos;invitation ou
              confirmez les déclarations ci-dessous.
            </EtatVide>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
            {confirmes.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {m.prenom} {m.nom}
                  </p>
                  <p className="text-sm text-encre-doux">@{m.pseudo}</p>
                </div>
                <form action={revoquerMembre}>
                  <input type="hidden" name="userId" value={m.userId} />
                  <button
                    type="submit"
                    className="rounded-xl border border-rouge/40 px-3 py-1.5 text-sm font-medium text-rouge hover:bg-rouge-clair"
                  >
                    Retirer de l&apos;équipe
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold tracking-tight">
          Déclarations en attente ({candidats.length})
        </h2>
        {candidats.length === 0 ? (
          <p className="mt-3 text-sm text-encre-doux">
            Aucune déclaration : un collègue peut se déclarer depuis « Rejoindre ».
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
            {candidats.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {m.prenom} {m.nom}
                  </p>
                  <p className="text-sm text-encre-doux">@{m.pseudo} · s&apos;est déclaré</p>
                </div>
                <form action={confirmerMembre}>
                  <input type="hidden" name="userId" value={m.userId} />
                  <button
                    type="submit"
                    className="rounded-xl bg-vert px-4 py-1.5 text-sm font-medium text-white hover:bg-vert-fonce"
                  >
                    Confirmer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
