import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { exiger } from "@/lib/auth";
import {
  besoinsEnseignement,
  pariteGenre,
  ratioElevesEnseignant,
  tauxAbandons,
} from "@/lib/outils/ministere";
import { EnTetePage } from "@/components/ui/en-tete";
import CarteDepartements, {
  LegendeCarte,
  quintiles,
  type DepartementCarte,
} from "@/components/carte-departements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Carte nationale" };

const INDICATEURS = [
  { cle: "parite", titre: "Parité filles / garçons" },
  { cle: "ratio", titre: "Élèves par enseignant" },
  { cle: "abandons", titre: "Abandon scolaire" },
  { cle: "besoins", titre: "Besoins d'enseignement" },
] as const;

type IndicateurCle = (typeof INDICATEURS)[number]["cle"];

const NOMBRES = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/**
 * La carte nationale : douze départements colorés par l'indicateur
 * choisi. Chaque indicateur sort des MÊMES fonctions que le coach et
 * les pages de détail — l'interface ne recalcule rien de son côté.
 */
export default async function PageCarte({
  searchParams,
}: {
  searchParams: Promise<{ indicateur?: string }>;
}) {
  await exiger("ministere");
  const { indicateur: brut = "parite" } = await searchParams;
  const cle = (INDICATEURS.find((i) => i.cle === brut) ?? INDICATEURS[0]).cle;

  let lignes: DepartementCarte[];

  if (cle === "ratio") {
    const lignesRatio = await ratioElevesEnseignant();
    const valeurs = lignesRatio.map((l) => l.ratio ?? 0);
    const paliers = quintiles(valeurs);
    lignes = lignesRatio.map((l, i) => ({
      nom: l.perimetre,
      valeurAffichee:
        l.ratio === null ? "pas d'enseignant" : `${NOMBRES.format(l.ratio)} élèves par enseignant`,
      palier: l.ratio === null ? null : paliers[i],
    }));
  } else if (cle === "abandons") {
    const lignesAbandons = await tauxAbandons();
    const valeurs = lignesAbandons.map((l) => l.taux ?? 0);
    const paliers = quintiles(valeurs);
    lignes = lignesAbandons.map((l, i) => ({
      nom: l.departement,
      valeurAffichee:
        l.taux === null
          ? "pas de donnée"
          : `${l.presumptions} présomption${l.presumptions > 1 ? "s" : ""} (${NOMBRES.format(l.taux)} %)`,
      palier: l.taux === null ? null : paliers[i],
    }));
  } else if (cle === "besoins") {
    const lignesBesoins = await besoinsEnseignement();
    const parDepartement = new Map<string, number>();
    for (const l of lignesBesoins) {
      parDepartement.set(l.departement, (parDepartement.get(l.departement) ?? 0) + l.matieresNonConfiees);
    }
    const noms = await db.execute(sql`
      SELECT DISTINCT departement FROM etablissements WHERE departement <> '' ORDER BY departement
    `);
    const tous = (noms as unknown as { departement: string }[]).map((l) => l.departement);
    const valeurs = tous.map((d) => parDepartement.get(d) ?? 0);
    const paliers = quintiles(valeurs);
    lignes = tous.map((d, i) => {
      const n = parDepartement.get(d) ?? 0;
      return {
        nom: d,
        valeurAffichee:
          n === 0 ? "aucune matière non confiée" : `${n} matière${n > 1 ? "s" : ""} non confiée${n > 1 ? "s" : ""}`,
        palier: n === 0 ? 0 : paliers[i],
      };
    });
  } else {
    // La parité : une seule requête pour les douze départements, avec
    // la formule de l'outil parite_genre (filles pour un garçon).
    const parite = (await db.execute(sql`
      SELECT e.departement,
        count(*) FILTER (WHERE u.sexe = 'F')::int AS filles,
        count(*) FILTER (WHERE u.sexe = 'M')::int AS garcons
      FROM inscriptions i
      JOIN classes c ON c.id = i.classe_id
      JOIN etablissements e ON e.id = c.etablissement_id
      JOIN users u ON u.id = i.eleve_user_id
      WHERE e.departement <> ''
      GROUP BY e.departement ORDER BY e.departement
    `)) as unknown as { departement: string; filles: number; garcons: number }[];
    const calcule = parite.map((l) => ({
      departement: l.departement,
      indice: l.garcons > 0 ? Number((l.filles / l.garcons).toFixed(2)) : null,
      texte: `${l.filles} filles · ${l.garcons} garçons — indice ${l.garcons > 0 ? (l.filles / l.garcons).toFixed(2).replace(".", ",") : "—"}`,
    }));
    // Le palier mesure l'écart à la parité (1 fille pour 1 garçon).
    const ecarts = calcule.map((l) => (l.indice === null ? Number.POSITIVE_INFINITY : Math.abs(1 - l.indice)));
    const rangs = ecarts.map((e) => [...ecarts].sort((a, b) => a - b).indexOf(e));
    lignes = calcule.map((l, i) => ({
      nom: l.departement,
      valeurAffichee: l.texte,
      palier: l.indice === null ? null : Math.min(4, Math.floor((5 * rangs[i]) / Math.max(rangs.length, 1))),
    }));
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/ministere", label: "Espace ministère" }]}
        titre="Carte nationale"
        sousTitre="Douze départements, un coup d'œil. Chaque indicateur sort des mêmes instruments que le coach : la carte ne recalcule rien."
      />

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Indicateurs">
        {INDICATEURS.map((i) => (
          <Link
            key={i.cle}
            href={`/ministere/carte?indicateur=${i.cle}`}
            aria-current={i.cle === cle ? "true" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              i.cle === cle
                ? "bg-vert text-white hover:bg-vert-fonce"
                : "border border-ligne bg-white text-encre hover:bg-vert-clair hover:text-vert-fonce"
            }`}
          >
            {i.titre}
          </Link>
        ))}
      </nav>

      <section className="mt-6 grid gap-8 md:grid-cols-[320px_minmax(0,1fr)] md:items-start">
        <div className="rounded-2xl border border-ligne bg-white p-5">
          <CarteDepartements departements={lignes} />
          <LegendeCarte
            paliers={[
              { couleur: "#0e7a5f", texte: "favorable" },
              { couleur: "#27a97c", texte: "" },
              { couleur: "#e8c34a", texte: "moyen" },
              { couleur: "#e08a3c", texte: "" },
              { couleur: "#c94f43", texte: "en alerte" },
              { couleur: "#d8d5cd", texte: "sans donnée" },
            ]}
          />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            {INDICATEURS.find((i) => i.cle === cle)?.titre}
          </h2>
          <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {lignes.map((l) => (
              <li
                key={l.nom}
                className="flex items-center justify-between gap-2 rounded-xl border border-ligne bg-white px-3 py-2"
              >
                <span className="font-medium">{l.nom}</span>
                <span className="text-encre-doux">{l.valeurAffichee}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-encre-doux">
            Cliquez un département sur la carte pour ouvrir son détail
            dans les indicateurs nationaux.
          </p>
        </div>
      </section>
    </div>
  );
}
