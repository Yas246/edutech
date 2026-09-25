import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  abonnementsTransport,
  arrets,
  classes,
  codesClasse,
  codesEleve,
  codesEquipe,
  communautes,
  communautesMembres,
  declarationsEnfant,
  enseignements,
  equipes,
  etablissements,
  evaluations,
  frais,
  inscriptions,
  liensFamille,
  lignesTransport,
  matieres,
  notes,
  periodes,
  presences,
  presencesEnseignants,
  transferts,
  users,
} from "../src/db/schema";
import {
  libelleType,
  recensement,
  type EtablissementRecense,
} from "../src/lib/recensement";
import { hasher } from "../src/lib/auth";

const MOT_DE_PASSE_DEMO = "EduTest-2026";

const typesConnus: Record<string, string> = {
  ceg: "ceg",
  college_prive: "college",
  college_technique: "technique",
  lycee: "lycee",
  lycee_technique: "technique",
  superieur: "superieur",
  autre: "autre",
};

async function idUtilisateur(
  email: string,
  donnees: { prenom: string; nom: string; role: string; telephone?: string; sexe?: string },
): Promise<number> {
  const [existant] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existant) return existant.id;
  const [cree] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hasher(MOT_DE_PASSE_DEMO),
      role: donnees.role,
      prenom: donnees.prenom,
      nom: donnees.nom,
      telephone: donnees.telephone ?? "",
      sexe: donnees.sexe ?? "",
      // Les comptes de démonstration sont des comptes établis.
      onboardingFait: true,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (cree) return cree.id;
  const [relu] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return relu.id;
}

/** Les comptes créés avant la colonne sexe sont rattrapés. */
async function fixerSexe(email: string, sexe: string) {
  await db.update(users).set({ sexe }).where(eq(users.email, email));
}

/** Les intérêts déclarés aux premiers pas, rattrapés pour les comptes anciens. */
async function fixerInterets(email: string, interets: string) {
  await db.update(users).set({ interets }).where(eq(users.email, email));
}

/** Le pseudo public d'un compte, rattrapé pour les comptes anciens. */
async function fixerPseudo(email: string, pseudo: string) {
  await db.update(users).set({ pseudo }).where(eq(users.email, email));
}

/** Les 4 caractères d'un code, sans ambiguïté (pas de 0/O, 1/I/L). */
function codeCourt(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function codeEquipe(etablissementId: number): Promise<string> {
  const [existant] = await db
    .select({ code: codesEquipe.code })
    .from(codesEquipe)
    .where(eq(codesEquipe.etablissementId, etablissementId))
    .limit(1);
  if (existant) return existant.code;
  const code = `VME-${codeCourt()}`;
  await db.insert(codesEquipe).values({ etablissementId, code }).onConflictDoNothing();
  return code;
}

async function codeClasse(classeId: number): Promise<string> {
  const [existant] = await db
    .select({ code: codesClasse.code })
    .from(codesClasse)
    .where(eq(codesClasse.classeId, classeId))
    .limit(1);
  if (existant) return existant.code;
  const code = `VMT-${codeCourt()}`;
  await db.insert(codesClasse).values({ classeId, code }).onConflictDoNothing();
  return code;
}

async function codeEleve(eleveUserId: number): Promise<string> {
  const [existant] = await db
    .select({ code: codesEleve.code })
    .from(codesEleve)
    .where(eq(codesEleve.eleveUserId, eleveUserId))
    .limit(1);
  if (existant) return existant.code;
  const code = `VMP-${codeCourt()}`;
  await db.insert(codesEleve).values({ eleveUserId, code }).onConflictDoNothing();
  return code;
}

async function importerRecensement() {
  // Les établissements confirmés du recensement arrivent validés ; les
  // autres rejoignent la file d'attente que le ministère traitera.
  const lignes = recensement.map((e: EtablissementRecense) => ({
    nom: e.nom,
    sigle: e.sigle ?? "",
    type: typesConnus[e.type] ?? "autre",
    statutAdmin: e.statut === "privé" ? "prive" : e.statut === "public" ? "public" : "",
    commune: e.commune ?? "",
    departement: e.departement ?? "",
    quartier: e.quartier ?? "",
    statut: e.etat === "ouvert" ? "valide" : "en_attente",
    source: "recensement",
    etatRecensement: e.etat ?? "",
    dernierePreuve: e.derniere_preuve ?? "",
    sources: e.sources ?? [],
  }));

  let poses = 0;
  for (let i = 0; i < lignes.length; i += 50) {
    const lot = lignes.slice(i, i + 50);
    const crees = await db
      .insert(etablissements)
      .values(lot)
      .onConflictDoNothing({ target: [etablissements.nom, etablissements.commune] })
      .returning({ id: etablissements.id });
    poses += crees.length;
  }
  console.log(`Recensement : ${recensement.length} établissements, ${poses} nouveaux.`);
}

async function importerEcoleDemo() {
  const nomEcole = "Lycée Béhanzin";
  let [ecole] = await db
    .select()
    .from(etablissements)
    .where(and(eq(etablissements.nom, nomEcole), eq(etablissements.commune, "Porto-Novo")))
    .limit(1);

  if (!ecole) {
    const source = recensement.find(
      (e) => e.nom === nomEcole && e.commune === "Porto-Novo",
    );
    if (!source) throw new Error("Lycée Béhanzin introuvable dans le recensement");
    const [cree] = await db
      .insert(etablissements)
      .values({
        nom: source.nom,
        sigle: source.sigle,
        type: "lycee",
        statutAdmin: source.statut === "privé" ? "prive" : "public",
        commune: source.commune,
        departement: source.departement,
        quartier: source.quartier,
        // L'école de démonstration est opérationnelle d'emblée.
        statut: "valide",
        source: "recensement",
        etatRecensement: source.etat,
        dernierePreuve: source.derniere_preuve,
        sources: source.sources ?? [],
      })
      .returning();
    ecole = cree;
  }

  const idDirection = await idUtilisateur("admin-etab.test@edutech.bj", {
    prenom: "Nadège",
    nom: "Gbaguidi",
    role: "direction",
    telephone: "97 11 22 33",
    sexe: "F",
  });
  // Le lycée de démonstration est opérationnel : validé et rattaché à sa
  // direction, même s'il était reparti de la file du recensement.
  await db
    .update(etablissements)
    .set({ statut: "valide", directionUserId: idDirection })
    .where(eq(etablissements.id, ecole.id));

  const idMinistere = await idUtilisateur("ministere.test@edutech.bj", {
    prenom: "Cabinet",
    nom: "Ministère de l'Éducation",
    role: "ministere",
  });

  for (const [email, sexe] of [
    ["admin-etab.test@edutech.bj", "F"],
    ["prof.test@edutech.bj", "M"],
    ["eleve.test@edutech.bj", "F"],
    ["collegien.test@edutech.bj", "M"],
    ["parent.test@edutech.bj", "M"],
  ] as const) {
    await fixerSexe(email, sexe);
  }
  const idProf = await idUtilisateur("prof.test@edutech.bj", {
    prenom: "Aimé",
    nom: "Zinsou",
    role: "enseignant",
    telephone: "96 44 55 66",
    sexe: "M",
  });
  const idEleve = await idUtilisateur("eleve.test@edutech.bj", {
    prenom: "Awa",
    nom: "Dossa",
    role: "eleve",
    sexe: "F",
  });
  const idSecond = await idUtilisateur("collegien.test@edutech.bj", {
    prenom: "Marc",
    nom: "Sagbo",
    role: "eleve",
    sexe: "M",
  });
  const idParent = await idUtilisateur("parent.test@edutech.bj", {
    prenom: "Idriss",
    nom: "Dossa",
    role: "parent",
    telephone: "97 00 11 22",
    sexe: "M",
  });

  // Le parent reste relié à ses deux enfants.
  const couples: [number, number][] = [
    [idParent, idEleve],
    [idParent, idSecond],
  ];
  await db
    .insert(liensFamille)
    .values(
      couples.map(([parentUserId, eleveUserId]) => ({ parentUserId, eleveUserId })),
    )
    .onConflictDoNothing();

  // Périodes de l'année scolaire 2026-2027.
  await db
    .insert(periodes)
    .values([
      {
        etablissementId: ecole.id,
        nom: "Trimestre 1",
        debut: "2026-09-15",
        fin: "2026-12-18",
        active: true,
      },
      {
        etablissementId: ecole.id,
        nom: "Trimestre 2",
        debut: "2027-01-04",
        fin: "2027-03-26",
      },
      {
        etablissementId: ecole.id,
        nom: "Trimestre 3",
        debut: "2027-04-05",
        fin: "2027-06-30",
      },
    ])
    .onConflictDoNothing();

  const periode1 = (
    await db
      .select()
      .from(periodes)
      .where(and(eq(periodes.etablissementId, ecole.id), eq(periodes.nom, "Trimestre 1")))
      .limit(1)
  )[0];

  // Les deux classes de démonstration.
  async function classeDemo(
    nom: string,
    niveau: string,
    programme: { nom: string; coefficient: number }[],
    eleves: number[],
  ) {
    let [classe] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.etablissementId, ecole!.id), eq(classes.nom, nom)))
      .limit(1);
    if (!classe) {
      [classe] = await db
        .insert(classes)
        .values({ etablissementId: ecole!.id, nom, niveau })
        .returning();
    }
    for (const m of programme) {
      await db
        .insert(matieres)
        .values({ classeId: classe.id, nom: m.nom, coefficient: m.coefficient })
        .onConflictDoNothing();
    }
    for (const e of eleves) {
      await db
        .insert(inscriptions)
        .values({ classeId: classe.id, eleveUserId: e })
        .onConflictDoNothing();
    }
    return classe;
  }

  const tleD = await classeDemo(
    "Terminale D",
    "Terminale",
    [
      { nom: "Mathématiques", coefficient: 5 },
      { nom: "Physique-Chimie", coefficient: 5 },
      { nom: "Sciences de la Vie et de la Terre", coefficient: 5 },
      { nom: "Français", coefficient: 4 },
      { nom: "Anglais", coefficient: 3 },
      { nom: "Histoire-Géographie", coefficient: 2 },
      { nom: "Éducation Physique et Sportive", coefficient: 1 },
    ],
    [idEleve],
  );

  await classeDemo(
    "Seconde A",
    "Seconde",
    [
      { nom: "Mathématiques", coefficient: 4 },
      { nom: "Physique-Chimie", coefficient: 4 },
      { nom: "Sciences de la Vie et de la Terre", coefficient: 4 },
      { nom: "Français", coefficient: 4 },
      { nom: "Anglais", coefficient: 3 },
      { nom: "Histoire-Géographie", coefficient: 2 },
      { nom: "Éducation Physique et Sportive", coefficient: 1 },
    ],
    [idSecond],
  );

  // Aimé Zinsou enseigne les Mathématiques en Terminale D.
  const [maths] = await db
    .select()
    .from(matieres)
    .where(and(eq(matieres.classeId, tleD.id), eq(matieres.nom, "Mathématiques")))
    .limit(1);
  if (maths) {
    await db
      .insert(enseignements)
      .values({
        classeId: tleD.id,
        matiereId: maths.id,
        enseignantUserId: idProf,
      })
      .onConflictDoNothing();
  }

  // Frais de démonstration : scolarité par trimestre, tenue pour l'année.
  const fraisExistant = await db
    .select({ id: frais.id })
    .from(frais)
    .where(eq(frais.etablissementId, ecole.id))
    .limit(1);
  if (fraisExistant.length === 0) {
    await db.insert(frais).values([
      {
        etablissementId: ecole.id,
        categorie: "scolarite",
        montant: 150000,
        cibleType: "classe",
        cibleClasseId: tleD.id,
        periodeId: periode1?.id ?? null,
        creePar: idDirection,
      },
      {
        etablissementId: ecole.id,
        categorie: "tenue",
        montant: 12500,
        cibleType: "classe",
        cibleClasseId: tleD.id,
        creePar: idDirection,
      },
    ]);
  }

  console.log(`École de démonstration : ${ecole.nom} (${libelleType[ecole.type]}).`);
  return { ecole, idEleve };
}

/** Les lignes du dispositif réel : 12 villes, ticket à 200 F. */
async function importerTransport(idEleve: number) {
  const lignes = [
    {
      nom: "Cotonou – UAC",
      ville: "Cotonou",
      destination: "Université d'Abomey-Calavi",
      arrets: ["Gare Dantokpa", "Etoile Rouge", "Fidjrossè", "Calavi centre", "Porte du Sud"],
    },
    {
      nom: "Porto-Novo – UAC",
      ville: "Porto-Novo",
      destination: "Université d'Abomey-Calavi",
      arrets: ["Marché Ouando", "Djègan-Kpèvi", "Calavi centre", "Porte du Sud"],
    },
    {
      nom: "Abomey-Calavi – UNSTIM",
      ville: "Abomey-Calavi",
      destination: "Université des Sciences, Technologies, Ingénierie et Mathématiques",
      arrets: ["Porte du Sud", "Zogbadjè", "Togba", "Abomey centre"],
    },
    {
      nom: "Parakou – UP",
      ville: "Parakou",
      destination: "Université de Parakou",
      arrets: ["Marché Arzèkè", "Banikanni", "Campus nord", "Campus sud"],
    },
    {
      nom: "Kétou – UNA",
      ville: "Kétou",
      destination: "Université Nationale d'Agriculture",
      arrets: ["Marché Kétou", "Idigny", "Kpassa", "Campus UNA"],
    },
    {
      nom: "Dassa-Zoumè – UAC",
      ville: "Dassa-Zoumè",
      destination: "Université d'Abomey-Calavi",
      arrets: ["Gare Dassa", "Ouessè", "Calavi centre", "Porte du Sud"],
    },
  ];

  let premiereLigne: { id: number } | undefined;
  for (const l of lignes) {
    let [ligne] = await db
      .select()
      .from(lignesTransport)
      .where(eq(lignesTransport.nom, l.nom))
      .limit(1);
    if (!ligne) {
      [ligne] = await db
        .insert(lignesTransport)
        .values({
          nom: l.nom,
          ville: l.ville,
          destination: l.destination,
          horaireDebut: "06:30",
          horaireFin: "19:00",
        })
        .returning();
    }
    if (!premiereLigne) premiereLigne = ligne;
    const arretsExistants = await db
      .select({ id: arrets.id })
      .from(arrets)
      .where(eq(arrets.ligneId, ligne.id))
      .limit(1);
    if (arretsExistants.length === 0) {
      await db.insert(arrets).values(
        l.arrets.map((nom, i) => ({ ligneId: ligne!.id, nom, ordre: i + 1 })),
      );
    }
  }

  // Awa Dossa est abonnée à la première ligne, à son premier arrêt.
  const dejaAbonnee = await db
    .select({ id: abonnementsTransport.id })
    .from(abonnementsTransport)
    .where(eq(abonnementsTransport.eleveUserId, idEleve))
    .limit(1);
  if (!dejaAbonnee.length && premiereLigne) {
    const [premierArret] = await db
      .select()
      .from(arrets)
      .where(eq(arrets.ligneId, premiereLigne.id))
      .orderBy(arrets.ordre)
      .limit(1);
    if (premierArret) {
      await db
        .insert(abonnementsTransport)
        .values({ eleveUserId: idEleve, ligneId: premiereLigne.id, arretId: premierArret.id })
        .onConflictDoNothing();
    }
  }

  console.log(`Transport : ${lignes.length} lignes réelles, ticket à 200 F.`);
}

/**
 * Vie de classe de démonstration : cinq élèves supplémentaires en
 * Terminale D, des évaluations notées et des présences variées, pour
 * que moyennes, rangs et statistiques nationales aient du sens.
 */
async function vivifierTerminaleD() {
  const [tleD] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.etablissementId, await idEcoleDemo()), eq(classes.nom, "Terminale D")))
    .limit(1);
  if (!tleD) throw new Error("Terminale D introuvable");

  const [prof] = await db
    .select()
    .from(users)
    .where(eq(users.email, "prof.test@edutech.bj"))
    .limit(1);

  const camarades = [
    { email: "eleve1.test@edutech.bj", prenom: "Rachidatou", nom: "Alassane", sexe: "F" },
    { email: "eleve2.test@edutech.bj", prenom: "Kossi", nom: "Amoussou", sexe: "M" },
    { email: "eleve3.test@edutech.bj", prenom: "Bernadette", nom: "Houngbo", sexe: "F" },
    { email: "eleve4.test@edutech.bj", prenom: "Sylvain", nom: "Tokponto", sexe: "M" },
    { email: "eleve5.test@edutech.bj", prenom: "Fatou", nom: "Bello", sexe: "F" },
  ];
  const idsCamarades: number[] = [];
  for (const c of camarades) {
    idsCamarades.push(
      await idUtilisateur(c.email, {
        prenom: c.prenom,
        nom: c.nom,
        role: "eleve",
        sexe: c.sexe,
      }),
    );
  }
  const [awa] = await db
    .select()
    .from(users)
    .where(eq(users.email, "eleve.test@edutech.bj"))
    .limit(1);
  const tous = [awa.id, ...idsCamarades];
  for (const id of tous) {
    await db
      .insert(inscriptions)
      .values({ classeId: tleD.id, eleveUserId: id })
      .onConflictDoNothing();
  }
  for (const [email, sexe] of [
    ["eleve1.test@edutech.bj", "F"],
    ["eleve2.test@edutech.bj", "M"],
    ["eleve3.test@edutech.bj", "F"],
    ["eleve4.test@edutech.bj", "M"],
    ["eleve5.test@edutech.bj", "F"],
  ] as const) {
    await fixerSexe(email, sexe);
  }

  // Des intérêts déclarés, pour que la boussole d'orientation propose.
  for (const [email, interets] of [
    ["eleve.test@edutech.bj", "médecine, biologie"],
    ["eleve1.test@edutech.bj", "enseigner, lecture"],
    ["eleve2.test@edutech.bj", "informatique, ordinateur"],
    ["eleve3.test@edutech.bj", "droit, débat"],
    ["eleve5.test@edutech.bj", "commerce, vente"],
  ] as const) {
    await fixerInterets(email, interets);
  }

  // Trois évaluations de mathématiques, une de physique-chimie.
  const [maths] = await db
    .select()
    .from(matieres)
    .where(and(eq(matieres.classeId, tleD.id), eq(matieres.nom, "Mathématiques")))
    .limit(1);
  const [pc] = await db
    .select()
    .from(matieres)
    .where(
      and(eq(matieres.classeId, tleD.id), eq(matieres.nom, "Physique-Chimie")),
    )
    .limit(1);
  const listeEvals = [
    { matiereId: maths.id, titre: "Interrogation n°1", type: "interrogation", bareme: 20, date: "2026-09-22" },
    { matiereId: maths.id, titre: "Interrogation n°2", type: "interrogation", bareme: 20, date: "2026-10-06" },
    { matiereId: maths.id, titre: "Devoir surveillé n°1", type: "devoir", bareme: 20, date: "2026-10-20" },
    { matiereId: pc.id, titre: "Interrogation n°1", type: "interrogation", bareme: 20, date: "2026-09-29" },
  ];
  for (const e of listeEvals) {
    const [existe] = await db
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(and(eq(evaluations.classeId, tleD.id), eq(evaluations.titre, e.titre), eq(evaluations.date, e.date)))
      .limit(1);
    if (existe) continue;
    const [cree] = await db
      .insert(evaluations)
      .values({
        classeId: tleD.id,
        matiereId: e.matiereId,
        titre: e.titre,
        type: e.type,
        bareme: e.bareme,
        date: e.date,
        creePar: prof.id,
      })
      .returning();

    // Notes par élève (sur 20), volontairement inégales.
    const relevé: Record<string, number[]> = {
      [awa.id]: [12, 9.5, 11, 13],
      [idsCamarades[0]]: [15, 14, 16.5, 12],
      [idsCamarades[1]]: [8, 10, 9, 7.5],
      [idsCamarades[2]]: [16, 17.5, 15, 14.5],
      [idsCamarades[3]]: [6.5, 5, 8, 9],
      [idsCamarades[4]]: [11, 13.5, 12.5, 10],
    };
    for (const [eleveId, notesDeLeleve] of Object.entries(relevé)) {
      // L'interrogation n°2 est notée seulement pour une partie de la classe.
      const rang = listeEvals.findIndex((x) => x.titre === e.titre && x.date === e.date);
      const valeur = notesDeLeleve[rang];
      if (valeur === undefined) continue;
      await db
        .insert(notes)
        .values({ evaluationId: cree.id, eleveUserId: Number(eleveId), valeur: valeur.toFixed(2) })
        .onConflictDoNothing();
    }
  }

  // Présences du mois : quelques retards et absences.
  const relevéPresence: Record<number, { date: string; statut: string; motif?: string }[]> = {
    [awa.id]: [
      { date: "2026-09-24", statut: "absent", motif: "Non parvenue" },
      { date: "2026-10-02", statut: "retard" },
      { date: "2026-10-14", statut: "absent_justifie", motif: "Certificat médical" },
    ],
    [idsCamarades[1]]: [
      { date: "2026-10-02", statut: "absent" },
      { date: "2026-10-03", statut: "absent" },
      { date: "2026-10-09", statut: "retard" },
    ],
    [idsCamarades[3]]: [
      { date: "2026-09-28", statut: "absent_justifie", motif: "Deuil familial" },
    ],
  };
  for (const [eleveId, entrees] of Object.entries(relevéPresence)) {
    for (const entree of entrees) {
      await db
        .insert(presences)
        .values({
          classeId: tleD.id,
          eleveUserId: Number(eleveId),
          date: entree.date,
          statut: entree.statut,
          motif: entree.motif ?? "",
          saisiPar: prof.id,
        })
        .onConflictDoNothing();
    }
  }

  console.log(`Terminale D vivante : ${tous.length} élèves, évaluations notées, présences.`);
}

async function idEcoleDemo(): Promise<number> {
  const [ecole] = await db
    .select({ id: etablissements.id })
    .from(etablissements)
    .where(and(eq(etablissements.nom, "Lycée Béhanzin"), eq(etablissements.commune, "Porto-Novo")))
    .limit(1);
  if (!ecole) throw new Error("Lycée Béhanzin introuvable : lancez le seed principal");
  return ecole.id;
}

/**
 * L'équipe pédagogique complète et son pointage : deux enseignants de
 * plus (français, physique-chimie), leurs attributions dans les deux
 * classes, puis les pointages des trois semaines écoulées. La direction
 * y retrouve une équipe entière sur son écran d'assiduité.
 */
async function importerEquipePedagogique() {
  const idEcole = await idEcoleDemo();
  const listeClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.etablissementId, idEcole));
  const tleD = listeClasses.find((c) => c.nom === "Terminale D");
  const secondeA = listeClasses.find((c) => c.nom === "Seconde A");
  if (!tleD || !secondeA) throw new Error("Classes de démonstration introuvables");

  const idLea = await idUtilisateur("prof2.test@edutech.bj", {
    prenom: "Léa",
    nom: "Adjovi",
    role: "enseignant",
    telephone: "95 21 43 65",
    sexe: "F",
  });
  const idBouraima = await idUtilisateur("prof3.test@edutech.bj", {
    prenom: "Bouraïma",
    nom: "Tairou",
    role: "enseignant",
    telephone: "94 08 76 21",
    sexe: "M",
  });
  await fixerSexe("prof2.test@edutech.bj", "F");

  // Attributions : le français en deux classes pour Léa, la
  // physique-chimie pour Bouraïma (les mathématiques sont déjà à Aimé).
  async function attribuer(
    classeId: number,
    nomMatiere: string,
    enseignantUserId: number,
  ) {
    const [matiere] = await db
      .select({ id: matieres.id })
      .from(matieres)
      .where(and(eq(matieres.classeId, classeId), eq(matieres.nom, nomMatiere)))
      .limit(1);
    if (!matiere) return;
    await db
      .insert(enseignements)
      .values({ classeId, matiereId: matiere.id, enseignantUserId })
      .onConflictDoNothing();
  }
  await attribuer(tleD.id, "Français", idLea);
  await attribuer(secondeA.id, "Français", idLea);
  await attribuer(tleD.id, "Physique-Chimie", idBouraima);

  // Pointage des trois semaines écoulées : jours ouvrés du 7 au 24
  // septembre 2026, avec quelques incidents pour que les taux parlent.
  const joursOuvres = [
    "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11",
    "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18",
    "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24",
  ];
  const incidents: Record<number, Record<string, string>> = {
    [idLea]: { "2026-09-10": "retard" },
  };
  const incidentsAime: Record<string, string> = {
    "2026-09-15": "absent",
    "2026-09-18": "retard",
  };
  const incidentsBouraima: Record<string, string> = { "2026-09-21": "absent" };
  const [aime] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "prof.test@edutech.bj"))
    .limit(1);
  const idDirection = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "admin-etab.test@edutech.bj"))
      .limit(1)
  )[0].id;

  const equipes: { enseignant: number; incidents: Record<string, string> }[] = [
    { enseignant: aime.id, incidents: incidentsAime },
    { enseignant: idLea, incidents: incidents[idLea] ?? {} },
    { enseignant: idBouraima, incidents: incidentsBouraima },
  ];
  for (const membre of equipes) {
    for (const jour of joursOuvres) {
      await db
        .insert(presencesEnseignants)
        .values({
          etablissementId: idEcole,
          enseignantUserId: membre.enseignant,
          date: jour,
          statut: membre.incidents[jour] ?? "present",
          saisiPar: idDirection,
        })
        .onConflictDoNothing();
    }
  }

  console.log(
    `Équipe pédagogique : 3 enseignants pointés sur ${joursOuvres.length} jours.`,
  );
}

/**
 * Le dossier de transfert de démonstration : une élève d'un CEG du
 * secteur demande son entrée au lycée ; le dossier attend le ministère.
 */
async function importerTransfertDemo() {
  const idEcole = await idEcoleDemo();
  const [origine] = await db
    .select()
    .from(etablissements)
    .where(eq(etablissements.nom, "CEG 1 Adjarra"))
    .limit(1);
  if (!origine) return;

  let [classeOrigine] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.etablissementId, origine.id), eq(classes.nom, "Seconde A")))
    .limit(1);
  if (!classeOrigine) {
    [classeOrigine] = await db
      .insert(classes)
      .values({ etablissementId: origine.id, nom: "Seconde A", niveau: "Seconde" })
      .returning();
  }

  const idEleve = await idUtilisateur("transfert.test@edutech.bj", {
    prenom: "Prisca",
    nom: "Amoussou",
    role: "eleve",
    sexe: "F",
  });
  await db
    .insert(inscriptions)
    .values({ classeId: classeOrigine.id, eleveUserId: idEleve })
    .onConflictDoNothing();

  // L'école d'origine a sa direction : c'est elle qui acceptera la demande.
  const idDirectionOrigine = await idUtilisateur("direction-adjarra.test@edutech.bj", {
    prenom: "Théophile",
    nom: "Koudjo",
    role: "direction",
    telephone: "97 44 55 66",
    sexe: "M",
  });
  await db
    .update(etablissements)
    .set({ directionUserId: idDirectionOrigine })
    .where(eq(etablissements.id, origine.id));

  const [classeArrivee] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.etablissementId, idEcole), eq(classes.nom, "Seconde A")))
    .limit(1);
  if (!classeArrivee) return;

  const dejaLa = await db
    .select({ id: transferts.id })
    .from(transferts)
    .where(
      and(
        eq(transferts.eleveUserId, idEleve),
        eq(transferts.etablissementArrivee, idEcole),
      ),
    )
    .limit(1);
  if (dejaLa.length > 0) return;

  const idDirection = (
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "admin-etab.test@edutech.bj"))
      .limit(1)
  )[0].id;
  await db.insert(transferts).values({
    eleveUserId: idEleve,
    etablissementDepart: origine.id,
    etablissementArrivee: idEcole,
    statutArrivee: "passant",
    classeArriveeId: classeArrivee.id,
    motif: "Rapprochement du domicile",
    statut: "demande",
    demandePar: idDirection,
  });
  console.log("Transfert de démonstration : 1 demande ouverte par l'école d'accueil, en attente de l'école d'origine.");
}

/**
 * Les identités et rattachements de la vie réelle : un pseudo par
 * compte, l'équipe confirmée du lycée, les codes (école, classes,
 * élèves) et les déclarations familiales croisées.
 */
async function importerIdentites() {
  const pseudos: [string, string][] = [
    ["parent.test@edutech.bj", "idriss.dossa"],
    ["admin-etab.test@edutech.bj", "nadege.gbaguidi"],
    ["ministere.test@edutech.bj", "ministere.education"],
    ["prof.test@edutech.bj", "aime.zinsou"],
    ["eleve.test@edutech.bj", "awa.dossa"],
    ["collegien.test@edutech.bj", "marc.sagbo"],
    ["eleve1.test@edutech.bj", "rachidatou.alassane"],
    ["eleve2.test@edutech.bj", "kossi.amoussou"],
    ["eleve3.test@edutech.bj", "bernadette.houngbo"],
    ["eleve4.test@edutech.bj", "sylvain.tokponto"],
    ["eleve5.test@edutech.bj", "fatou.bello"],
    ["prof2.test@edutech.bj", "lea.adjovi"],
    ["agent1.ministere@edutech.bj", "grace.hounkpatin"],
    ["parent2.test@edutech.bj", "aristide.kpossou"],
    ["direction-adjarra.test@edutech.bj", "theophile.koudjo"],
    ["transfert.test@edutech.bj", "prisca.amoussou"],
  ];
  for (const [email, pseudo] of pseudos) {
    await fixerPseudo(email, pseudo);
  }

  const idEcole = await idEcoleDemo();

  // L'équipe confirmée du lycée.
  for (const email of ["prof.test@edutech.bj", "prof2.test@edutech.bj", "prof3.test@edutech.bj"]) {
    const [prof] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!prof) continue;
    await db
      .insert(equipes)
      .values({ etablissementId: idEcole, userId: prof.id, statut: "confirme" })
      .onConflictDoNothing();
  }

  // Les codes d'école et de classe.
  await codeEquipe(idEcole);
  const listeClasses = await db.select().from(classes).where(eq(classes.etablissementId, idEcole));
  for (const c of listeClasses) {
    await codeClasse(c.id);
  }

  // Les codes personnels des élèves de l'école.
  const elevesEcole = await db
    .select({ id: users.id })
    .from(inscriptions)
    .innerJoin(classes, eq(classes.id, inscriptions.classeId))
    .innerJoin(users, eq(users.id, inscriptions.eleveUserId))
    .where(eq(classes.etablissementId, idEcole));
  for (const e of elevesEcole) {
    await codeEleve(e.id);
  }

  // Les déclarations familiales de Idriss, croisées avec les comptes.
  const [idriss] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "parent.test@edutech.bj"))
    .limit(1);
  const [awa] = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(users)
    .where(eq(users.email, "eleve.test@edutech.bj"))
    .limit(1);
  const [marc] = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom })
    .from(users)
    .where(eq(users.email, "collegien.test@edutech.bj"))
    .limit(1);
  if (!idriss || !awa || !marc) return;

  const deja = await db
    .select({ id: declarationsEnfant.id })
    .from(declarationsEnfant)
    .where(eq(declarationsEnfant.parentUserId, idriss.id))
    .limit(1);
  if (deja.length > 0) return;

  await db.insert(declarationsEnfant).values([
    {
      parentUserId: idriss.id,
      prenom: awa.prenom,
      nom: awa.nom,
      relation: "pere",
      eleveUserId: awa.id,
      codeFamille: `VMF-${codeCourt()}`,
    },
    {
      parentUserId: idriss.id,
      prenom: marc.prenom,
      nom: marc.nom,
      relation: "pere",
      eleveUserId: marc.id,
      codeFamille: `VMF-${codeCourt()}`,
    },
  ]);
  console.log("Identités : pseudos, équipe confirmée, codes école/classes/élèves, famille croisée.");
}

/**
 * Les communautés ouvertes de la démonstration : trois canaux thématiques
 * avec leurs premiers membres.
 */
async function importerCommunautes() {
  const deja = await db.select({ id: communautes.id }).from(communautes).limit(1);
  if (deja.length > 0) return;

  async function pseudoId(pseudo: string): Promise<number | null> {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.pseudo, pseudo)).limit(1);
    return u?.id ?? null;
  }

  const canaux = [
    {
      nom: "Parents d'élèves du Bénin",
      description: "L'entraide des familles : scolarité, santé, vie quotidienne.",
      type: "communaute",
      membres: ["idriss.dossa", "nadege.gbaguidi", "aristide.kpossou"],
    },
    {
      nom: "Club maths",
      description: "Enigmes, olympiades et remise à niveau, du collège au lycée.",
      type: "club",
      membres: ["awa.dossa", "bernadette.houngbo", "aime.zinsou"],
    },
    {
      nom: "Orientation après le bac",
      description: "Séries, filières, universités : les questions de tous ceux qui choisissent.",
      type: "communaute",
      membres: ["awa.dossa", "rachidatou.alassane", "fatou.bello", "lea.adjovi"],
    },
  ];

  for (const canal of canaux) {
    const auteur = await pseudoId(canal.membres[0]);
    if (!auteur) continue;
    const [creee] = await db
      .insert(communautes)
      .values({ nom: canal.nom, description: canal.description, type: canal.type, creePar: auteur })
      .returning({ id: communautes.id });
    for (const pseudo of canal.membres) {
      const id = await pseudoId(pseudo);
      if (!id) continue;
      await db
        .insert(communautesMembres)
        .values({
          communauteId: creee.id,
          userId: id,
          role: pseudo === canal.membres[0] ? "admin" : "membre",
        })
        .onConflictDoNothing();
    }
  }
  console.log("Communautés : 3 canaux ouverts de démonstration.");
}

/**
 * Le réseau entier : une communauté ouverte par établissement validé
 * du recensement, animée par sa direction quand elle existe. C'est
 * elle qui alimente le fil de la plateforme.
 */
async function importerCommunautesEtablissements() {
  const [cabinet] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "ministere.test@edutech.bj"))
    .limit(1);
  if (!cabinet) return;

  // Tout le recensement entre dans le réseau, pas seulement les écoles
  // déjà validées : la communauté existe, la gestion attend la validation.
  const validees = await db.select().from(etablissements);

  let creees = 0;
  for (const ecole of validees) {
    const dejaLa = await db
      .select({ id: communautes.id })
      .from(communautes)
      .where(eq(communautes.etablissementId, ecole.id))
      .limit(1);
    if (dejaLa.length > 0) continue;

    const [creee] = await db
      .insert(communautes)
      .values({
        nom: ecole.nom,
        description: "La communauté de l'établissement : familles, équipe, anciens.",
        type: "communaute",
        etablissementId: ecole.id,
        creePar: cabinet.id,
      })
      .returning({ id: communautes.id });
    creees += 1;

    if (ecole.directionUserId) {
      await db
        .insert(communautesMembres)
        .values({
          communauteId: creee.id,
          userId: ecole.directionUserId,
          role: "admin",
        })
        .onConflictDoNothing();
    }
  }
  console.log("Communautés du recensement : " + creees + " établissements rejoignent le réseau.");
}

async function principal() {
  await importerRecensement();
  const { idEleve } = await importerEcoleDemo();
  await importerTransport(idEleve);
  await vivifierTerminaleD();
  await importerEquipePedagogique();
  await importerTransfertDemo();
  await importerIdentites();
  await importerCommunautes();
  await importerCommunautesEtablissements();
  await importerAccesMinistere();
  await vivifierAbandons();
  await fixerEtatCivil();
  console.log("Seed terminé. Comptes de démonstration, mot de passe unique : EduTest-2026");
  process.exit(0);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});

/* Le code d'accès ministère de démonstration : à usage unique, il
   ouvre un compte « ministère » depuis /acces-ministere. */
async function importerAccesMinistere() {
  const { accesMinistere } = await import("../src/db/schema");
  const existant = await db.select({ code: accesMinistere.code }).from(accesMinistere).limit(1);
  if (existant.length > 0) return;
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "VMN-";
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  await db.insert(accesMinistere).values({ code, organisation: "" });
  console.log(`Accès ministère : code de démonstration ${code} (à usage unique).`);
}

/* Le cas de démonstration de l'abandon scolaire : en Seconde A du
   Lycée Béhanzin, un garçon et une fille ont cessé de venir il y a
   plus de deux semaines, pendant que la classe continue d'être
   pointée (Prisca Amoussou reste présente). Dates RELATIVES : le cas
   reste vivant quel que soit le jour du seed. */
async function vivifierAbandons() {
  const [ecole] = await db
    .select({ id: etablissements.id, directionUserId: etablissements.directionUserId })
    .from(etablissements)
    .where(and(eq(etablissements.nom, "Lycée Béhanzin"), eq(etablissements.commune, "Porto-Novo")))
    .limit(1);
  if (!ecole || !ecole.directionUserId) return;
  const [secondeA] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.etablissementId, ecole.id), eq(classes.nom, "Seconde A")))
    .limit(1);
  if (!secondeA) return;

  const ilYA = (jours: number) =>
    new Date(Date.now() - jours * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const ouvre = (iso: string) => new Date(`${iso}T12:00:00`).getDay() !== 0;

  // Falilatou, la seconde abandonneuse du cas de démonstration : son
  // compte est créé ici s'il n'existe pas encore.
  const idFalilatou = await idUtilisateur("falilatou.test@edutech.bj", {
    prenom: "Falilatou",
    nom: "Issifou",
    role: "eleve",
    sexe: "F",
  });
  await db
    .update(users)
    .set({ pseudo: "falilatou.issifou" })
    .where(eq(users.email, "falilatou.test@edutech.bj"));
  await db
    .insert(inscriptions)
    .values({ classeId: secondeA.id, eleveUserId: idFalilatou })
    .onConflictDoNothing({ target: [inscriptions.classeId, inscriptions.eleveUserId] });

  async function poser(elevePseudo: string, depuisJours: number, jusquJours: number) {
    const [eleve] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.pseudo, elevePseudo))
      .limit(1);
    if (!eleve) return;
    for (let n = depuisJours; n <= jusquJours; n++) {
      const date = ilYA(n);
      if (!ouvre(date)) continue;
      await db
        .insert(presences)
        .values({
          classeId: secondeA.id,
          eleveUserId: eleve.id,
          date,
          statut: "present",
          saisiPar: ecole.directionUserId as number,
        })
        .onConflictDoNothing();
    }
  }

  // Prisca reste présente : c'est elle qui prouve que la classe est
  // encore pointée sur les quatorze derniers jours.
  await poser("prisca.amoussou", 0, 20);
  // Marc et Falilatou ont cessé de venir : plus rien depuis 25+ jours.
  await poser("marc.sagbo", 25, 45);
  await poser("falilatou.issifou", 27, 47);

  console.log(
    "Abandon scolaire : deux élèves de Seconde A présumés en abandon (marc.sagbo, falilatou.issifou).",
  );
}

/* L'état civil des élèves de démonstration : dates et lieux de
   naissance plausibles, repris tels quels par les listes de
   candidature BEPC / BAC. */
async function fixerEtatCivil() {
  const etatCivil: [string, string, string][] = [
    ["eleve.test@edutech.bj", "2008-04-12", "Porto-Novo"],
    ["collegien.test@edutech.bj", "2010-09-03", "Porto-Novo"],
    ["eleve1.test@edutech.bj", "2008-11-21", "Parakou"],
    ["eleve2.test@edutech.bj", "2009-02-14", "Abomey"],
    ["eleve3.test@edutech.bj", "2008-07-30", "Bohicon"],
    ["eleve4.test@edutech.bj", "2009-06-08", "Djougou"],
    ["eleve5.test@edutech.bj", "2008-12-17", "Natitingou"],
    ["falilatou.test@edutech.bj", "2010-05-25", "Porto-Novo"],
    ["transfert.test@edutech.bj", "2010-10-11", "Adjarra"],
  ];
  for (const [email, naissance, lieu] of etatCivil) {
    await db
      .update(users)
      .set({ dateNaissance: naissance, lieuNaissance: lieu })
      .where(eq(users.email, email));
  }
  console.log(`État civil : ${etatCivil.length} élèves de démonstration datés et localisés.`);
}
