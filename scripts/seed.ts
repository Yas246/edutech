import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  abonnementsTransport,
  arrets,
  classes,
  enseignements,
  etablissements,
  frais,
  inscriptions,
  liensFamille,
  lignesTransport,
  matieres,
  periodes,
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
  donnees: { prenom: string; nom: string; role: string; telephone?: string },
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
  const idProf = await idUtilisateur("prof.test@edutech.bj", {
    prenom: "Aimé",
    nom: "Zinsou",
    role: "enseignant",
    telephone: "96 44 55 66",
  });
  const idEleve = await idUtilisateur("eleve.test@edutech.bj", {
    prenom: "Awa",
    nom: "Dossa",
    role: "eleve",
  });
  const idSecond = await idUtilisateur("collegien.test@edutech.bj", {
    prenom: "Marc",
    nom: "Sagbo",
    role: "eleve",
  });
  const idParent = await idUtilisateur("parent.test@edutech.bj", {
    prenom: "Idriss",
    nom: "Dossa",
    role: "parent",
    telephone: "97 00 11 22",
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

async function principal() {
  await importerRecensement();
  const { idEleve } = await importerEcoleDemo();
  await importerTransport(idEleve);
  console.log("Seed terminé. Comptes de démonstration, mot de passe unique : EduTest-2026");
  process.exit(0);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
