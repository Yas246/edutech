import { sql } from "drizzle-orm";
import { db } from "@/db";

export type LigneDepartement = {
  departement: string;
  etablissements: number;
  eleves: number;
  tauxAbsenteisme: number | null;
  tauxRecouvrement: number | null;
};

/**
 * La nation, département par département. Les montants ne sortent
 * jamais : le recouvrement est un pourcentage global.
 */
export async function statistiquesParDepartement(): Promise<LigneDepartement[]> {
  const resultat = await db.execute(sql`
    SELECT
      d.departement,
      (SELECT count(*) FROM etablissements e
        WHERE e.departement = d.departement AND e.statut = 'valide') AS etablissements,
      (SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id
        JOIN etablissements e ON e.id = c.etablissement_id
        WHERE e.departement = d.departement) AS eleves,
      (SELECT round(100.0 * count(*) FILTER (WHERE p.statut = 'absent')
              / GREATEST(count(*), 1), 1)
        FROM presences p
        JOIN classes c ON c.id = p.classe_id
        JOIN etablissements e ON e.id = c.etablissement_id
        WHERE e.departement = d.departement) AS taux_absenteisme,
      (SELECT round(100.0 * COALESCE((
                SELECT sum(pai.montant) FROM paiements pai
                JOIN factures f ON f.id = pai.facture_id
                JOIN frais fr ON fr.id = f.frais_id
                JOIN etablissements e2 ON e2.id = fr.etablissement_id
                WHERE pai.annule = false AND e2.departement = d.departement
              ), 0) / GREATEST(COALESCE((
                SELECT sum(t.montant) FROM tranches t
                JOIN factures f ON f.id = t.facture_id
                JOIN frais fr ON fr.id = f.frais_id
                JOIN etablissements e2 ON e2.id = fr.etablissement_id
                WHERE e2.departement = d.departement
              ), 1), 1), 1)
        WHERE EXISTS (
          SELECT 1 FROM tranches t
          JOIN factures f ON f.id = t.facture_id
          JOIN frais fr ON fr.id = f.frais_id
          JOIN etablissements e2 ON e2.id = fr.etablissement_id
          WHERE e2.departement = d.departement)
      ) AS taux_recouvrement
    FROM (SELECT DISTINCT departement FROM etablissements WHERE departement <> '') d
    ORDER BY d.departement
  `);
  return resultat as unknown as LigneDepartement[];
}

export type LigneApprenant = {
  eleveId: number;
  classeId: number;
  prenom: string;
  nom: string;
  classe: string;
  etablissement: string;
  departement: string;
  moyenne: number | null;
  absences: number;
};

/**
 * La consultation des apprenants : filtres par département,
 * établissement et classe, avec des requêtes prêtes (moyenne >= 15,
 * élèves les plus absents). Lecture seule, jamais les finances.
 */
export async function consulterApprenants(filtres: {
  departement?: string;
  etablissementId?: number;
  classeId?: number;
  requete?: "moyenne15" | "absents";
}): Promise<LigneApprenant[]> {
  const conditions = [sql`true`];
  if (filtres.departement) {
    conditions.push(sql`e.departement = ${filtres.departement}`);
  }
  if (filtres.etablissementId) {
    conditions.push(sql`e.id = ${filtres.etablissementId}`);
  }
  if (filtres.classeId) {
    conditions.push(sql`c.id = ${filtres.classeId}`);
  }
  const where = sql.join(conditions, sql` AND `);

  const having =
    filtres.requete === "moyenne15"
      ? sql`HAVING AVG(CASE WHEN n.absent AND n.justifie THEN NULL WHEN n.absent THEN 0 ELSE n.valeur / ev.bareme * 20 END) >= 15`
      : filtres.requete === "absents"
        ? sql`HAVING count(*) FILTER (WHERE p.statut = 'absent') > 0`
        : sql``;

  const resultat = await db.execute(sql`
    SELECT
      u.id AS "eleveId",
      u.prenom,
      u.nom,
      c.id AS "classeId",
      c.nom AS classe,
      e.nom AS etablissement,
      e.departement,
      round(AVG(CASE WHEN n.absent AND n.justifie THEN NULL WHEN n.absent THEN 0 ELSE n.valeur / ev.bareme * 20 END)::numeric, 2) AS moyenne,
      count(*) FILTER (WHERE p.statut = 'absent') AS absences
    FROM users u
    JOIN inscriptions i ON i.eleve_user_id = u.id
    JOIN classes c ON c.id = i.classe_id
    JOIN etablissements e ON e.id = c.etablissement_id
    LEFT JOIN evaluations ev ON ev.classe_id = c.id
    LEFT JOIN notes n ON n.evaluation_id = ev.id AND n.eleve_user_id = u.id
    LEFT JOIN presences p ON p.eleve_user_id = u.id AND p.classe_id = c.id
    WHERE u.role = 'eleve' AND ${where}
    GROUP BY u.id, u.prenom, u.nom, c.id, c.nom, e.nom, e.departement
    ${having}
    ORDER BY moyenne DESC NULLS LAST, absences DESC
    LIMIT 100
  `);
  return resultat as unknown as LigneApprenant[];
}
