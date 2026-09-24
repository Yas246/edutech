import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  delegations,
  etablissements,
  factures,
  frais,
  inscriptions,
  paiements,
  periodes,
  tranches,
  users,
} from "@/db/schema";
import { libelleFrais } from "@/lib/finances";
import type { CompteOutil, Outil } from "./types";

/**
 * Les outils de la direction et de son délégué aux finances : tout est
 * borné à SON établissement. Le délégué finances accède aux finances ;
 * les autres délégations n'y touchent pas.
 */

export type EcoleDuCompte = { id: number; nom: string } | null;

/** L'établissement que le compte dirige, ou dont il est délégué. */
export async function etablissementDuCompte(
  compte: CompteOutil,
  rolesDelegation: string[] = ["finances"],
): Promise<EcoleDuCompte> {
  const [proprio] = await db
    .select({ id: etablissements.id, nom: etablissements.nom })
    .from(etablissements)
    .where(and(eq(etablissements.directionUserId, compte.id), eq(etablissements.statut, "valide")))
    .limit(1);
  if (proprio) return proprio;

  const [delegue] = await db
    .select({ id: delegations.etablissementId, nom: etablissements.nom })
    .from(delegations)
    .innerJoin(etablissements, eq(etablissements.id, delegations.etablissementId))
    .where(
      and(
        eq(delegations.userId, compte.id),
        inArray(delegations.role, rolesDelegation),
      ),
    )
    .limit(1);
  return delegue ?? null;
}

export type ResumeFinances = {
  etablissement: string;
  factures: number;
  montantFacture: number;
  montantPaye: number;
  tauxRecouvrement: number;
  facturesEnRetard: number;
};

/** Le résumé financier de l'établissement dirigé. */
export async function resumeFinances(compte: CompteOutil): Promise<ResumeFinances | null> {
  const ecole = await etablissementDuCompte(compte);
  if (!ecole) return null;

  const resultat = await db.execute(sql`
    SELECT
      count(DISTINCT f.id) AS factures,
      COALESCE(sum(t.montant), 0) AS attendu,
      (SELECT COALESCE(sum(p.montant), 0) FROM paiements p
        JOIN factures f2 ON f2.id = p.facture_id
        JOIN frais fr2 ON fr2.id = f2.frais_id
        WHERE p.annule = false AND fr2.etablissement_id = ${ecole.id}) AS paye,
      count(DISTINCT f.id) FILTER (WHERE EXISTS (
        SELECT 1 FROM tranches t2
        WHERE t2.facture_id = f.id AND t2.echeance < CURRENT_DATE
      )) AS echues
    FROM factures f
    JOIN frais fr ON fr.id = f.frais_id
    LEFT JOIN tranches t ON t.facture_id = f.id
    WHERE fr.etablissement_id = ${ecole.id}
  `);
  const [l] = resultat as unknown as {
    factures: string; attendu: string; paye: string; echues: string;
  }[];

  // Les factures réellement en retard : une échéance passée qui reste
  // non couverte (recalcul tranche par tranche, jamais stocké).
  const facturesEcole = await db
    .select({ id: factures.id })
    .from(factures)
    .innerJoin(frais, eq(frais.id, factures.fraisId))
    .where(eq(frais.etablissementId, ecole.id));
  let enRetard = 0;
  for (const f of facturesEcole) {
    const tranches_ = await db.select().from(tranches).where(eq(tranches.factureId, f.id));
    const payes = await db
      .select({ montant: paiements.montant })
      .from(paiements)
      .where(and(eq(paiements.factureId, f.id), eq(paiements.annule, false)));
    const paye = payes.reduce((a, p) => a + p.montant, 0);
    const total = tranches_.reduce((a, t) => a + t.montant, 0);
    if (paye >= total) continue;
    const aujourdhui = new Date().toISOString().slice(0, 10);
    if (tranches_.some((t) => t.echeance < aujourdhui)) enRetard += 1;
  }

  const attendu = Number(l.attendu);
  const paye = Number(l.paye);
  return {
    etablissement: ecole.nom,
    factures: Number(l.factures),
    montantFacture: attendu,
    montantPaye: paye,
    tauxRecouvrement: attendu > 0 ? Number(((100 * paye) / attendu).toFixed(1)) : 0,
    facturesEnRetard: enRetard,
  };
}

export type LigneRetard = {
  numero: string;
  eleve: string;
  frais: string;
  restant: number;
  echeance: string;
};

/** Les tranches échues et non couvertes de l'établissement. */
export async function listeRetards(compte: CompteOutil): Promise<LigneRetard[] | null> {
  const ecole = await etablissementDuCompte(compte);
  if (!ecole) return null;

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const lignes = await db
    .select({
      factureId: factures.id,
      numero: factures.numero,
      elevePrenom: users.prenom,
      eleveNom: users.nom,
      categorie: frais.categorie,
      libelle: frais.libelle,
      periodeNom: periodes.nom,
    })
    .from(factures)
    .innerJoin(frais, eq(frais.id, factures.fraisId))
    .innerJoin(users, eq(users.id, factures.eleveUserId))
    .leftJoin(periodes, eq(periodes.id, factures.periodeId))
    .where(eq(frais.etablissementId, ecole.id));

  const retards: LigneRetard[] = [];
  for (const l of lignes) {
    const tranches_ = await db.select().from(tranches).where(eq(tranches.factureId, l.factureId));
    const payes = await db
      .select({ montant: paiements.montant })
      .from(paiements)
      .where(and(eq(paiements.factureId, l.factureId), eq(paiements.annule, false)));
    let reste = payes.reduce((a, p) => a + p.montant, 0);
    let restantLePlusVieux: { montant: number; echeance: string } | null = null;
    for (const t of [...tranches_].sort((a, b) => a.ordre - b.ordre)) {
      const couvert = Math.min(Math.max(reste, 0), t.montant);
      reste -= couvert;
      const nonCouvert = t.montant - couvert;
      if (t.echeance < aujourdhui && nonCouvert > 0) {
        restantLePlusVieux = { montant: nonCouvert, echeance: t.echeance };
        break;
      }
    }
    if (restantLePlusVieux) {
      retards.push({
        numero: l.numero,
        eleve: `${l.elevePrenom} ${l.eleveNom}`,
        frais: libelleFrais({
          categorie: l.categorie,
          libelle: l.libelle,
          periodeNom: l.periodeNom,
        }),
        restant: restantLePlusVieux.montant,
        echeance: restantLePlusVieux.echeance,
      });
    }
  }
  return retards;
}

export type SituationClasse = {
  classe: string;
  effectifs: number;
  attendu: number;
  paye: number;
  elevesEnRetard: { eleve: string; restant: number }[];
};

/** La situation financière d'une classe de l'établissement. */
export async function situationClasse(
  compte: CompteOutil,
  classeId: number,
): Promise<SituationClasse | null> {
  const ecole = await etablissementDuCompte(compte);
  if (!ecole) return null;
  const [classe] = await db
    .select({ id: classes.id, nom: classes.nom })
    .from(classes)
    .where(and(eq(classes.id, classeId), eq(classes.etablissementId, ecole.id)))
    .limit(1);
  if (!classe) return null;

  const elevesDeLaClasse = await db
    .select({ id: inscriptions.eleveUserId })
    .from(inscriptions)
    .where(eq(inscriptions.classeId, classeId));
  const idsEleves = elevesDeLaClasse.map((e) => e.id);
  if (idsEleves.length === 0) {
    return { classe: classe.nom, effectifs: 0, attendu: 0, paye: 0, elevesEnRetard: [] };
  }

  const lignes = await db
    .select({ factureId: factures.id, eleveUserId: factures.eleveUserId })
    .from(factures)
    .innerJoin(frais, eq(frais.id, factures.fraisId))
    .where(
      and(
        eq(frais.etablissementId, ecole.id),
        inArray(factures.eleveUserId, idsEleves),
      ),
    );

  const parEleve = new Map<number, { attendu: number; paye: number; enRetard: number }>();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  for (const l of lignes) {
    const tranches_ = await db.select().from(tranches).where(eq(tranches.factureId, l.factureId));
    const payes = await db
      .select({ montant: paiements.montant })
      .from(paiements)
      .where(and(eq(paiements.factureId, l.factureId), eq(paiements.annule, false)));
    const total = tranches_.reduce((a, t) => a + t.montant, 0);
    const paye = payes.reduce((a, p) => a + p.montant, 0);
    const ligne = parEleve.get(l.eleveUserId) ?? { attendu: 0, paye: 0, enRetard: 0 };
    ligne.attendu += total;
    ligne.paye += paye;
    let reste = paye;
    for (const t of [...tranches_].sort((a, b) => a.ordre - b.ordre)) {
      const couvert = Math.min(Math.max(reste, 0), t.montant);
      reste -= couvert;
      if (t.echeance < aujourdhui && t.montant - couvert > 0) ligne.enRetard += t.montant - couvert;
    }
    parEleve.set(l.eleveUserId, ligne);
  }

  const noms = new Map<number, string>();
  if (parEleve.size > 0) {
    const comptes = await db
      .select({ id: users.id, prenom: users.prenom, nom: users.nom })
      .from(users)
      .where(inArray(users.id, [...parEleve.keys()]));
    for (const c of comptes) noms.set(c.id, `${c.prenom} ${c.nom}`);
  }

  const attendu = [...parEleve.values()].reduce((a, l) => a + l.attendu, 0);
  const paye = [...parEleve.values()].reduce((a, l) => a + l.paye, 0);
  return {
    classe: classe.nom,
    effectifs: parEleve.size,
    attendu,
    paye,
    elevesEnRetard: [...parEleve.entries()]
      .filter(([, l]) => l.enRetard > 0)
      .map(([id, l]) => ({ eleve: noms.get(id) ?? `#${id}`, restant: l.enRetard })),
  };
}

export type ApprenantRisque = {
  eleve: string;
  classe: string;
  moyenne: number | null;
  absences: number;
};

/** Les apprenants de l'établissement à suivre : moyenne basse ou absences répétées. */
export async function apprenantsARisque(
  compte: CompteOutil,
  seuil = 10,
): Promise<ApprenantRisque[] | null> {
  const ecole = await etablissementDuCompte(compte, ["finances", "vie_scolaire"]);
  if (!ecole) return null;

  const resultat = await db.execute(sql`
    SELECT u.prenom || ' ' || u.nom AS eleve,
      c.nom AS classe,
      round(AVG(CASE WHEN n.absent AND n.justifie THEN NULL WHEN n.absent THEN 0
                     ELSE n.valeur / ev.bareme * 20 END)::numeric, 2) AS moyenne,
      count(DISTINCT (p.classe_id, p.date)) FILTER (WHERE p.statut = 'absent') AS absences
    FROM users u
    JOIN inscriptions i ON i.eleve_user_id = u.id
    JOIN classes c ON c.id = i.classe_id
    LEFT JOIN evaluations ev ON ev.classe_id = c.id
    LEFT JOIN notes n ON n.evaluation_id = ev.id AND n.eleve_user_id = u.id
    LEFT JOIN presences p ON p.eleve_user_id = u.id AND p.classe_id = c.id
    WHERE c.etablissement_id = ${ecole.id}
    GROUP BY u.id, c.nom
    HAVING COALESCE(AVG(CASE WHEN n.absent AND n.justifie THEN NULL WHEN n.absent THEN 0
                             ELSE n.valeur / ev.bareme * 20 END), -1) < ${seuil}
        OR count(DISTINCT (p.classe_id, p.date)) FILTER (WHERE p.statut = 'absent') >= 3
    ORDER BY absences DESC, moyenne ASC NULLS LAST
    LIMIT 30
  `);
  return (
    resultat as unknown as { eleve: string; classe: string; moyenne: unknown; absences: unknown }[]
  ).map((l) => ({
    eleve: l.eleve,
    classe: l.classe,
    moyenne: l.moyenne === null || l.moyenne === undefined ? null : Number(l.moyenne),
    absences: Number(l.absences),
  }));
}

/** La réponse claire quand le compte ne dirige (ni ne délègue pour) aucune école. */
const SANS_ECOLE = {
  acces: "aucun_etablissement",
  message:
    "Ce compte ne dirige aucun établissement validé et n'a reçu aucune délégation correspondante.",
};

export const outilsDirection: Outil[] = [
  {
    nom: "resume_finances",
    description:
      "Le résumé financier de MON établissement : factures, montants facturés et encaissés, taux de recouvrement, factures en retard.",
    roles: ["direction", "enseignant"],
    parametres: [],
    executer: async (compte) => (await resumeFinances(compte)) ?? SANS_ECOLE,
  },
  {
    nom: "liste_retards",
    description:
      "Les tranches échues et non payées de MON établissement, élève par élève, avec le numéro de facture.",
    roles: ["direction", "enseignant"],
    parametres: [],
    executer: async (compte) => (await listeRetards(compte)) ?? SANS_ECOLE,
  },
  {
    nom: "situation_classe",
    description:
      "La situation financière d'une classe de MON établissement : attendu, encaissé, élèves en retard.",
    roles: ["direction", "enseignant"],
    parametres: [
      { nom: "classeId", description: "Identifiant de la classe.", type: "nombre", obligatoire: true },
    ],
    executer: async (compte, args) =>
      (await situationClasse(compte, Number(args.classeId))) ?? SANS_ECOLE,
  },
  {
    nom: "apprenants_a_risque",
    description:
      "Les apprenants de MON établissement à suivre de près : moyenne sous un seuil (10 par défaut) ou absences répétées.",
    roles: ["direction", "enseignant"],
    parametres: [
      { nom: "seuil", description: "Moyenne minimale attendue sur 20 (10 par défaut).", type: "nombre", obligatoire: false },
    ],
    executer: async (compte, args) =>
      (await apprenantsARisque(compte, args.seuil ? Number(args.seuil) : undefined)) ?? SANS_ECOLE,
  },
];
