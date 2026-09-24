import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  devoirs,
  evenements,
  factures,
  frais,
  inscriptions,
  liensFamille,
  matieres,
  paiements,
  periodes,
  tranches,
  users,
} from "@/db/schema";
import { exiger } from "@/lib/auth";
import { casesDuMois, lireMois, type EntreeCalendrier } from "@/lib/calendrier";
import { EnTetePage } from "@/components/ui/en-tete";

export const metadata: Metadata = { title: "Calendrier" };

const joursCourts = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function jourAffiche(iso: string) {
  return Number(iso.slice(8, 10));
}

export default async function Calendrier({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>;
}) {
  const utilisateur = await exiger("parent", "eleve");
  const mois = lireMois((await searchParams).mois);

  const entrees: EntreeCalendrier[] = [];

  if (utilisateur.role === "eleve") {
    // L'élève : les devoirs de sa classe et les événements de son école.
    const [inscription] = await db
      .select({ classeId: inscriptions.classeId })
      .from(inscriptions)
      .where(eq(inscriptions.eleveUserId, utilisateur.id))
      .limit(1);

    if (inscription) {
      const [classe] = await db
        .select({ etablissementId: classes.etablissementId, nom: classes.nom })
        .from(classes)
        .where(eq(classes.id, inscription.classeId))
        .limit(1);

      const mesDevoirs = await db
        .select({
          titre: devoirs.titre,
          aRendreLe: devoirs.aRendreLe,
          matiere: matieres.nom,
        })
        .from(devoirs)
        .innerJoin(matieres, eq(matieres.id, devoirs.matiereId))
        .where(eq(devoirs.classeId, inscription.classeId));
      for (const d of mesDevoirs.filter((d) => d.aRendreLe.startsWith(mois.cle))) {
        entrees.push({
          date: d.aRendreLe,
          titre: `${d.matiere} : ${d.titre}`,
          type: "devoir",
          detail: "Devoir à rendre",
        });
      }

      if (classe) {
        // Les événements de l'école : portée établissement OU sa classe.
        const evenementsFiltres = await db
          .select({
            titre: evenements.titre,
            date: evenements.date,
            description: evenements.description,
            classeId: evenements.classeId,
          })
          .from(evenements)
          .where(eq(evenements.etablissementId, classe.etablissementId));
        for (const e of evenementsFiltres) {
          if (!e.date.startsWith(mois.cle)) continue;
          if (e.classeId && e.classeId !== inscription.classeId) continue;
          entrees.push({
            date: e.date,
            titre: e.titre,
            type: "evenement",
            detail: e.description || "Événement de l'école",
          });
        }
      }
    }
  } else {
    // Le parent : les devoirs de chaque enfant, les échéances non
    // couvertes, les événements des écoles de ses enfants.
    const enfants = await db
      .select({ id: users.id, prenom: users.prenom, nom: users.nom })
      .from(liensFamille)
      .innerJoin(users, eq(users.id, liensFamille.eleveUserId))
      .where(eq(liensFamille.parentUserId, utilisateur.id));
    const idsEnfants = enfants.map((e) => e.id);

    const inscriptionsEnfants = idsEnfants.length
      ? await db
          .select({
            eleveUserId: inscriptions.eleveUserId,
            classeId: classes.id,
            classeNom: classes.nom,
            etablissementId: classes.etablissementId,
          })
          .from(inscriptions)
          .innerJoin(classes, eq(classes.id, inscriptions.classeId))
          .where(inArray(inscriptions.eleveUserId, idsEnfants))
      : [];

    for (const inscription of inscriptionsEnfants) {
      const enfant = enfants.find((e) => e.id === inscription.eleveUserId);
      const prenom = enfant?.prenom ?? "Votre enfant";

      const devoirsEnfant = await db
        .select({
          titre: devoirs.titre,
          aRendreLe: devoirs.aRendreLe,
          matiere: matieres.nom,
        })
        .from(devoirs)
        .innerJoin(matieres, eq(matieres.id, devoirs.matiereId))
        .where(eq(devoirs.classeId, inscription.classeId));
      for (const d of devoirsEnfant.filter((d) => d.aRendreLe.startsWith(mois.cle))) {
        entrees.push({
          date: d.aRendreLe,
          titre: `${prenom} — ${d.matiere} : ${d.titre}`,
          type: "devoir",
          detail: `Devoir à rendre (${inscription.classeNom})`,
        });
      }
    }

    // Les échéances des factures des enfants, couverture recalculée.
    if (idsEnfants.length) {
      const lignesFactures = await db
        .select({
          id: factures.id,
          eleveUserId: factures.eleveUserId,
          categorie: frais.categorie,
          libelle: frais.libelle,
          periodeNom: periodes.nom,
        })
        .from(factures)
        .innerJoin(frais, eq(frais.id, factures.fraisId))
        .leftJoin(periodes, eq(periodes.id, factures.periodeId))
        .where(inArray(factures.eleveUserId, idsEnfants));

      const { libelleFrais } = await import("@/lib/finances");

      for (const f of lignesFactures) {
        const ts = await db
          .select()
          .from(tranches)
          .where(eq(tranches.factureId, f.id))
          .orderBy(asc(tranches.ordre));
        const paiementsFaits = await db
          .select({ montant: paiements.montant, annule: paiements.annule })
          .from(paiements)
          .where(eq(paiements.factureId, f.id));
        const paye = paiementsFaits.filter((p) => !p.annule).reduce((a, p) => a + p.montant, 0);
        let reste = paye;
        for (const t of ts) {
          const couvert = Math.min(reste, t.montant);
          reste -= couvert;
          if (couvert >= t.montant) continue;
          if (!t.echeance.startsWith(mois.cle)) continue;
          const enfant = enfants.find((e) => e.id === f.eleveUserId);
          entrees.push({
            date: t.echeance,
            titre: `${enfant?.prenom ?? "Enfant"} — ${libelleFrais({ categorie: f.categorie, libelle: f.libelle, periodeNom: f.periodeNom })}, tranche ${t.ordre}`,
            type: "echeance",
            detail: `À payer : ${t.montant.toLocaleString("fr-FR")} F CFA`,
          });
        }
      }

      const ecoles = [...new Set(inscriptionsEnfants.map((i) => i.etablissementId))];
      if (ecoles.length) {
        const evenementsFamilles = await db
          .select({
            titre: evenements.titre,
            date: evenements.date,
            description: evenements.description,
            classeId: evenements.classeId,
          })
          .from(evenements)
          .where(inArray(evenements.etablissementId, ecoles));
        const classesEnfants = new Set(inscriptionsEnfants.map((i) => i.classeId));
        for (const e of evenementsFamilles) {
          if (!e.date.startsWith(mois.cle)) continue;
          if (e.classeId && !classesEnfants.has(e.classeId)) continue;
          entrees.push({
            date: e.date,
            titre: e.titre,
            type: "evenement",
            detail: e.description || "Événement de l'école",
          });
        }
      }
    }
  }

  const cases = casesDuMois(mois);
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <EnTetePage
        titre="Calendrier"
        sousTitre={
          utilisateur.role === "parent"
            ? "Les devoirs de vos enfants, les échéances de paiement et les événements de leurs écoles."
            : "Vos devoirs à rendre et les événements de votre école."
        }
        actions={
          <nav className="flex items-center gap-2 text-sm" aria-label="Navigation des mois">
            <Link
              href={`/calendrier?mois=${mois.precedent}`}
              className="rounded-xl border border-ligne bg-white px-3 py-2 font-medium hover:bg-papier"
            >
              Mois précédent
            </Link>
            <span className="min-w-40 text-center text-lg font-semibold capitalize">
              {mois.titre}
            </span>
            <Link
              href={`/calendrier?mois=${mois.suivant}`}
              className="rounded-xl border border-ligne bg-white px-3 py-2 font-medium hover:bg-papier"
            >
              Mois suivant
            </Link>
          </nav>
        }
      />

      <table className="mt-8 w-full border-collapse text-sm">
        <caption className="sr-only">Calendrier de {mois.titre}</caption>
        <thead>
          <tr>
            {joursCourts.map((j) => (
              <th key={j} scope="col" className="border border-ligne bg-vert-clair px-2 py-2 text-vert-fonce">
                {j}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cases.length / 7 }, (_, semaine) => (
            <tr key={semaine}>
              {cases.slice(semaine * 7, semaine * 7 + 7).map((date, index) => (
                <td
                  key={index}
                  className={`h-28 w-1/7 border border-ligne align-top ${
                    date ? "bg-white" : "bg-papier"
                  }`}
                >
                  {date && (
                    <div className="p-1.5">
                      <p
                        className={`text-xs font-semibold ${
                          date === aujourdhui
                            ? "rounded-full bg-vert px-1.5 py-0.5 text-white"
                            : "text-encre-doux"
                        }`}
                      >
                        {jourAffiche(date)}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {entrees
                          .filter((e) => e.date === date)
                          .map((e, i) => (
                            <li
                              key={i}
                              className={`rounded-lg px-1.5 py-1 text-[11px] leading-tight ${
                                e.type === "echeance"
                                  ? "bg-rouge-clair text-rouge"
                                  : e.type === "devoir"
                                    ? "bg-jaune-clair text-encre"
                                    : "bg-vert-clair text-vert-fonce"
                              }`}
                            >
                              <span className="font-semibold">{e.titre}</span>
                              {e.detail && <span className="block opacity-80">{e.detail}</span>}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 flex flex-wrap gap-4 text-xs text-encre-doux">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-jaune-clair" /> Devoirs
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-rouge-clair" /> Échéances de paiement
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-vert-clair" /> Événements de l&apos;école
        </span>
      </p>
    </div>
  );
}
