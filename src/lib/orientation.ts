/**
 * La boussole d'orientation : les centres d'intérêts de l'élève sont
 * rapprochés des familles de métiers, des filières qui y mènent au
 * Bénin et des établissements qui les dispensent. Données de référence
 * statiques, comme le recensement : aucune base n'est nécessaire.
 */

export type FamilleMetier = {
  /** Nom de la famille, présenté à l'élève. */
  famille: string;
  /** Mots d'intérêts qui pointent vers cette famille. */
  motsCles: string[];
  /** Séries et formations qui y mènent (secondaire puis supérieur). */
  filieres: string[];
  /** Où se former au Bénin. */
  etablissements: string[];
  /** Exemples de métiers atteints. */
  metiers: string[];
};

export const FAMILLES: FamilleMetier[] = [
  {
    famille: "Santé",
    motsCles: [
      "medecine", "sante", "soigner", "infirmier", "pharmacie",
      "biologie", "chirurgie", "dentaire", "veterinaire",
    ],
    filieres: [
      "Série D au lycée, puis médecine, pharmacie ou sciences infirmières",
      "Institut des sciences biomédicales (ISBA) pour les sciences de laboratoire",
    ],
    etablissements: [
      "Faculté des sciences de la santé (UAC, Cotonou)",
      "ISBA (Abomey-Calavi)",
      "École nationale des techniciens médicaux et sanitaires",
    ],
    metiers: ["Médecin", "Pharmacien", "Infirmier", "Sage-femme", "Analyste de laboratoire"],
  },
  {
    famille: "Ingénierie et informatique",
    motsCles: [
      "informatique", "ordinateur", "programmation", "code", "mathematiques",
      "maths", "physique", "genie", "mecanique", "electronique", "robotique",
      "reseaux", "data", "numérique", "numerique",
    ],
    filieres: [
      "Série C au lycée, puis école d'ingénieurs (informatique, génie civil, électromécanique)",
      "Licences professionnelles en réseaux, télécommunications et développement",
    ],
    etablissements: [
      "École polytechnique d'Abomey-Calavi (EPAC, UAC)",
      "UNSTIM (Abomey) pour les sciences et technologies",
      "Instituts privés agréés de Cotonou et de Parakou",
    ],
    metiers: ["Ingénieur", "Développeur", "Technicien réseaux", "Génie civil", "Data analyst"],
  },
  {
    famille: "Agriculture et élevage",
    motsCles: [
      "agriculture", "agronomie", "ferme", "cultures", "elevage",
      "nature", "animaux", "environnement", "foret", "peche",
    ],
    filieres: [
      "Série D au lycée, puis agronomie, élevage ou foresterie",
      "Brevets de technicien agricole dès la fin du collège",
    ],
    etablissements: [
      "Université nationale d'agriculture (UNA, Kétou)",
      "Centres agricoles de Sakété et de Kpokissa",
      "Faculté des sciences agronomiques (UAC)",
    ],
    metiers: ["Agronome", "Vétérinaire", "Technicien d'élevage", "Forestier", "Entrepreneur agricole"],
  },
  {
    famille: "Enseignement et lettres",
    motsCles: [
      "enseigner", "lettres", "francais", "histoire", "geographie",
      "philosophie", "litterature", "lecture", "ecriture",
    ],
    filieres: [
      "Série A au lycée, puis lettres modernes, histoire ou philosophie à l'université",
      "École normale pour devenir professeur (CAP, licence en éducation)",
    ],
    etablissements: [
      "École normale supérieure (ENS, Porto-Novo et Abomey)",
      "Faculté des lettres, langues, arts et communications (UAC)",
      "Université de Parakou (lettres et sciences humaines)",
    ],
    metiers: ["Professeur", "Conseiller d'orientation", "Écrivain", "Traducteur", "Chercheur"],
  },
  {
    famille: "Droit et administration",
    motsCles: [
      "droit", "justice", "juge", "avocat", "administration",
      "politique", "debat", "policier", "notaire",
    ],
    filieres: [
      "Série A ou D au lycée, puis droit (carrière de juge, avocat, notaire)",
      "École nationale d'administration pour les concours de l'État",
    ],
    etablissements: [
      "Faculté de droit et de science politique (UAC, Cotonou)",
      "École nationale d'administration (ENA)",
      "Université de Parakou (droit)",
    ],
    metiers: ["Avocat", "Magistrat", "Notaire", "Administrateur civil", "Juriste d'entreprise"],
  },
  {
    famille: "Commerce et gestion",
    motsCles: [
      "commerce", "business", "vente", "argent", "gestion",
      "comptabilite", "entrepreneuriat", "entreprise", "marketing", "banque",
    ],
    filieres: [
      "Série A ou D au lycée, puis gestion, comptabilité ou marketing",
      "Brevets de technicien supérieur en gestion dès la fin du collège",
    ],
    etablissements: [
      "Institut national d'économie appliquée (INE)",
      "Faculté des sciences économiques et de gestion (UAC, Parakou)",
      "Écoles de commerce agréées de Cotonou",
    ],
    metiers: ["Comptable", "Entrepreneur", "Banquier", "Commercial", "Gestionnaire de projet"],
  },
  {
    famille: "Arts et communication",
    motsCles: [
      "art", "dessin", "musique", "cinema", "journalisme",
      "communication", "photo", "theatre", "design", "mode",
    ],
    filieres: [
      "Série A au lycée, puis communication, journalisme ou arts plastiques",
      "Institut des métiers de l'audiovisuel et du design",
    ],
    etablissements: [
      "Institut des sciences de l'information, de la communication et des arts (ISICA, UAC)",
      "Écoles privées de journalisme agréées",
      "Ateliers et conservatoires des arts",
    ],
    metiers: ["Journaliste", "Graphiste", "Musicien", "Réalisateur", "Chargé de communication"],
  },
  {
    famille: "Sport",
    motsCles: ["sport", "football", "basket", "athletisme", "entraineur", "arbitre"],
    filieres: [
      "Toutes séries au lycée, puis sciences et techniques des activités physiques et sportives",
      "Institut national de la jeunesse et des sports",
    ],
    etablissements: [
      "Institut national de la jeunesse, de l'éducation physique et du sport (INJEPS, Cotonou)",
      "Sections sportives des lycées",
    ],
    metiers: ["Entraîneur", "Professeur d'EPS", "Arbitre", "Manager sportif"],
  },
];

/** Passage sans accents et en minuscules, pour comparer les intérêts. */
export function normaliserTexte(valeur: string): string {
  return valeur
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export type OrientationResultat = {
  famille: string;
  filieres: string[];
  etablissements: string[];
  metiers: string[];
  /** Intérêts de l'élève qui ont fait correspondre cette famille. */
  raisons: string[];
};

/**
 * La famille de métiers qui correspond le mieux aux centres d'intérêts,
 * avec les pistes concrètes. Aucun intérêt connu renvoie un résultat vide,
 * jamais une invention.
 */
export function orienter(interets: string): OrientationResultat[] {
  const interetsListe = interets
    .split(",")
    .map((i) => normaliserTexte(i))
    .filter(Boolean);

  const resultats: OrientationResultat[] = [];
  for (const f of FAMILLES) {
    const motsClesNorm = f.motsCles.map(normaliserTexte);
    const raisons = interetsListe.filter((i) =>
      motsClesNorm.some((m) => i.includes(m) || m.includes(i)),
    );
    if (raisons.length > 0) {
      resultats.push({
        famille: f.famille,
        filieres: f.filieres,
        etablissements: f.etablissements,
        metiers: f.metiers,
        raisons,
      });
    }
  }
  return resultats
    .sort((a, b) => b.raisons.length - a.raisons.length)
    .slice(0, 3);
}
