import type { Metadata } from "next";
import { asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { classes, etablissements } from "@/db/schema";
import { exiger } from "@/lib/auth";
import {
  assiduiteEnseignants,
  classesSansBulletin,
  effectifsParNiveau,
  pariteGenre,
  profilEcole,
  ratioElevesEnseignant,
  statistiquesDepartement,
} from "@/lib/outils/ministere";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Indicateurs nationaux" };

function pourcent(v: number | null) {
  return v === null ? "—" : `${String(v).replace(".", ",")} %`;
}

export default async function Indicateurs({
  searchParams,
}: {
  searchParams: Promise<{ dep?: string; ecole?: string; niveau?: string }>;
}) {
  await exiger("ministere");
  const { dep = "", ecole = "", niveau = "" } = await searchParams;
  const idEcole = Number(ecole) || undefined;

  // Les listes des filtres, et les indicateurs par les MÊMES fonctions
  // que celles du registre : interface et coach ne divergent jamais.
  const departements = (await statistiquesDepartement()).map((d) => d.departement);
  const ecolesValidees = await db
    .select({ id: etablissements.id, nom: etablissements.nom, commune: etablissements.commune })
    .from(etablissements)
    .where(eq(etablissements.statut, "valide"))
    .orderBy(asc(etablissements.nom))
    .limit(400);
  const niveaux = (
    await db
      .selectDistinct({ niveau: classes.niveau })
      .from(classes)
      .where(ne(classes.niveau, ""))
      .orderBy(asc(classes.niveau))
  ).map((n) => n.niveau);

  const effectifs = await effectifsParNiveau(dep || undefined);
  const ratios = await ratioElevesEnseignant(dep || undefined);
  const parite = await pariteGenre({
    departement: dep || undefined,
    niveau: niveau || undefined,
  });
  const assiduite = await assiduiteEnseignants({
    departement: dep || undefined,
    etablissementId: idEcole,
  });
  const sansBulletin = await classesSansBulletin(dep || undefined);
  const fiche = idEcole ? await profilEcole(idEcole) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/ministere", label: "Espace ministère" }]}
        titre="Indicateurs nationaux"
        sousTitre="Effectifs, parité, ratio élèves/enseignant, assiduité des enseignants et publication des bulletins. Aucun montant financier ne figure ici."
      />

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="dep" className="block text-sm font-medium">Département</label>
          <select id="dep" name="dep" defaultValue={dep} className="mt-1 w-52 rounded-xl border border-ligne bg-white px-3 py-2 text-sm">
            <option value="">Toute la nation</option>
            {departements.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ecole" className="block text-sm font-medium">Établissement</label>
          <select id="ecole" name="ecole" defaultValue={ecole} className="mt-1 w-72 rounded-xl border border-ligne bg-white px-3 py-2 text-sm">
            <option value="">Tous</option>
            {ecolesValidees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom} ({e.commune})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="niveau" className="block text-sm font-medium">Niveau</label>
          <select id="niveau" name="niveau" defaultValue={niveau} className="mt-1 w-44 rounded-xl border border-ligne bg-white px-3 py-2 text-sm">
            <option value="">Tous</option>
            {niveaux.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce">
          Appliquer
        </button>
      </form>

      {fiche && (
        <section className="mt-8 rounded-2xl border border-ligne bg-vert-clair/40 p-5">
          <h2 className="text-lg font-bold tracking-tight">{fiche.nom}</h2>
          <p className="text-sm text-encre-doux">
            {fiche.commune} ({fiche.departement})
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-encre-doux">Effectifs</dt>
              <dd className="text-xl font-bold">{fiche.effectifs}</dd>
            </div>
            <div>
              <dt className="text-xs text-encre-doux">Classes</dt>
              <dd className="text-xl font-bold">{fiche.classes}</dd>
            </div>
            <div>
              <dt className="text-xs text-encre-doux">Moyenne générale</dt>
              <dd className="text-xl font-bold">
                {fiche.moyenneGenerale === null ? "—" : String(fiche.moyenneGenerale).replace(".", ",")}/20
              </dd>
            </div>
            <div>
              <dt className="text-xs text-encre-doux">Assiduité des enseignants</dt>
              <dd className="text-xl font-bold">{pourcent(fiche.tauxAssiduiteEnseignants)}</dd>
            </div>
          </dl>
          {fiche.meilleurEleve && (
            <p className="mt-3 text-sm">
              Meilleur apprenant : <strong>{fiche.meilleurEleve.prenom} {fiche.meilleurEleve.nom}</strong>{" "}
              ({fiche.meilleurEleve.classe}) à {String(fiche.meilleurEleve.moyenne).replace(".", ",")}/20.
            </p>
          )}
        </section>
      )}

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <h2 className="text-sm font-semibold text-encre-doux">Parité (filles / garçons)</h2>
          <p className="mt-1 text-2xl font-bold">
            {parite.filles} / {parite.garcons}
          </p>
          <p className="text-xs text-encre-doux">
            Indice de parité : {parite.indiceParite === null ? "—" : String(parite.indiceParite).replace(".", ",")}
            {parite.nonRenseigne > 0 ? ` · ${parite.nonRenseigne} non renseigné${parite.nonRenseigne > 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <h2 className="text-sm font-semibold text-encre-doux">Assiduité des enseignants (30 jours)</h2>
          <p className="mt-1 text-2xl font-bold">{pourcent(assiduite.tauxGlobal)}</p>
          <p className="text-xs text-encre-doux">{assiduite.parEnseignant.length} enseignant(s) pointé(s)</p>
        </div>
        <div className="rounded-2xl border border-ligne bg-white p-4">
          <h2 className="text-sm font-semibold text-encre-doux">Classes sans bulletins publiés</h2>
          <p className="mt-1 text-2xl font-bold">{sansBulletin.length}</p>
          <p className="text-xs text-encre-doux">sur les établissements validés du périmètre</p>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Effectifs par niveau</h2>
          <table className="mt-3 w-full rounded-2xl border border-ligne bg-white text-sm">
            <caption className="sr-only">Effectifs par niveau</caption>
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Niveau</th>
                <th scope="col" className="px-4 py-2 font-medium">Filles</th>
                <th scope="col" className="px-4 py-2 font-medium">Garçons</th>
                <th scope="col" className="px-4 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {effectifs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-encre-doux">
                    Aucun effectif sur ce périmètre.
                  </td>
                </tr>
              )}
              {effectifs.map((l) => (
                <tr key={l.niveau} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{l.niveau}</td>
                  <td className="px-4 py-2">{l.filles}</td>
                  <td className="px-4 py-2">{l.garcons}</td>
                  <td className="px-4 py-2 font-semibold">{l.effectifs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-lg font-bold tracking-tight">Élèves par enseignant (ED04)</h2>
          <table className="mt-3 w-full rounded-2xl border border-ligne bg-white text-sm">
            <caption className="sr-only">Ratio élèves par enseignant</caption>
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Département</th>
                <th scope="col" className="px-4 py-2 font-medium">Élèves</th>
                <th scope="col" className="px-4 py-2 font-medium">Enseignants</th>
                <th scope="col" className="px-4 py-2 font-medium">Ratio</th>
              </tr>
            </thead>
            <tbody>
              {ratios.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-encre-doux">
                    Aucun établissement validé sur ce périmètre.
                  </td>
                </tr>
              )}
              {ratios.map((l) => (
                <tr key={l.perimetre} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{l.perimetre}</td>
                  <td className="px-4 py-2">{l.eleves}</td>
                  <td className="px-4 py-2">{l.enseignants}</td>
                  <td className="px-4 py-2 font-semibold">
                    {l.ratio === null ? "—" : String(l.ratio).replace(".", ",")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {assiduite.parEnseignant.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Assiduité, enseignant par enseignant</h2>
          <table className="mt-3 w-full rounded-2xl border border-ligne bg-white text-sm">
            <caption className="sr-only">Assiduité des enseignants</caption>
            <thead>
              <tr className="border-b border-ligne text-left text-encre-doux">
                <th scope="col" className="px-4 py-2 font-medium">Enseignant</th>
                <th scope="col" className="px-4 py-2 font-medium">Établissement</th>
                <th scope="col" className="px-4 py-2 font-medium">Présences</th>
                <th scope="col" className="px-4 py-2 font-medium">Retards</th>
                <th scope="col" className="px-4 py-2 font-medium">Absences</th>
                <th scope="col" className="px-4 py-2 font-medium">Taux</th>
              </tr>
            </thead>
            <tbody>
              {assiduite.parEnseignant.map((l) => (
                <tr key={`${l.prenom}-${l.nom}-${l.etablissement}`} className="border-b border-ligne/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{l.prenom} {l.nom}</td>
                  <td className="px-4 py-2 text-encre-doux">{l.etablissement}</td>
                  <td className="px-4 py-2">{l.presents}</td>
                  <td className="px-4 py-2">{l.retards}</td>
                  <td className="px-4 py-2">{l.absents}</td>
                  <td className="px-4 py-2 font-semibold">{pourcent(l.taux)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {sansBulletin.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Bulletins non publiés</h2>
          <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
            {sansBulletin.slice(0, 20).map((l, i) => (
              <li key={`${l.etablissement}-${l.classe}-${i}`} className="flex justify-between p-3 text-sm">
                <span className="font-medium">{l.classe}</span>
                <span className="text-encre-doux">
                  {l.etablissement} ({l.departement})
                </span>
              </li>
            ))}
          </ul>
          {sansBulletin.length > 20 && (
            <p className="mt-2 text-xs text-encre-doux">
              et {sansBulletin.length - 20} autres.
            </p>
          )}
        </section>
      )}

      {effectifs.length === 0 && !fiche && (
        <div className="mt-8">
          <EtatVide>
            Aucune donnée sur ce périmètre : élargissez les filtres ou attendez
            que les établissements saisissent leurs classes.
          </EtatVide>
        </div>
      )}
    </div>
  );
}
