import "dotenv/config";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  classes,
  evaluations,
  inscriptions,
  matieres,
  notes,
  presences,
  presencesEnseignants,
  users,
} from "../src/db/schema";
import { executerOutil, outils } from "../src/lib/outils/registry";
import type { CompteOutil } from "../src/lib/outils/types";

/**
 * Le contrôle direct des outils, sans modèle : chaque outil est exécuté
 * pour chacun des six comptes de démonstration. Les refus hors périmètre
 * sont vérifiés partout, l'absence de montant dans ce que voient le
 * ministère et l'élève, et chaque chiffre renvoyé est confronté à une
 * vérité recalculée indépendamment (requêtes directes sur la base).
 * VERT avant de brancher le coach.
 */

let verifications = 0;
let echecs: string[] = [];

function verifier(label: string, condition: boolean, detail?: string) {
  verifications += 1;
  if (!condition) echecs.push(detail ? `${label} — ${detail}` : label);
}

/** Un nombre SQL (numeric/count) en nombre JavaScript. */
function nombre(v: unknown): number {
  return Number(v ?? 0);
}

/** Parcourt un résultat : aucun montant ne doit fuiter ici. */
function fuiteMontant(donnees: unknown): string | null {
  const vus = new Set<string>();
  (function parcourir(noeud: unknown, chemin: string) {
    if (Array.isArray(noeud)) {
      noeud.forEach((n, i) => parcourir(n, `${chemin}[${i}]`));
      return;
    }
    if (noeud && typeof noeud === "object") {
      for (const [cle, valeur] of Object.entries(noeud as Record<string, unknown>)) {
        if (/montant|paye|restant|recu/i.test(cle) && typeof valeur === "number") {
          vus.add(`${chemin}.${cle}`);
        }
        parcourir(valeur, `${chemin}.${cle}`);
      }
    }
  })(donnees, "");
  return vus.size > 0 ? [...vus].join(", ") : null;
}

async function compte(email: string): Promise<CompteOutil> {
  const [u] = await db
    .select({
      id: users.id,
      role: users.role,
      prenom: users.prenom,
      nom: users.nom,
      interets: users.interets,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u) throw new Error(`Compte introuvable : ${email}`);
  return { ...u, role: u.role as CompteOutil["role"] };
}

/** La moyenne d'un élève, règle des bulletins, calculée indépendamment. */
async function moyenneIndividuelle(idEleve: number): Promise<number | null> {
  const [ligne] = await db
    .select({
      moyenne: sql<string | null>`round(AVG(CASE WHEN n.absent AND n.justifie THEN NULL
        WHEN n.absent THEN 0 ELSE n.valeur / e.bareme * 20 END)::numeric, 2)`,
    })
    .from(sql`notes n JOIN evaluations e ON e.id = n.evaluation_id`)
    .where(sql`n.eleve_user_id = ${idEleve}`);
  return ligne?.moyenne === null || ligne?.moyenne === undefined
    ? null
    : Number(ligne.moyenne);
}

async function principal() {
  const ministere = await compte("ministere.test@edutech.bj");
  const direction = await compte("admin-etab.test@edutech.bj");
  const profFinances = await compte("prof.test@edutech.bj"); // délégué finances
  const profVieScolaire = await compte("prof2.test@edutech.bj"); // délégué vie scolaire
  const parent = await compte("parent.test@edutech.bj");
  const eleve = await compte("eleve.test@edutech.bj");

  const [tleD] = await db
    .select({ id: classes.id, etablissementId: classes.etablissementId })
    .from(classes)
    .where(and(eq(classes.etablissementId, 263), eq(classes.nom, "Terminale D")))
    .limit(1);
  const idEcole = tleD.etablissementId;

  const [interro2] = await db
    .select({ id: evaluations.id })
    .from(evaluations)
    .innerJoin(matieres, eq(matieres.id, evaluations.matiereId))
    .where(and(eq(evaluations.titre, "Interrogation n°2"), eq(matieres.nom, "Mathématiques")))
    .limit(1);

  const argumentsParOutil: Record<string, Record<string, string | number>> = {
    profil_ecole: { etablissementId: idEcole },
    chercher_etablissement: { terme: "Béhanzin" },
    situation_classe: { classeId: tleD.id },
    notes_manquantes: { evaluationId: interro2.id },
  };

  const comptes = [
    ["ministère", ministere],
    ["direction", direction],
    ["prof délégué finances", profFinances],
    ["prof délégué vie scolaire", profVieScolaire],
    ["parent", parent],
    ["élève", eleve],
  ] as const;

  // 1. La matrice complète : 6 comptes x tous les outils.
  for (const [nomCompte, c] of comptes) {
    for (const outil of outils) {
      const resultat = await executerOutil(
        outil.nom,
        c,
        argumentsParOutil[outil.nom] ?? {},
      );
      if (!resultat.ok) {
        verifier(
          `${nomCompte}/${outil.nom} refus légitime`,
          !outil.roles.includes(c.role),
          `refus inattendu : ${resultat.refus}`,
        );
        continue;
      }
      if (c.role === "ministere" || c.role === "eleve") {
        const fuite = fuiteMontant(resultat.donnees);
        verifier(`${nomCompte}/${outil.nom} sans montant`, fuite === null, fuite ?? "");
      }
    }
  }
  console.log(`Matrice exécutée : ${comptes.length * outils.length} appels.`);

  // ------------------------------------------------------------------
  // 2. Vérités terrain, recalculées indépendamment des outils.
  // ------------------------------------------------------------------

  // Effectifs et classes de l'école de démonstration.
  const [compteEcole] = await db
    .select({
      classesN: sql<number>`(SELECT count(*) FROM classes WHERE etablissement_id = ${idEcole})`,
      effectifs: sql<number>`(SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id WHERE c.etablissement_id = ${idEcole})`,
      filles: sql<number>`(SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id JOIN users u ON u.id = i.eleve_user_id
        WHERE c.etablissement_id = ${idEcole} AND u.sexe = 'F')`,
      garcons: sql<number>`(SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id JOIN users u ON u.id = i.eleve_user_id
        WHERE c.etablissement_id = ${idEcole} AND u.sexe = 'M')`,
    })
    .from(sql`(SELECT 1) t`);

  // Moyennes par élève de l'école (règle des bulletins).
  const moyennes = (await db.execute(sql`
    SELECT u.prenom || ' ' || u.nom AS eleve,
      round(AVG(CASE WHEN n.absent AND n.justifie THEN NULL WHEN n.absent THEN 0
                     ELSE n.valeur / e.bareme * 20 END)::numeric, 2) AS moyenne
    FROM users u
    JOIN inscriptions i ON i.eleve_user_id = u.id
    JOIN classes c ON c.id = i.classe_id
    LEFT JOIN evaluations e ON e.classe_id = c.id
    LEFT JOIN notes n ON n.evaluation_id = e.id AND n.eleve_user_id = u.id
    WHERE c.etablissement_id = ${idEcole}
    GROUP BY u.id
    HAVING AVG(CASE WHEN n.absent AND n.justifie THEN NULL WHEN n.absent THEN 0
               ELSE n.valeur / e.bareme * 20 END) IS NOT NULL
    ORDER BY 2 DESC
  `)) as unknown as { eleve: string; moyenne: string }[];
  const listeMoyennes = moyennes.map((m) => ({ eleve: m.eleve, moyenne: Number(m.moyenne) }));
  const moyenneEcole = listeMoyennes.length
    ? Number(
        (
          listeMoyennes.reduce((a, m) => a + m.moyenne, 0) / listeMoyennes.length
        ).toFixed(2),
      )
    : null;

  // Assiduité des enseignants de l'école sur trente jours.
  const pointages = (await db.execute(sql`
    SELECT statut, count(*) AS n FROM presences_enseignants
    WHERE etablissement_id = ${idEcole} AND date >= CURRENT_DATE - 30
    GROUP BY statut
  `)) as unknown as { statut: string; n: string }[];
  const pointagesParStatut = Object.fromEntries(
    pointages.map((p) => [p.statut, Number(p.n)]),
  );
  const totalPointages = pointages.reduce((a, p) => a + Number(p.n), 0);
  const presentsPointages = pointagesParStatut["present"] ?? 0;
  const tauxAssiduite = totalPointages
    ? Number(((100 * presentsPointages) / totalPointages).toFixed(1))
    : null;

  // Ratio élèves/enseignant de l'Ouémé.
  const [ratioOueme] = await db
    .select({
      eleves: sql<number>`(SELECT count(*) FROM inscriptions i
        JOIN classes c ON c.id = i.classe_id
        JOIN etablissements e ON e.id = c.etablissement_id
        WHERE e.departement = 'Ouémé')`,
      enseignants: sql<number>`(SELECT count(DISTINCT en.enseignant_user_id) FROM enseignements en
        JOIN classes c ON c.id = en.classe_id
        JOIN etablissements e ON e.id = c.etablissement_id
        WHERE e.departement = 'Ouémé')`,
    })
    .from(sql`(SELECT 1) t`);
  const ratioAttendu = ratioOueme.enseignants > 0
    ? Number((nombre(ratioOueme.eleves) / nombre(ratioOueme.enseignants)).toFixed(1))
    : null;

  // Absences de Kossi, comptées directement.
  const [kossiDirect] = await db
    .select({ n: sql<number>`count(*)` })
    .from(presences)
    .innerJoin(users, eq(users.id, presences.eleveUserId))
    .where(and(eq(users.prenom, "Kossi"), eq(presences.statut, "absent")));

  // Le meilleur élève attendu et les apprenants au-dessus de 15.
  const meilleur = listeMoyennes[0] ?? null;
  const excellentsAttendus = listeMoyennes.filter((m) => m.moyenne >= 15);

  // ------------------------------------------------------------------
  // 3. Les outils ministère, confrontés à ces vérités.
  // ------------------------------------------------------------------
  const recherche = (await executerOutil("chercher_etablissement", ministere, {
    terme: "Béhanzin",
  })) as { ok: boolean; donnees?: { id: number; nom: string }[] };
  verifier(
    "chercher_etablissement trouve le Lycée Béhanzin",
    recherche.ok && (recherche.donnees ?? []).some((e) => e.nom === "Lycée Béhanzin"),
  );

  const profil = (await executerOutil("profil_ecole", ministere, {
    etablissementId: idEcole,
  })) as { ok: boolean; donnees?: Record<string, unknown> };
  const p = profil.donnees as
    | {
        effectifs: number;
        classes: number;
        filles: number;
        garcons: number;
        moyenneGenerale: number | null;
        meilleurEleve: { nom: string; moyenne: number } | null;
        tauxAssiduiteEnseignants: number | null;
      }
    | undefined;
  verifier(
    "profil_ecole effectifs conformes",
    p?.effectifs === nombre(compteEcole.effectifs),
    `outil ${p?.effectifs} vs base ${nombre(compteEcole.effectifs)}`,
  );
  verifier(
    "profil_ecole classes conformes",
    p?.classes === nombre(compteEcole.classesN),
    `outil ${p?.classes} vs base ${nombre(compteEcole.classesN)}`,
  );
  verifier(
    "profil_ecole parité conforme",
    p?.filles === nombre(compteEcole.filles) && p?.garcons === nombre(compteEcole.garcons),
  );
  verifier(
    "profil_ecole moyenne générale conforme",
    p?.moyenneGenerale === moyenneEcole,
    `outil ${p?.moyenneGenerale} vs base ${moyenneEcole}`,
  );
  verifier(
    "profil_ecole meilleur élève conforme",
    meilleur !== null &&
      p?.meilleurEleve?.nom === meilleur.eleve.split(" ").pop() &&
      p?.meilleurEleve?.moyenne === meilleur.moyenne,
    `outil ${JSON.stringify(p?.meilleurEleve)} vs base ${JSON.stringify(meilleur)}`,
  );
  verifier(
    "profil_ecole assiduité enseignants conforme",
    p?.tauxAssiduiteEnseignants === tauxAssiduite,
    `outil ${p?.tauxAssiduiteEnseignants} vs base ${tauxAssiduite}`,
  );

  const niv = (await executerOutil("effectifs_par_niveau", ministere, {})) as {
    ok: boolean; donnees?: { niveau: string; effectifs: number }[];
  };
  const [terminaleDirect] = await db
    .select({ n: sql<number>`count(*)` })
    .from(inscriptions)
    .innerJoin(classes, eq(classes.id, inscriptions.classeId))
    .where(eq(classes.niveau, "Terminale"));
  const terminaleOutil = (niv.donnees ?? []).find((l) => l.niveau === "Terminale");
  verifier(
    "effectifs_par_niveau Terminale conforme",
    terminaleOutil?.effectifs === nombre(terminaleDirect.n),
    `outil ${terminaleOutil?.effectifs} vs base ${nombre(terminaleDirect.n)}`,
  );

  const ratio = (await executerOutil("ratio_eleves_enseignant", ministere, {})) as {
    ok: boolean; donnees?: { perimetre: string; ratio: number | null }[];
  };
  const ouemeOutil = (ratio.donnees ?? []).find((l) => l.perimetre === "Ouémé");
  verifier(
    "ratio élèves/enseignant Ouémé conforme",
    ouemeOutil?.ratio === ratioAttendu,
    `outil ${ouemeOutil?.ratio} vs base ${ratioAttendu}`,
  );

  const parite = (await executerOutil("parite_genre", ministere, {})) as {
    ok: boolean; donnees?: { filles: number; garcons: number; indiceParite: number };
  };
  // Vérité nationale : chaque apprenant compte UNE fois, même s'il est
  // inscrit dans deux établissements (élève transféré).
  const [pariteDirect] = await db
    .select({
      filles: sql<number>`count(DISTINCT id) FILTER (WHERE sexe = 'F')`,
      garcons: sql<number>`count(DISTINCT id) FILTER (WHERE sexe = 'M')`,
    })
    .from(users)
    .where(eq(users.role, "eleve"));
  const indiceDirect = nombre(pariteDirect.garcons) > 0
    ? Number((nombre(pariteDirect.filles) / nombre(pariteDirect.garcons)).toFixed(2))
    : null;
  verifier(
    "parité nationale conforme (apprenants comptés une fois)",
    parite.donnees?.filles === nombre(pariteDirect.filles) &&
      parite.donnees?.garcons === nombre(pariteDirect.garcons) &&
      parite.donnees?.indiceParite === indiceDirect,
    `outil ${JSON.stringify(parite.donnees)} vs base ${nombre(pariteDirect.filles)}/${nombre(pariteDirect.garcons)}`,
  );

  const assiduite = (await executerOutil("assiduite_enseignants", ministere, {})) as {
    ok: boolean; donnees?: { tauxGlobal: number | null; parEnseignant: unknown[] };
  };
  verifier(
    "assiduité enseignants conforme",
    assiduite.donnees?.tauxGlobal === tauxAssiduite &&
      assiduite.donnees?.parEnseignant.length === 3,
    `outil ${assiduite.donnees?.tauxGlobal} vs base ${tauxAssiduite}`,
  );

  const sansBulletin = (await executerOutil("classes_sans_bulletin", ministere, {})) as {
    ok: boolean; donnees?: { classe: string }[];
  };
  const publications = await db.execute(sql`
    SELECT c.nom FROM classes c
    WHERE EXISTS (SELECT 1 FROM publications_bulletins pb WHERE pb.classe_id = c.id)
  `);
  const publiees = (publications as unknown as { nom: string }[]).map((l) => l.nom);
  for (const nomPubliee of publiees) {
    verifier(
      `classes_sans_bulletin exclut ${nomPubliee} (publiée)`,
      !(sansBulletin.donnees ?? []).some((l) => l.classe === nomPubliee),
    );
  }
  verifier(
    "classes_sans_bulletin liste au moins la classe de démonstration non publiée",
    (sansBulletin.donnees ?? []).some((l) => l.classe === "Seconde A"),
  );

  const excellents = (await executerOutil("apprenants_excellents", ministere, {})) as {
    ok: boolean; donnees?: { nom: string; moyenne: number }[];
  };
  verifier(
    "excellents conforme au recalcul indépendant",
    (excellents.donnees ?? []).length === excellentsAttendus.length &&
      excellentsAttendus.every((m) =>
        (excellents.donnees ?? []).some((l) => l.nom === m.eleve.split(" ").pop()),
      ),
    `outil ${JSON.stringify((excellents.donnees ?? []).map((l) => l.nom))} vs base ${JSON.stringify(excellentsAttendus.map((m) => m.eleve))}`,
  );

  const absenteisme = (await executerOutil("apprenants_absenteisme", ministere, {})) as {
    ok: boolean; donnees?: { nom: string; absences: number }[];
  };
  const kossiOutil = (absenteisme.donnees ?? []).find((l) => l.nom === "Amoussou");
  verifier(
    "absentéisme : comptage de Kossi conforme",
    kossiOutil?.absences === nombre(kossiDirect.n),
    `outil ${kossiOutil?.absences} vs base ${nombre(kossiDirect.n)}`,
  );

  // ------------------------------------------------------------------
  // 4. Direction et délégations.
  // ------------------------------------------------------------------
  const [facturesEcole] = await db
    .select({ n: sql<number>`count(DISTINCT f.id)` })
    .from(sql`factures f JOIN frais fr ON fr.id = f.frais_id`)
    .where(sql`fr.etablissement_id = ${idEcole}`);

  const resume = (await executerOutil("resume_finances", direction, {})) as {
    ok: boolean; donnees?: Record<string, unknown>;
  };
  verifier(
    "resume_finances : nombre de factures conforme",
    resume.donnees?.factures === nombre(facturesEcole.n),
    `outil ${resume.donnees?.factures} vs base ${nombre(facturesEcole.n)}`,
  );

  const sansEcoleProf2 = (await executerOutil("resume_finances", profVieScolaire, {})) as {
    ok: boolean; donnees?: { acces?: string };
  };
  verifier(
    "vie scolaire sans délégation finances : pas de résumé financier",
    sansEcoleProf2.donnees?.acces === "aucun_etablissement",
  );

  const risqueLia = (await executerOutil("apprenants_a_risque", profVieScolaire, {})) as {
    ok: boolean; donnees?: { eleve: string }[];
  };
  verifier(
    "vie scolaire (délégation) voit les élèves à risque",
    (risqueLia.donnees ?? []).length > 0,
  );

  const retards = (await executerOutil("liste_retards", profFinances, {})) as {
    ok: boolean; donnees?: unknown[];
  };
  verifier(
    "délégué finances liste les retards (tableau)",
    retards.ok && Array.isArray(retards.donnees),
  );

  const situation = (await executerOutil("situation_classe", direction, {
    classeId: tleD.id,
  })) as { ok: boolean; donnees?: { classe: string; effectifs: number } };
  const [effectifsTleD] = await db
    .select({ n: sql<number>`count(*)` })
    .from(inscriptions)
    .where(eq(inscriptions.classeId, tleD.id));
  verifier(
    "situation_classe : classe et effectifs conformes",
    situation.donnees?.classe === "Terminale D" &&
      situation.donnees?.effectifs === nombre(effectifsTleD.n),
  );

  const situationHorsEcole = (await executerOutil("situation_classe", profFinances, {
    classeId: 99999,
  })) as { ok: boolean; donnees?: { acces?: string } };
  verifier(
    "classe hors établissement refusée",
    situationHorsEcole.donnees?.acces === "aucun_etablissement" ||
      situationHorsEcole.ok === false,
  );

  // ------------------------------------------------------------------
  // 5. Enseignant.
  // ------------------------------------------------------------------
  const mesClassesAime = (await executerOutil("mes_classes", profFinances, {})) as {
    ok: boolean; donnees?: { id: number; nom: string; matieres: string[]; effectifs: number }[];
  };
  const tleAime = (mesClassesAime.donnees ?? []).find((c) => c.nom === "Terminale D");
  verifier(
    "mes_classes (Aimé) : Terminale D et maths",
    tleAime?.matieres.includes("Mathématiques") === true,
  );
  if (tleAime) {
    const [effectifsDirect] = await db
      .select({ n: sql<number>`count(*)` })
      .from(inscriptions)
      .where(eq(inscriptions.classeId, tleAime.id));
    verifier(
      "mes_classes : effectifs conformes",
      tleAime.effectifs === nombre(effectifsDirect.n),
      `outil ${tleAime.effectifs} vs base ${nombre(effectifsDirect.n)}`,
    );
  }

  async function verifierAssiduite(c: CompteOutil, label: string) {
    const detail = (await db
      .select({
        presents: sql<number>`count(*) FILTER (WHERE statut = 'present')`,
        retards: sql<number>`count(*) FILTER (WHERE statut = 'retard')`,
        absents: sql<number>`count(*) FILTER (WHERE statut = 'absent')`,
      })
      .from(presencesEnseignants)
      .where(
        and(
          eq(presencesEnseignants.enseignantUserId, c.id),
          sql`${presencesEnseignants.date} >= CURRENT_DATE - 30`,
        ),
      ))[0];
    const outil = (await executerOutil("mon_assiduite", c, {})) as {
      ok: boolean;
      donnees?: { presents: number; retards: number; absents: number; taux: number | null };
    };
    const total =
      nombre(detail.presents) + nombre(detail.retards) + nombre(detail.absents);
    const taux = total
      ? Number(((100 * nombre(detail.presents)) / total).toFixed(1))
      : null;
    verifier(
      `mon_assiduite (${label}) conforme`,
      outil.donnees?.presents === nombre(detail.presents) &&
        outil.donnees?.retards === nombre(detail.retards) &&
        outil.donnees?.absents === nombre(detail.absents) &&
        outil.donnees?.taux === taux,
      `outil ${JSON.stringify(outil.donnees)} vs base ${JSON.stringify(detail)}`,
    );
  }
  await verifierAssiduite(profFinances, "Aimé");
  await verifierAssiduite(profVieScolaire, "Léa");

  const absencesClasse = (await executerOutil("absences_recentes", profFinances, {})) as {
    ok: boolean; donnees?: { eleve: string }[];
  };
  verifier(
    "absences_recentes mentionne Kossi",
    (absencesClasse.donnees ?? []).some((l) => l.eleve === "Kossi Amoussou"),
  );

  const manquantes = (await executerOutil("notes_manquantes", profFinances, {
    evaluationId: interro2.id,
  })) as { ok: boolean; donnees?: { attendus: number; saisis: number } };
  const [attendusDirect] = await db
    .select({ n: sql<number>`count(*)` })
    .from(inscriptions)
    .where(eq(inscriptions.classeId, tleD.id));
  const [saisisDirect] = await db
    .select({ n: sql<number>`count(*)` })
    .from(notes)
    .where(eq(notes.evaluationId, interro2.id));
  verifier(
    "notes_manquantes : effectifs et saisies conformes",
    manquantes.donnees?.attendus === nombre(attendusDirect.n) &&
      manquantes.donnees?.saisis === nombre(saisisDirect.n),
    `outil ${JSON.stringify(manquantes.donnees)} vs base ${nombre(saisisDirect.n)}/${nombre(attendusDirect.n)}`,
  );

  // ------------------------------------------------------------------
  // 6. Famille.
  // ------------------------------------------------------------------
  const enfantsParent = await db
    .select({ eleveUserId: sql<number>`eleve_user_id` })
    .from(sql`liens_famille`)
    .where(sql`parent_user_id = ${parent.id}`);
  const situationEnfants = (await executerOutil("situation_enfant", parent, {})) as {
    ok: boolean; donnees?: { enfant: string; moyenne: number | null }[];
  };
  verifier(
    "parent : autant d'enfants que de liens famille",
    situationEnfants.donnees?.length === enfantsParent.length,
    `outil ${situationEnfants.donnees?.length} vs base ${enfantsParent.length}`,
  );
  if (situationEnfants.donnees?.length && enfantsParent.length > 0) {
    const moyenneAwa = await moyenneIndividuelle(eleve.id);
    const awaSit = situationEnfants.donnees.find((s) => s.enfant === "Awa Dossa");
    verifier(
      "parent : moyenne d'Awa conforme à la règle des bulletins",
      awaSit?.moyenne === moyenneAwa,
      `outil ${awaSit?.moyenne} vs base ${moyenneAwa}`,
    );
  }

  const echeances = (await executerOutil("prochaines_echeances", parent, {})) as {
    ok: boolean; donnees?: unknown[];
  };
  verifier("parent : échéances lisibles (tableau)", Array.isArray(echeances.donnees));

  const refusEleveMontant = await executerOutil("prochaines_echeances", eleve, {});
  verifier(
    "élève : les échéances financières lui sont refusées",
    !refusEleveMontant.ok && refusEleveMontant.refus.includes("Parent"),
  );

  const mesNotesAwa = (await executerOutil("mes_notes", eleve, {})) as {
    ok: boolean; donnees?: unknown[];
  };
  const [notesAwa] = await db
    .select({ n: sql<number>`count(*)` })
    .from(notes)
    .where(eq(notes.eleveUserId, eleve.id));
  verifier(
    "élève : autant de notes que saisies",
    mesNotesAwa.donnees?.length === nombre(notesAwa.n),
    `outil ${mesNotesAwa.donnees?.length} vs base ${nombre(notesAwa.n)}`,
  );

  const mesAbsencesAwa = (await executerOutil("mes_absences", eleve, {})) as {
    ok: boolean; donnees?: { absences: number; absencesJustifiees: number; retards: number };
  };
  const [compteAbsencesAwa] = await db
    .select({
      absences: sql<number>`count(*) FILTER (WHERE statut = 'absent')`,
      justifiees: sql<number>`count(*) FILTER (WHERE statut = 'absent_justifie')`,
      retards: sql<number>`count(*) FILTER (WHERE statut = 'retard')`,
    })
    .from(presences)
    .where(eq(presences.eleveUserId, eleve.id));
  verifier(
    "élève : absences et retards conformes",
    mesAbsencesAwa.donnees?.absences === nombre(compteAbsencesAwa.absences) &&
      mesAbsencesAwa.donnees?.absencesJustifiees === nombre(compteAbsencesAwa.justifiees) &&
      mesAbsencesAwa.donnees?.retards === nombre(compteAbsencesAwa.retards),
  );

  const orientation = (await executerOutil("mon_orientation", eleve, {})) as {
    ok: boolean; donnees?: { resultats: { famille: string }[] };
  };
  verifier(
    "orientation (médecine, biologie) : famille Santé",
    orientation.donnees?.resultats?.[0]?.famille === "Santé",
    `reçu ${JSON.stringify(orientation.donnees)}`,
  );

  // ------------------------------------------------------------------
  // Bilan.
  // ------------------------------------------------------------------
  console.log("");
  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${verifications}.`);
    for (const e of echecs) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(`VERT : ${verifications} vérifications passées, aucun écart.`);
  process.exit(0);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
