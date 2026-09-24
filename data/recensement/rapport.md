# Recensement des établissements d'enseignement du Bénin

**Date de génération :** 12 septembre 2026 · **Année de rentrée visée :** 2026-2027
**Livrables :** 12 fichiers `etablissements_<departement>.json` (secondaire) + `etablissements_superieur.json`

---

## 1. Avertissement sur la couverture

**329 établissements du secondaire** sont recensés ici avec au moins une source vérifiable.

Le MESTFP annonce sur son propre site **880 établissements publics et 1 696 établissements privés**
d'enseignement secondaire général ([source](https://www.enseignementsecondaire.gouv.bj/volet-enseignements/enseignement-secondaire-general)),
soit environ **2 576 établissements**. Ce recensement en couvre donc **~13 %**.

Ce n'est pas un choix : aucune liste nominative nationale n'est publiquement accessible.
Les vérifications menées sur les canaux officiels (détail en §5) donnent toutes un mur :

| Canal | Résultat |
|---|---|
| EducMaster (`secondaire.educmaster.bj/explorer-les-donnees`) | données nominatives réservées aux comptes authentifiés |
| `data.gouv.bj` (portail open data) | domaine injoignable au 12/09/2026 |
| Arrêté MESTFP de nomination des responsables 2025-2026 (PDF, 52 p.) | scan dont la couche OCR est illisible (tableaux pivotés, caractères corrompus) |
| Arrêté n° 012/MES/… du 29/07/2026 (2026-2027) | annoncé par la presse, PDF non publié en ligne |
| `eresultats.bj` / API `apires.eresultats.bj` | aucun point d'entrée listant les établissements |
| Annuaires statistiques INFRE | maternelle et primaire uniquement |
| Wikidata | ~900 écoles béninoises, quasi exclusivement maternelle/primaire |

La règle « n'invente jamais un établissement » a été appliquée strictement : aucune fiche n'a été
complétée par déduction. Le fichier est donc court mais chaque ligne est traçable.

**Recommandation :** la seule voie vers une liste exhaustive est une demande officielle au MESTFP
(DPP / DSI) ou un compte EducMaster. Le format de ces fichiers est prêt à absorber un tel export.

---

## 2. Totaux par département

| Département | Total | CEG | Lycée | Lycée tech. | Collège tech. | Collège privé | Autre | Public | Privé | Statut ND | Ouvert | Incertain | Preuve ≥ 2023 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Alibori | 16 | 7 | 0 | 2 | 0 | 7 | 0 | 9 | 7 | 0 | 1 | 15 | 3 |
| Atacora | 31 | 24 | 1 | 0 | 1 | 5 | 0 | 25 | 6 | 0 | 2 | 29 | 4 |
| Atlantique | 51 | 24 | 2 | 5 | 0 | 19 | 1 | 28 | 20 | 3 | 6 | 45 | 15 |
| Borgou | 44 | 24 | 3 | 2 | 1 | 14 | 0 | 28 | 14 | 2 | 2 | 42 | 14 |
| Collines | 23 | 20 | 0 | 2 | 0 | 1 | 0 | 22 | 1 | 0 | 0 | 23 | 3 |
| Couffo | 7 | 5 | 0 | 1 | 0 | 1 | 0 | 5 | 1 | 1 | 0 | 7 | 2 |
| Donga | 13 | 10 | 1 | 0 | 0 | 2 | 0 | 10 | 2 | 1 | 0 | 13 | 1 |
| Littoral | 20 | 10 | 0 | 1 | 0 | 9 | 0 | 11 | 9 | 0 | 3 | 17 | 4 |
| Mono | 12 | 10 | 0 | 1 | 0 | 1 | 0 | 10 | 1 | 1 | 2 | 10 | 4 |
| Ouémé | 57 | 24 | 2 | 2 | 2 | 16 | 11 | 24 | 17 | 16 | 6 | 51 | 27 |
| Plateau | 26 | 23 | 0 | 2 | 0 | 1 | 0 | 23 | 1 | 2 | 1 | 25 | 4 |
| Zou | 29 | 19 | 4 | 1 | 0 | 5 | 0 | 22 | 5 | 2 | 0 | 29 | 7 |
| **Total** | **329** | **200** | **13** | **19** | **4** | **81** | **12** | **217** | **84** | **28** | **23** | **306** | **88** |

Le Couffo (7) et le Mono (12) sont manifestement sous-couverts : ce sont les départements où la
cartographie communautaire béninoise est la moins avancée, pas ceux où il y a le moins d'écoles.

**Enseignement supérieur :** 36 fiches dans `etablissements_superieur.json` (Atlantique 10, Littoral 12,
Ouémé 5, Plateau 3, Borgou 4, Atacora 1, Zou 1). Quelques fiches désignent une faculté ou un campus
plutôt qu'une institution autonome — à arbitrer avant intégration.

---

## 3. Exclusions

Établissements trouvés avec une mesure de fermeture, suspension ou refus d'agrément. **Aucun d'eux
ne figure dans les fichiers JSON** (vérifié nom par nom).

### 3.1 Secondaire — 33 collèges privés interdits d'ouverture, rentrée 2019-2020

Communiqué MESTFP **n° 030/MESTFP/DC/SGM/DPP/SGSI/SA** du **17 septembre 2019** : les établissements
privés du secondaire général, technique et de la formation professionnelle non agréés par le ministère
n'étaient pas autorisés à ouvrir leurs portes pour 2019-2020 et jusqu'à nouvel ordre. 33 collèges
étaient nommément visés.

**Les 33 noms n'ont pas pu être transcrits** : les deux articles qui relaient le communiqué ne
publient que des photos du document, sans texte exploitable. Ils ne sont donc pas reproduits ici —
recopier une liste non lue serait exactement l'erreur que ce recensement cherche à éviter.

- [journaldubenin.com — 18/09/2019](https://journaldubenin.com/benin-liste-des-ecoles-privees-non-autorisees-a-exercer/)
- [boulevard-des-infos.com — 18/09/2019](https://boulevard-des-infos.com/2019/09/18/benin-liste-des-33-colleges-prives-interdits-douverture-en-2019-2020/) (serveur injoignable au 12/09/2026)

### 3.2 Supérieur — 6 établissements privés scellés, septembre 2024

Mesure de la **Direction générale de l'Enseignement supérieur (DGES / MESRS)**, avec le concours de la
Police républicaine, début septembre 2024, avant la rentrée universitaire 2024-2025.

| Établissement | Commune | Motifs |
|---|---|---|
| Institut Supérieur de Communication (ISCOM) | | ouverture de filières sans autorisation préalable |
| Institut Universitaire Africain | | idem |
| Poma University | | idem |
| Triumphant University | | idem |
| EDEXEL | | idem |
| ELTC | Ifangni (Igolo) | aucun candidat présenté aux examens nationaux Licence/Master depuis 2017 |

Motifs communs relevés : filières et sections anglophones ouvertes sans agrément, personnel
administratif insuffisant, absence des conditions minimales de fonctionnement.
Source : [visages-du-benin.com — 02/09/2024](https://visages-du-benin.com/benin-ce-qui-est-reproche-aux-universites-privees-fermees/)

### 3.3 Recherches de fermetures restées sans résultat

Aucun communiqué de fermeture, suspension ou retrait d'agrément d'établissement **secondaire** n'a
été trouvé pour **2024, 2025 ou 2026**. La rubrique « Communiqués » du site du MESTFP ne contient,
sur la période consultable, que des avis de recrutement, d'inscription aux examens et de concours.
L'absence de communiqué récent ne signifie pas l'absence de fermetures — seulement qu'elles ne sont
pas publiées sur les canaux web accessibles.

---

## 4. Points d'incertitude

**Fraîcheur des preuves.** 88 fiches sur 329 (27 %) reposent sur une source de 2023 ou plus récente.
Les 241 autres s'appuient sur une contribution OpenStreetMap plus ancienne (jusqu'à 2012).
C'est pourquoi **306 fiches sur 329 sont à `etat: "incertain"`** : leur existence est attestée, leur
activité à la rentrée 2026-2027 ne l'est pas. Seules les **23 fiches à `etat: "ouvert"`** ont une
preuve d'activité 2026 (présence d'un candidat au BAC ou au BEPC de la session 2026).

**Ce que vaut `derniere_preuve` pour les fiches OSM.** C'est l'année du dernier amendement de l'objet
OpenStreetMap, c'est-à-dire la dernière fois qu'un contributeur a constaté quelque chose sur le
terrain ou sur imagerie. C'est une preuve d'existence, pas une preuve d'agrément ni d'activité.

**Doublons possibles, laissés en double à dessein** (fusionner aurait été un pari) :

| Département | Commune | Fiche A | Fiche B | Question |
|---|---|---|---|---|
| Borgou | Parakou | Collège catholique Hibiscus 1er cycle | Collège Catholique les Hibiscus | un seul établissement à deux cycles, ou deux entités ? |
| Collines | Bantè | CEG Bantè | CEG 2 Bantè | « CEG Bantè » est-il le CEG 1 ? |
| Zou | Zogbodomey | CEG 1 Zogbodomey | Collège d'enseignement général de Zogbodomey | même question |

**Fusions effectuées** (variantes d'un même nom, même commune) : Lycée Béhanzin (Porto-Novo),
Lycée technique d'amitié sino-béninoise d'Akassato, Lycée technique et professionnel de Ouidah,
Lycée Mathieu Bouké de Parakou, Lycée des jeunes filles de Parakou, Lycée Technique Agricole de Kika
(Tchaourou), Lycée agricole Mèdji de Sékou (Allada). La graphie écartée est conservée dans `alias`.

**Une fusion plus fragile que les autres :** l'objet OSM « Lycée Militaire de Natitingou » a été
rattaché au « Lycée militaire de jeunes filles Général Mathieu Kérékou » cité par la presse pour le
BEPC 2026 (le département Atacora est la seule localisation donnée par l'article). S'il existe un
second établissement militaire à Natitingou, cette fusion est erronée — à vérifier.

**Communes manquantes.** Une fiche n'a pas de commune : *Collège catholique Holy Family* (Atacora),
la source presse ne donnant que le département.

**Objets OSM écartés au nettoyage**, documenté pour audit :
- 10 objets au nom purement générique (« CEG », « Collège », « Lycée », « Ecole Secondaire ») :
  aucun établissement identifiable, donc rejetés.
- 6 objets cartographiant une parcelle et non le bâtiment (« Site CEG 3 Savè », « Réserve CEG Kabolé »,
  « Terrain Sport CEG Pahou »…) : le nom d'établissement a été dégagé du préfixe et la fiche conservée
  en `incertain`, le libellé OSM d'origine passant en `alias`. Une réserve foncière n'est pas une
  preuve d'activité.

**Coordonnées de contact.** 20 fiches sur 329 portent un téléphone ou un email (tous issus de tags
OSM). C'est la réalité du terrain : la grande majorité des établissements béninois n'a pas de
coordonnées publiées. Aucun contact n'a été deviné.

**Cycles.** 48 fiches sur 329 ont des cycles renseignés. Le nom d'un CEG ne dit pas s'il couvre le
premier cycle seul ou les deux ; le champ reste vide plutôt que supposé.

**Statut.** 28 fiches ont un statut vide. Un « Lycée X » béninois est public dans l'immense majorité
des cas, mais « immense majorité » n'est pas « toujours » — non renseigné plutôt que supposé.

---

## 5. Sources utilisées

### Officielles
| Source | Date de consultation | Usage |
|---|---|---|
| [MESTFP — Enseignement secondaire général](https://www.enseignementsecondaire.gouv.bj/volet-enseignements/enseignement-secondaire-general) | 12/09/2026 | totaux nationaux (880 publics / 1 696 privés) |
| [MESTFP — Communiqués](https://www.enseignementsecondaire.gouv.bj/actualite/communiques) | 12/09/2026 | recherche de fermetures (aucune trouvée) |
| [EducMaster — portail](https://educmaster.bj/) et [secondaire](https://secondaire.educmaster.bj/explorer-les-donnees) | 12/09/2026 | données nominatives inaccessibles sans compte |
| [Portail MESTFP](https://portail.enseignementsecondaire.bj/) | 12/09/2026 | inventaire des services en ligne du ministère |
| [gouv.bj — nomination des responsables d'établissements](https://www.gouv.bj/article/1837/) | 12/09/2026 | arrêtés de nomination (PDF scannés) |

### Presse (preuves d'activité 2026)
| Source | Date | Usage |
|---|---|---|
| [Bénin Web TV — 20 meilleurs au BAC juin 2026](https://beninwebtv.bj/benin-les-classements-des-20-meilleurs-au-bac-session-de-juin-2026/) | 22/07/2026 | 15 établissements, second cycle, `etat: ouvert` |
| [Banouto — 12 premiers au BEPC 2026](https://www.banouto.bj/societe/article/20260723-bepc-2026-au-benin-liste-des-12-premiers-au-plan-national) | 23/07/2026 | 11 établissements, premier cycle, `etat: ouvert` |
| [Le Matinal — nomination des responsables 2025-2026](https://lematinal.bj/benin-de-nouveaux-responsables-de-lycees-et-colleges-publics-nommes/) | 25/07/2025 | arrêté complet en PDF, OCR inexploitable |
| [Banouto — 498 nominations CEG et lycées](https://www.banouto.bj/societe/article/20250725-ceg-et-lycees-au-benin-nomination-de-498-directeurs-surveillants-et-censeurs-liste) | 25/07/2025 | idem |

### Encyclopédiques et cartographiques
| Source | Date de consultation | Usage |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/) via [Overpass API](https://overpass-api.de/) | 12/09/2026 | 319 fiches ; 4 686 objets scolaires extraits, 2 030 nommés |
| [geoBoundaries BEN ADM2](https://www.geoboundaries.org/api/current/gbOpen/BEN/ADM2/) | 12/09/2026 | rattachement commune/département par géométrie (77 communes) |
| [Wikipédia — lycées de l'Atlantique](https://fr.wikipedia.org/wiki/Liste_des_lyc%C3%A9es_du_d%C3%A9partement_de_l%27Atlantique) | 12/09/2026 | 4 lycées publics |
| [Wikipédia — lycées du Zou et des Collines](https://fr.wikipedia.org/wiki/Liste_des_lyc%C3%A9es_des_d%C3%A9partements_du_Zou_et_des_Collines) | 12/09/2026 | 5 lycées publics |
| [Wikipédia — lycées du Borgou et de l'Alibori](https://fr.wikipedia.org/wiki/Liste_des_lyc%C3%A9es_des_d%C3%A9partements_du_Borgou_et_de_l%27Alibori) | 12/09/2026 | 4 lycées publics |
| [Wikidata (SPARQL)](https://query.wikidata.org/) | 12/09/2026 | vérifié, sans apport pour le secondaire |

---

## 6. Contrôles passés avant livraison

- JSON valide, UTF-8, accents corrects, relu après écriture.
- `meta.total_etablissements` égal au nombre d'éléments de `etablissements`, pour les 13 fichiers.
- `departement` ∈ {Alibori, Atacora, Atlantique, Borgou, Collines, Couffo, Donga, Littoral, Mono,
  Ouémé, Plateau, Zou} et `commune` appartenant bien au département déclaré (vérifié contre la
  liste officielle des 77 communes).
- `type`, `statut`, `etat`, `cycles` : valeurs contraintes à l'énumération du cahier des charges.
- Chaque fiche a **au moins une source** et une **année de dernière preuve** — contrôle bloquant.
- Déduplication sur nom normalisé (accents, casse, articles et abréviations neutralisés, ordre des
  mots indifférent) + commune ; les graphies écartées sont conservées dans `alias`.
- Aucun établissement des listes d'exclusion ne figure dans les fichiers.

---

## 7. Rejouer le recensement

`pipeline/` contient les scripts qui ont produit ces fichiers, dans l'ordre : `build_osm.py`
(extraction et géolocalisation OSM) → `assemble.py` (fusion des couches, contrôles, écriture) →
`assemble_sup.py` (supérieur). `geo.py` porte la table des 77 communes et le point-dans-polygone,
`classify.py` les règles de typage et la clé de déduplication, `nettoyage.py` les trois règles de
nettoyage OSM, `couche_presse.py` les établissements transcrits des sources 2026.

Pour les rejouer il faut deux choses : refaire l'extraction Overpass (`amenity=school|college|university`
et `building=school` sur la zone `ISO3166-1=BJ`, sortie `out tags center meta`) et ajuster la
constante `SP` en tête de `geo.py`, qui pointe encore vers le répertoire de travail de session.
`ben_adm2.geojson` (geoBoundaries, 77 communes) est joint.

C'est aussi le point d'entrée si un export officiel MESTFP devient disponible : il suffit de
l'ajouter comme couche supplémentaire dans `assemble.py`, avant la couche OSM, avec `etat: "ouvert"`.
