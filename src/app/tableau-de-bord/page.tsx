import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  inscriptions,
  journal,
  publications,
  transferts,
} from "@/db/schema";
import { exiger, nomComplet, type Utilisateur } from "@/lib/auth";
import { libellesRole } from "@/lib/roles";
import { orienter } from "@/lib/orientation";
import type { Role } from "@/lib/roles";
import {
  assiduiteEnseignants,
  pariteGenre,
  statistiquesDepartement,
} from "@/lib/outils/ministere";
import {
  absencesRecentes,
  mesClasses,
  monAssiduite,
} from "@/lib/outils/enseignant";
import {
  apprenantsARisque,
  listeRetards,
  resumeFinances,
} from "@/lib/outils/direction";
import { prochainesEcheances, situationEnfant } from "@/lib/outils/famille";
import { etablissements } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mon espace" };

/* ------------------------------ briques ------------------------------ */

function Indicateur({ titre, valeur, ton = "" }: { titre: string; valeur: string; ton?: string }) {
  return (
    <div className="rounded-2xl border border-ligne bg-white p-4">
      <p className="text-xs text-encre-doux">{titre}</p>
      <p className={`text-2xl font-bold ${ton}`}>{valeur}</p>
    </div>
  );
}

function Widget({
  titre,
  lien,
  libelleLien = "Tout voir",
  children,
}: {
  titre: string;
  lien?: string;
  libelleLien?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ligne bg-white p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{titre}</h2>
        {lien && (
          <Link href={lien} className="text-xs font-medium text-vert underline hover:text-vert-fonce">
            {libelleLien}
          </Link>
        )}
      </div>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

function Vide({ texte }: { texte: string }) {
  return <p className="text-encre-doux">{texte}</p>;
}

function Ligne({ gauche, droite, ton = "" }: { gauche: React.ReactNode; droite: React.ReactNode; ton?: string }) {
  return (
    <p className="flex justify-between gap-3 py-1">
      <span className="min-w-0">{gauche}</span>
      <span className={`shrink-0 text-right font-medium ${ton}`}>{droite}</span>
    </p>
  );
}

function compteOutil(utilisateur: Utilisateur) {
  return { ...utilisateur, role: utilisateur.role as Role };
}

function pourcent(v: number | null) {
  return v === null ? "—" : `${String(v).replace(".", ",")} %`;
}

function jour(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/* ------------------------------ DIRECTION ------------------------------ */

async function TableauDirection(utilisateur: Utilisateur) {
  const [ecole] = await db
    .select({ id: etablissements.id, nom: etablissements.nom })
    .from(etablissements)
    .where(eq(etablissements.directionUserId, utilisateur.id))
    .limit(1);

  const [resume, risques, retards] = await Promise.all([
    resumeFinances(compteOutil(utilisateur)),
    apprenantsARisque(compteOutil(utilisateur)),
    listeRetards(compteOutil(utilisateur)),
  ]);

  const [effectifs] = ecole
    ? await db
        .select({ n: sql<number>`count(*)` })
        .from(sql`inscriptions i JOIN classes c ON c.id = i.classe_id`)
        .where(sql`c.etablissement_id = ${ecole.id}`)
    : [{ n: 0 }];

  const [absencesDuJour] = ecole
    ? await db
        .select({ n: sql<number>`count(*)` })
        .from(sql`presences p JOIN classes c ON c.id = p.classe_id`)
        .where(sql`c.etablissement_id = ${ecole.id} AND p.date = CURRENT_DATE AND p.statut = 'absent'`)
    : [{ n: 0 }];

  const [transfertsAttente] = ecole
    ? await db
        .select({ n: sql<number>`count(*)` })
        .from(transferts)
        .where(
          sql`(transferts.etablissement_depart = ${ecole.id} OR transferts.etablissement_arrivee = ${ecole.id})
            AND transferts.statut = 'demande'`,
        )
    : [{ n: 0 }];

  const annonces = ecole
    ? await db
        .select({
          id: publications.id,
          contenu: publications.contenu,
          date: publications.createdAt,
          auteurPrenom: sql<string>`(SELECT prenom FROM users WHERE id = publications.auteur_user_id)`,
          auteurNom: sql<string>`(SELECT nom FROM users WHERE id = publications.auteur_user_id)`,
        })
        .from(publications)
        .where(and(eq(publications.porteeType, "etablissement"), eq(publications.porteeId, ecole.id)))
        .orderBy(desc(publications.id))
        .limit(3)
    : [];

  const operations = ecole
    ? await db
        .select({
          action: journal.action,
          detail: journal.detail,
          date: journal.createdAt,
          auteurPrenom: sql<string>`(SELECT prenom FROM users WHERE id = journal.auteur_user_id)`,
        })
        .from(journal)
        .where(eq(journal.etablissementId, ecole.id))
        .orderBy(desc(journal.id))
        .limit(5)
    : [];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur titre="Effectifs" valeur={String(Number(effectifs.n))} />
        <Indicateur titre="Recouvrement" valeur={`${String(resume?.tauxRecouvrement ?? 0).replace(".", ",")} %`} />
        <Indicateur titre="Absences du jour" valeur={String(Number(absencesDuJour.n))} ton={Number(absencesDuJour.n) > 0 ? "text-rouge" : ""} />
        <Indicateur titre="Transferts en attente" valeur={String(Number(transfertsAttente.n))} />
      </div>

      <section className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href="/mon-ecole/assiduite" className="rounded-xl bg-vert px-4 py-2 font-medium text-white hover:bg-vert-fonce">
          Pointer l&apos;assiduité
        </Link>
        <Link href="/finances" className="rounded-xl border border-ligne bg-white px-4 py-2 font-medium hover:bg-papier">
          Poser un frais
        </Link>
        <Link href="/fil" className="rounded-xl border border-ligne bg-white px-4 py-2 font-medium hover:bg-papier">
          Publier une annonce
        </Link>
        <Link href="/mon-ecole" className="rounded-xl border border-ligne bg-white px-4 py-2 font-medium hover:bg-papier">
          Gérer les classes
        </Link>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Widget titre="Finances" lien="/finances">
          {resume ? (
            <>
              <Ligne gauche="Facturé" droite={`${String(resume.montantFacture).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F`} />
              <Ligne gauche="Encaissé" droite={`${String(resume.montantPaye).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F`} ton="text-vert-fonce" />
              <Ligne gauche="Factures en retard" droite={String(resume.facturesEnRetard)} ton={resume.facturesEnRetard > 0 ? "text-rouge" : ""} />
              {retards && retards.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-ligne/60 pt-2">
                  {retards.slice(0, 3).map((r) => (
                    <li key={r.numero} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{r.eleve} · {r.numero}</span>
                      <span className="shrink-0 text-rouge">{String(r.restant).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Vide texte="Aucun établissement rattaché." />
          )}
        </Widget>

        <Widget titre="Élèves à suivre" lien="/mon-ecole">
          {risques && risques.length > 0 ? (
            <ul className="space-y-1.5">
              {risques.slice(0, 5).map((r) => (
                <li key={r.eleve} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {r.eleve} <span className="text-encre-doux">· {r.classe}</span>
                  </span>
                  <span className="shrink-0">
                    {r.moyenne !== null ? `${String(r.moyenne).replace(".", ",")}/20` : "—"}{" "}
                    <span className="text-encre-doux">· {r.absences} abs.</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Vide texte="Aucun élève sous le seuil : bravo à l'équipe." />
          )}
        </Widget>

        <Widget titre="Dernières annonces" lien="/fil">
          {annonces.length === 0 ? (
            <Vide texte="Aucune annonce publiée." />
          ) : (
            <ul className="space-y-2">
              {annonces.map((a) => (
                <li key={a.id} className="border-b border-ligne/60 pb-2 last:border-0">
                  <p className="line-clamp-2">{a.contenu}</p>
                  <p className="text-xs text-encre-doux">
                    {a.auteurPrenom} {a.auteurNom} · {jour(a.date.toISOString().slice(0, 10))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget titre="Journal des opérations" lien="/finances">
          {operations.length === 0 ? (
            <Vide texte="Aucune opération enregistrée." />
          ) : (
            <ul className="space-y-1.5">
              {operations.map((o, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {o.action} {o.detail ? `— ${o.detail}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-encre-doux">
                    {jour(o.date.toISOString().slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </>
  );
}

/* ------------------------------ MINISTÈRE ------------------------------ */

async function TableauMinistere() {
  const [ecoles, parite, assiduite, stats] = await Promise.all([
    db
      .select({ statut: etablissements.statut, n: sql<number>`count(*)` })
      .from(etablissements)
      .groupBy(etablissements.statut),
    pariteGenre({}),
    assiduiteEnseignants({}),
    statistiquesDepartement(),
  ]);

  const nb = (s: string) => Number(ecoles.find((e) => e.statut === s)?.n ?? 0);
  const topDepartements = [...stats].sort((a, b) => b.eleves - a.eleves).slice(0, 5);

  const file = await db
    .select({ id: etablissements.id, nom: etablissements.nom, commune: etablissements.commune })
    .from(etablissements)
    .where(eq(etablissements.statut, "en_attente"))
    .orderBy(etablissements.nom)
    .limit(5);

  const derniersTransferts = await db
    .select({
      statut: transferts.statut,
      depart: transferts.etablissementDepart,
      arrivee: transferts.etablissementArrivee,
    })
    .from(transferts)
    .orderBy(desc(transferts.id))
    .limit(3);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicateur titre="Écoles validées" valeur={String(nb("valide"))} ton="text-vert-fonce" />
        <Indicateur titre="En attente" valeur={String(nb("en_attente"))} />
        <Indicateur titre="Apprenants" valeur={String(parite.filles + parite.garcons + parite.nonRenseigne)} />
        <Indicateur titre="Parité F/G" valeur={`${parite.filles}/${parite.garcons}`} />
        <Indicateur titre="Assiduité des enseignants" valeur={pourcent(assiduite.tauxGlobal)} />
      </div>

      <section className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link href="/ministere" className="rounded-xl bg-vert px-4 py-2 font-medium text-white hover:bg-vert-fonce">
          Valider les écoles
        </Link>
        <Link href="/ministere/indicateurs" className="rounded-xl border border-ligne bg-white px-4 py-2 font-medium hover:bg-papier">
          Indicateurs nationaux
        </Link>
        <Link href="/ministere/apprenants" className="rounded-xl border border-ligne bg-white px-4 py-2 font-medium hover:bg-papier">
          Consulter les apprenants
        </Link>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Widget titre="File de validation" lien="/ministere">
          {file.length === 0 ? (
            <Vide texte="Aucune école en attente." />
          ) : (
            <ul className="space-y-1.5">
              {file.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{e.nom}</span>
                  <span className="shrink-0 text-encre-doux">{e.commune}</span>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget titre="Départements les plus peuplés" lien="/ministere/indicateurs">
          {topDepartements.length === 0 ? (
            <Vide texte="Aucun effectif recensé." />
          ) : (
            <ul className="space-y-1.5">
              {topDepartements.map((d) => (
                <li key={d.departement} className="flex justify-between gap-2">
                  <span>{d.departement}</span>
                  <span className="font-medium">{d.eleves} élèves</span>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget titre="Transferts récents" lien="/ministere">
          {derniersTransferts.length === 0 ? (
            <Vide texte="Aucun transfert : les mouvements entre écoles apparaîtront ici." />
          ) : (
            <ul className="space-y-1.5">
              {derniersTransferts.map((t, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    École #{t.depart} → école #{t.arrivee}
                  </span>
                  <span className={`shrink-0 ${t.statut === "valide" ? "text-vert-fonce" : t.statut === "refuse" ? "text-rouge" : ""}`}>
                    {t.statut === "valide" ? "accepté" : t.statut === "refuse" ? "refusé" : "en attente"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget titre="Assiduité des enseignants" lien="/ministere/indicateurs">
          {assiduite.parEnseignant.length === 0 ? (
            <Vide texte="Aucun pointage reçu pour l'instant." />
          ) : (
            <ul className="space-y-1.5">
              {assiduite.parEnseignant.slice(0, 5).map((a) => (
                <li key={`${a.prenom}-${a.nom}`} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {a.prenom} {a.nom} <span className="text-encre-doux">· {a.etablissement}</span>
                  </span>
                  <span className="shrink-0 font-medium">{pourcent(a.taux)}</span>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </>
  );
}

/* ------------------------------ ENSEIGNANT ------------------------------ */

async function TableauEnseignant(utilisateur: Utilisateur) {
  const [mesCours, monPointage, absences] = await Promise.all([
    mesClasses(compteOutil(utilisateur)),
    monAssiduite(compteOutil(utilisateur)),
    absencesRecentes(compteOutil(utilisateur)),
  ]);

  // Les évaluations de mes classes dont les notes sont incomplètes.
  const evaluations = mesCours.length
    ? await db
        .select({
          id: sql<number>`e.id`,
          titre: sql<string>`e.titre`,
          classe: sql<string>`c.nom`,
          saisis: sql<number>`(SELECT count(*) FROM notes n WHERE n.evaluation_id = e.id)`,
          attendus: sql<number>`(SELECT count(*) FROM inscriptions i WHERE i.classe_id = e.classe_id)`,
        })
        .from(sql`evaluations e JOIN classes c ON c.id = e.classe_id`)
        .where(sql`e.classe_id IN ${mesCours.map((c) => c.id)}`)
        .orderBy(sql`e.date DESC`)
        .limit(6)
    : [];
  const incompletes = evaluations.filter((e) => Number(e.saisis) < Number(e.attendus));

  return (
    <>
      {mesCours.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2">
          {mesCours.map((c) => (
            <article key={c.id} className="rounded-2xl border border-ligne bg-white p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{c.nom}</h2>
                <span className="text-sm text-encre-doux">{c.effectifs} élèves</span>
              </div>
              <p className="text-xs text-encre-doux">{c.matieres.join(", ")}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Link href={`/classes/${c.id}/appel`} className="rounded-lg bg-vert px-3 py-1.5 font-medium text-white hover:bg-vert-fonce">
                  Faire l&apos;appel
                </Link>
                <Link href={`/classes/${c.id}/evaluations`} className="rounded-lg border border-ligne px-3 py-1.5 font-medium hover:bg-papier">
                  Évaluations
                </Link>
                <Link href={`/classes/${c.id}/bulletins`} className="rounded-lg border border-ligne px-3 py-1.5 font-medium hover:bg-papier">
                  Bulletins
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Widget titre="Mon pointage (30 jours)" lien="/mon-ecole/assiduite" libelleLien="Voir l'écran">
          <Ligne gauche="Présences" droite={monPointage.presents} ton="text-vert-fonce" />
          <Ligne gauche="Retards" droite={monPointage.retards} />
          <Ligne gauche="Absences" droite={monPointage.absents} ton={monPointage.absents > 0 ? "text-rouge" : ""} />
          <p className="mt-2 border-t border-ligne/60 pt-2 font-semibold">
            Taux : {monPointage.taux === null ? "—" : pourcent(monPointage.taux)}
          </p>
        </Widget>

        <Widget titre="Évaluations incomplètes">
          {incompletes.length === 0 ? (
            <Vide texte="Toutes les notes sont saisies." />
          ) : (
            <ul className="space-y-1.5">
              {incompletes.slice(0, 4).map((e) => (
                <li key={Number(e.id)} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{e.titre} · {e.classe}</span>
                  <span className="shrink-0 text-rouge">{Number(e.attendus) - Number(e.saisis)} manquantes</span>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget titre="Absences récentes (mes classes)">
          {absences.length === 0 ? (
            <Vide texte="Aucune absence signalée." />
          ) : (
            <ul className="space-y-1.5">
              {absences.slice(0, 5).map((a, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{a.eleve}</span>
                  <span className={`shrink-0 ${a.statut === "absent" ? "text-rouge" : ""}`}>
                    {a.statut} · {jour(a.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </>
  );
}

/* ------------------------------ ÉLÈVE ------------------------------ */

async function TableauEleve(utilisateur: Utilisateur) {
  const situations = await situationEnfant(compteOutil(utilisateur));
  const ma = situations[0];
  const [code] = await db
    .select({ code: sql<string>`code` })
    .from(sql`codes_eleve`)
    .where(sql`eleve_user_id = ${utilisateur.id}`)
    .limit(1);
  const familles = orienter(utilisateur.interets);

  const [inscription] = await db
    .select({ classeId: inscriptions.classeId })
    .from(inscriptions)
    .where(eq(inscriptions.eleveUserId, utilisateur.id))
    .limit(1);

  const devoirsAVenir = inscription
    ? await db
        .select({
          id: devoirsId(),
          titre: sql<string>`d.titre`,
          matiere: sql<string>`m.nom`,
          aRendreLe: sql<string>`d.a_rendre_le`,
          classeNom: sql<string>`c.nom`,
        })
        .from(sql`devoirs d JOIN matieres m ON m.id = d.matiere_id JOIN classes c ON c.id = d.classe_id`)
        .where(sql`d.classe_id = ${inscription.classeId} AND d.a_rendre_le >= CURRENT_DATE`)
        .orderBy(sql`d.a_rendre_le`)
        .limit(5)
    : [];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur titre="Ma classe" valeur={ma?.classe ?? "—"} />
        <Indicateur titre="Moyenne générale" valeur={ma?.moyenne === null || ma?.moyenne === undefined ? "—" : `${String(ma.moyenne).replace(".", ",")}/20`} />
        <Indicateur titre="Absences non justifiées" valeur={String(ma?.absences ?? 0)} ton={(ma?.absences ?? 0) > 0 ? "text-rouge" : ""} />
        <Indicateur titre="Retards" valeur={String(ma?.retards ?? 0)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Widget titre="Mes devoirs à venir" lien="/fil" libelleLien="Dans le fil">
          {(devoirsAVenir ?? []).length === 0 ? (
            <Vide texte="Aucun devoir à venir." />
          ) : (
            <ul className="space-y-1.5">
              {(devoirsAVenir ?? []).map((d) => (
                <li key={Number(d.id)} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{d.matiere}</span> · {d.titre}
                  </span>
                  <span className="shrink-0 font-medium text-vert-fonce">{jour(String(d.aRendreLe))}</span>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget titre="Ma boussole d'orientation" lien="/orientation">
          {familles.length === 0 ? (
            <Vide texte="Déclarez vos centres d'intérêt pour recevoir des pistes." />
          ) : (
            <ul className="space-y-1.5">
              {familles.slice(0, 3).map((f) => (
                <li key={f.famille} className="flex justify-between gap-2">
                  <span className="font-medium">{f.famille}</span>
                  <span className="text-encre-doux">{f.metiers.slice(0, 2).join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget titre="Mon code famille" lien="/mon-code">
          {code ? (
            <>
              <p className="rounded-lg border border-vert/30 bg-vert-clair/60 px-3 py-2 text-center font-mono text-lg font-bold tracking-widest text-vert-fonce">
                {code.code}
              </p>
              <p className="mt-2 text-xs text-encre-doux">
                À donner à votre parent : son suivi de vos notes s&apos;ouvre
                avec ce code.
              </p>
            </>
          ) : (
            <Vide texte="Votre code n'est pas encore généré." />
          )}
        </Widget>
      </div>
    </>
  );
}

function devoirsId() {
  return sql<number>`d.id`;
}

/* ------------------------------ PARENT ------------------------------ */

async function TableauParent(utilisateur: Utilisateur) {
  const situations = await situationEnfant(compteOutil(utilisateur));
  const echeances = await prochainesEcheances(compteOutil(utilisateur));

  return (
    <>
      <div className="space-y-4">
        {situations.map((s) => (
          <article key={s.enfant} className="rounded-2xl border border-ligne bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{s.enfant}</h2>
              <p className="text-sm text-encre-doux">{s.classe}</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-encre-doux">Moyenne</p>
                <p className="text-xl font-bold">{s.moyenne === null ? "—" : `${String(s.moyenne).replace(".", ",")}/20`}</p>
              </div>
              <div>
                <p className="text-xs text-encre-doux">Absences</p>
                <p className={`text-xl font-bold ${s.absences > 0 ? "text-rouge" : ""}`}>{s.absences}</p>
              </div>
              <div>
                <p className="text-xs text-encre-doux">Retards</p>
                <p className="text-xl font-bold">{s.retards}</p>
              </div>
            </div>
            {s.devoirsSemaine.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-ligne/60 pt-2 text-sm">
                {s.devoirsSemaine.map((d) => (
                  <li key={d.titre} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{d.matiere}</span> · {d.titre}
                    </span>
                    <span className="shrink-0 text-encre-doux">pour le {jour(d.aRendreLe)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
        {situations.length === 0 && (
          <Widget titre="Aucun enfant relié" lien="/mes-enfants" libelleLien="Déclarer">
            <Vide texte="Déclarez votre enfant, puis croisez vos codes pour ouvrir le suivi." />
          </Widget>
        )}
      </div>

      <div className="mt-6">
        <Widget titre="Prochaines échéances de scolarité" lien="/mes-finances">
          {echeances.length === 0 ? (
            <Vide texte="Aucune échéance à venir." />
          ) : (
            <ul className="space-y-1.5">
              {echeances.slice(0, 5).map((e, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{e.enfant}</span> · {e.frais}
                  </span>
                  <span className="shrink-0">
                    {String(e.montant).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F{" "}
                    <span className="text-encre-doux">· le {jour(e.echeance)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>
    </>
  );
}

/* ------------------------------ la page ------------------------------ */

export default async function TableauDeBord() {
  const utilisateur = await exiger();
  const heure = new Date().getHours();
  const salutation = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";

  const sousTitre =
    utilisateur.role === "eleve"
      ? "Votre situation, vos devoirs et votre orientation, en un coup d'œil."
      : utilisateur.role === "parent"
        ? "Le suivi de vos enfants : résultats, présences, échéances."
        : utilisateur.role === "enseignant"
          ? "Vos classes et votre quotidien de salle de classe."
          : utilisateur.role === "direction"
            ? "L'état de votre établissement, maintenant."
            : "La nation, maintenant.";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <p className="text-sm font-medium text-vert">{libellesRole[utilisateur.role]}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        {salutation}, {nomComplet(utilisateur)}
      </h1>
      <p className="mt-2 max-w-2xl text-encre-doux">{sousTitre}</p>

      <div className="mt-8">
        {utilisateur.role === "direction" && (await TableauDirection(utilisateur))}
        {utilisateur.role === "ministere" && (await TableauMinistere())}
        {utilisateur.role === "enseignant" && (await TableauEnseignant(utilisateur))}
        {utilisateur.role === "eleve" && (await TableauEleve(utilisateur))}
        {utilisateur.role === "parent" && (await TableauParent(utilisateur))}
      </div>
    </div>
  );
}
