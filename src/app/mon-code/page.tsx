import type { Metadata } from "next";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { Alerte } from "@/components/ui/alerte";
import { lierParentFormulaire, codePersonnel, parentsLies } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mon code famille" };

export default async function MonCode() {
  const utilisateur = await exiger("eleve");
  const code = await codePersonnel(utilisateur.id);
  const parents = await parentsLies(utilisateur.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <EnTetePage
        titre="Mon code famille"
        sousTitre="Le suivi par un parent s'ouvre par un échange de codes, jamais par un simple nom. Vous ne donnez votre code qu'à vos vrais parents."
      />

      <section className="mt-8 rounded-2xl border border-ligne bg-vert-clair/40 p-5">
        <h2 className="text-sm font-semibold text-encre-doux">
          Mon code personnel — à donner à mon parent
        </h2>
        <p className="mt-2 rounded-xl border border-vert/30 bg-white px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.3em] text-vert-fonce">
          {code}
        </p>
        <p className="mt-2 text-xs text-encre-doux">
          Votre parent saisit ce code sur sa déclaration : son suivi (notes,
          devoirs, absences) s&apos;ouvre alors.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-ligne bg-white p-5">
        <h2 className="font-semibold">Relier le code d&apos;un parent</h2>
        <p className="mt-1 text-sm text-encre-doux">
          Votre parent vous a donné un code famille ? Saisissez-le ici : sa
          déclaration se rattache à votre compte.
        </p>
        <form action={lierParentFormulaire} className="mt-3 flex flex-wrap gap-2">
          <input
            name="code"
            required
            maxLength={12}
            placeholder="VMF-XXXX"
            className="w-48 rounded-xl border border-ligne bg-white px-3 py-2 text-sm uppercase tracking-wider"
          />
          <button
            type="submit"
            className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
          >
            Relier mon parent
          </button>
        </form>
        <div className="mt-2">
          <Alerte />
        </div>
      </section>

      {parents.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">
            Mes parents reliés ({parents.length})
          </h2>
          <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
            {parents.map((p) => (
              <li key={p.id} className="p-4">
                <p className="font-medium">
                  {p.prenom} {p.nom}
                </p>
                <p className="text-sm text-encre-doux">@{p.pseudo}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
