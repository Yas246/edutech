import Link from "next/link";
import { redirect } from "next/navigation";
import {
  IconArrowRight,
  IconBuildingCommunity,
  IconBus,
  IconCheck,
  IconDeviceMobile,
  IconShieldLock,
  IconWifiOff,
} from "@tabler/icons-react";
import { utilisateurCourant } from "@/lib/auth";
import { nombreCommunes, nombreDepartements, nombreEtablissements } from "@/lib/recensement";

/**
 * La vitrine : un manifeste, pas une brochure. Elle doit donner au
 * jury l'image globale de l'écosystème en une minute — et chaque
 * chiffre affiché est un chiffre réel de la base.
 */

const acteurs: {
  numero: string;
  titre: string;
  sousTitre: string;
  texte: string;
  donnee: string;
  etat?: boolean;
}[] = [
  {
    numero: "01",
    titre: "Élèves",
    sousTitre: "Le réseau et le savoir",
    texte:
      "Notes au fil de l'eau, devoirs au cahier de textes, fil d'entraide de la classe, et un coach IA qui oriente vers les filières du guide officiel.",
    donnee: "présence et résultats, jour par jour",
  },
  {
    numero: "02",
    titre: "Parents",
    sousTitre: "La confiance et le suivi",
    texte:
      "Assiduité, bulletins dès leur publication, échéances de scolarité dans le calendrier — le lien se prouve par un échange de codes, jamais par un simple nom.",
    donnee: "l'assiduité confirmée par la famille",
  },
  {
    numero: "03",
    titre: "Enseignants",
    sousTitre: "La simplification",
    texte:
      "Appel posé en un clic, notes saisies à la masse, moyennes pondérées par les coefficients officiels calculées toutes seules, bilans aux parents en un fil.",
    donnee: "la note saisie au moment de la note",
  },
  {
    numero: "04",
    titre: "Établissements",
    sousTitre: "Le pilotage scolaire",
    texte:
      "Classes et emplois du temps sans conflit, inscriptions par code, bulletins imprimables, finances transparentes, transferts réglés entre écoles.",
    donnee: "bulletins et finances, à la source",
  },
];

const piliers = [
  {
    icone: IconWifiOff,
    titre: "Pensé pour le terrain",
    texte:
      "Serveur léger, pages rendues côté serveur, zéro gadget : la plateforme reste fluide sur les connexions modestes de l'intérieur du pays.",
  },
  {
    icone: IconDeviceMobile,
    titre: "Finances transparentes",
    texte:
      "Frais découpés en tranches, reçus numérotés, rappels à 14, 7 puis 3 jours — et l'élève informé sans jamais voir un montant. Le paiement Mobile Money est l'étape suivante.",
  },
  {
    icone: IconBus,
    titre: "Mobilité scolaire",
    texte:
      "Lignes réelles, arrêts stratégiques, tickets à 200 F achetables en ligne ou par code USSD pour ceux qui n'ont pas de smartphone.",
  },
  {
    icone: IconShieldLock,
    titre: "Souveraineté & identité",
    texte:
      "Hébergement maîtrisé, données minimales, un compte par personne. Prêt pour l'interopérabilité avec le NPI de l'ANIP : un citoyen, un identifiant, zéro doublon.",
  },
];

export default async function Accueil() {
  // Le compte connecté a son fil pour accueil ; la vitrine est pour
  // ceux qui découvrent.
  const utilisateur = await utilisateurCourant();
  if (utilisateur) redirect("/fil");

  return (
    <>
      {/* Le liseré national : trois couleurs, trois pixels. */}
      <div aria-hidden="true" className="flex h-[3px]">
        <span className="flex-1 bg-vert" />
        <span className="flex-1 bg-jaune" />
        <span className="flex-1 bg-rouge" />
      </div>

      <div className="relative overflow-hidden">
        {/* Le halo émeraude qui donne la profondeur. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 h-[560px] bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,rgba(5,150,105,0.14),transparent)]"
        />

        {/* ============ Le héros ============ */}
        <section className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-14 sm:pt-20">
          <nav
            aria-label="Sections de la page"
            className="mb-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-encre-doux"
          >
            <a href="#ecosysteme" className="transition hover:text-encre">
              L&apos;écosystème
            </a>
            <a href="#realite" className="transition hover:text-encre">
              L&apos;ingénierie
            </a>
            <Link href="/etablissements" className="transition hover:text-encre">
              L&apos;annuaire national
            </Link>
          </nav>

          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                L&apos;écosystème numérique de{" "}
                <span className="bg-linear-to-r from-vert to-teal-700 bg-clip-text text-transparent">
                  l&apos;école béninoise
                </span>
                .
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-encre-doux">
                Plutôt qu&apos;un portail administratif de plus, EduTech engage élèves,
                enseignants, familles et chefs d&apos;établissement : chacun y gagne un service
                concret, et la donnée scolaire remonte toute seule à l&apos;État — fiable,
                continue, exploitable.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#ecosysteme"
                  className="flex items-center gap-2 rounded-xl bg-vert px-5 py-3 font-semibold text-white shadow-xs transition hover:bg-vert-fonce"
                >
                  Découvrir la plateforme
                  <IconArrowRight className="h-[18px] w-[18px]" stroke={1.8} />
                </Link>
                <Link
                  href="/etablissements"
                  className="flex items-center gap-2 rounded-xl border border-ligne bg-white px-5 py-3 font-medium text-encre transition hover:border-vert/40 hover:text-vert-fonce"
                >
                  <IconBuildingCommunity className="h-[18px] w-[18px]" stroke={1.7} />
                  Explorer l&apos;annuaire national
                </Link>
              </div>
            </div>

            {/* La preuve visuelle : un bulletin, dans une fenêtre d'appli. */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-ligne bg-white shadow-lg shadow-slate-900/5">
                <div className="flex items-center gap-1.5 border-b border-ligne px-4 py-3">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-rouge/70" />
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-jaune" />
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-vert" />
                  <span className="ml-3 rounded-md bg-papier px-2.5 py-1 text-[11px] font-medium text-encre-doux">
                    edutech.bj
                  </span>
                </div>
                <div className="flex gap-1 px-4 pt-3 text-[11px] font-medium">
                  <span className="rounded-t-lg bg-vert-clair px-3 py-1.5 text-vert-fonce">
                    Élève
                  </span>
                  <span className="px-3 py-1.5 text-discret">Enseignant</span>
                  <span className="px-3 py-1.5 text-discret">Ministère</span>
                </div>
                <div className="mx-4 mb-4 rounded-xl border border-ligne bg-papier/60 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">Bulletin — Trimestre 1</p>
                    <span className="rounded-full bg-vert-clair px-2 py-0.5 text-[10px] font-semibold text-vert-fonce">
                      Publié
                    </span>
                  </div>
                  <p className="text-[11px] text-discret">Terminale D · Lycée Béhanzin</p>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    {[
                      ["Mathématiques · coeff. 5", "11,40", "text-encre"],
                      ["Physique-Chimie · coeff. 5", "9,60", "text-rouge"],
                      ["SVT · coeff. 5", "14,20", "text-vert-fonce font-semibold"],
                      ["Français · coeff. 4", "12,50", "text-encre"],
                    ].map(([matiere, note, teinte]) => (
                      <div key={matiere} className="flex items-center justify-between gap-3">
                        <dt className="text-encre-doux">{matiere}</dt>
                        <dd className={`rounded-md bg-white px-2 py-0.5 font-semibold tabular-nums ${teinte}`}>
                          {note}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3 flex items-center justify-between border-t border-ligne pt-3">
                    <p className="text-xs text-encre-doux">
                      Moyenne générale
                      <span className="ml-2 text-base font-bold tabular-nums text-encre">
                        11,63
                      </span>
                      <span className="text-discret">/20</span>
                    </p>
                    <span className="rounded-full bg-vert-clair px-2 py-0.5 text-[10px] font-semibold text-vert-fonce">
                      Rang 3
                    </span>
                  </div>
                </div>
                <p className="mx-4 mb-4 flex items-center gap-1.5 rounded-lg bg-vert-clair/70 px-3 py-2 text-[11px] font-medium text-vert-fonce">
                  <IconCheck className="h-3.5 w-3.5" stroke={2} />
                  Calcul automatique pondéré par les coefficients officiels
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ Les chiffres régalien(nne)s ============ */}
        <section aria-label="Le pays couvert" className="relative z-10 mx-auto -mt-10 w-full max-w-5xl px-4">
          <dl className="grid grid-cols-2 gap-6 rounded-2xl border border-ligne bg-white p-6 text-center shadow-xs md:grid-cols-4">
            <div>
              <dd className="text-3xl font-extrabold tabular-nums tracking-tight text-encre">
                {nombreEtablissements}
              </dd>
              <dt className="mt-1 text-xs text-encre-doux">
                Établissements recensés
                <span className="block text-discret">publics et privés</span>
              </dt>
            </div>
            <div>
              <dd className="text-3xl font-extrabold tabular-nums tracking-tight text-encre">
                {nombreDepartements}
              </dd>
              <dt className="mt-1 text-xs text-encre-doux">
                Départements couverts
                <span className="block text-discret">de l&apos;Alibori au Littoral</span>
              </dt>
            </div>
            <div>
              <dd className="text-3xl font-extrabold tabular-nums tracking-tight text-encre">
                {nombreCommunes}
                <span className="text-lg text-discret">/77</span>
              </dd>
              <dt className="mt-1 text-xs text-encre-doux">
                Communes représentées
                <span className="block text-discret">le maillage se complète</span>
              </dt>
            </div>
            <div>
              <dd className="text-3xl font-extrabold tabular-nums tracking-tight text-encre">
                5
              </dd>
              <dt className="mt-1 text-xs text-encre-doux">
                Acteurs sur une seule plateforme
                <span className="block text-discret">élève, parent, professeur, école, État</span>
              </dt>
            </div>
          </dl>
        </section>

        {/* ============ L'écosystème : les acteurs, en manifeste ============ */}
        <section id="ecosysteme" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 py-20">
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight">
            Un écosystème, cinq acteurs — et la donnée remonte toute seule.
          </h2>
          <p className="mt-3 max-w-2xl text-encre-doux">
            Le secret n&apos;est pas de demander aux gens de saisir : c&apos;est de leur donner
            envie d&apos;utiliser. Chacun y gagne un service ; l&apos;État récupère une donnée
            continue, vérifiée par la vie réelle des classes.
          </p>

          <dl className="mt-10">
            {acteurs.map((a) => (
              <div
                key={a.numero}
                className="grid gap-2 border-t border-ligne py-7 sm:grid-cols-12 sm:gap-6"
              >
                <dt className="sm:col-span-4">
                  <span className="text-xs font-bold tabular-nums text-discret">{a.numero}</span>
                  <h3 className="mt-1 text-xl font-bold tracking-tight text-encre">{a.titre}</h3>
                  <p className="text-xs font-medium uppercase tracking-wide text-discret">
                    {a.sousTitre}
                  </p>
                </dt>
                <dd className="text-sm leading-relaxed text-encre-doux sm:col-span-5">{a.texte}</dd>
                <dd className="text-sm leading-relaxed sm:col-span-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-vert-fonce">
                    L&apos;État y gagne
                  </span>
                  <span className="text-encre">{a.donnee}.</span>
                </dd>
              </div>
            ))}
          </dl>

          {/* Le cinquième acteur : lui, il ne saisit rien — il lit. */}
          <div className="mt-4 rounded-2xl bg-encre p-7 sm:p-9">
            <div className="grid gap-5 sm:grid-cols-12 sm:gap-6">
              <div className="sm:col-span-4">
                <span className="text-xs font-bold tabular-nums text-vert">05</span>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-white">Ministère</h3>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  La tour de contrôle nationale
                </p>
              </div>
              <p className="text-sm leading-relaxed text-slate-300 sm:col-span-5">
                Carte scolaire des 12 départements, détection précoce de l&apos;abandon, besoins
                d&apos;enseignement commune par commune, listes prêtes pour l&apos;Office du
                Baccalauréat et la DEC : la nation se lit en direct, sans attendre le rapport
                papier.
              </p>
              <p className="text-sm leading-relaxed sm:col-span-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-vert">
                  L&apos;État y gagne
                </span>
                <span className="text-slate-200">
                  tout ce que les quatre autres acteurs utilisent déjà.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* ============ La réalité du terrain : la plaque technique ============ */}
        <section id="realite" className="scroll-mt-16 border-y border-ligne bg-white/70">
          <div className="mx-auto w-full max-w-6xl px-4 py-20">
            <h2 className="max-w-3xl text-3xl font-bold tracking-tight">
              Une ingénierie adaptée aux écoles béninoises.
            </h2>
            <div className="mt-9 grid overflow-hidden rounded-2xl border border-ligne bg-white sm:grid-cols-2">
              {piliers.map((p, i) => (
                <article
                  key={p.titre}
                  className={`p-6 ${i < 2 ? "sm:border-b" : ""} ${i % 2 === 0 ? "sm:border-r" : ""} border-ligne`}
                >
                  <h3 className="flex items-center gap-2.5 font-bold tracking-tight text-encre">
                    <p.icone className="h-[18px] w-[18px] text-vert" stroke={1.7} />
                    {p.titre}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-encre-doux">{p.texte}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============ L'appel institutionnel ============ */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="relative overflow-hidden rounded-3xl bg-encre px-6 py-14 text-center sm:px-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_50%_120%,rgba(5,150,105,0.35),transparent)]"
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white">
                Votre établissement figure déjà dans la base nationale.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-300">
                Les {nombreEtablissements} écoles du recensement officiel sont chargées. La
                direction crée son compte, le ministère valide, et la classe ouvre — en quelques
                clics.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/inscription"
                  className="rounded-xl bg-vert px-6 py-3 font-semibold text-white transition hover:bg-vert-fonce"
                >
                  Inscrire mon établissement
                </Link>
                <Link
                  href="/etablissements"
                  className="rounded-xl border border-slate-600 px-6 py-3 font-medium text-white transition hover:border-slate-400 hover:bg-white/5"
                >
                  Vérifier la présence de mon école
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ============ Le pied de page officiel (cette page) ============ */}
        <footer className="border-t border-ligne bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-10">
            <p className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="inline-flex h-5 w-[30px] overflow-hidden rounded-[3px] border border-black/10"
              >
                <span className="h-full w-2/5 bg-vert" />
                <span className="flex h-full w-3/5 flex-col">
                  <span className="h-1/2 w-full bg-jaune" />
                  <span className="h-1/2 w-full bg-rouge" />
                </span>
              </span>
              <span className="text-lg font-bold tracking-tight">
                Edu<span className="text-vert">Tech</span>
              </span>
            </p>
            <p className="mt-2 max-w-xl text-sm text-encre-doux">
              Plateforme numérique pour l&apos;éducation et la vie scolaire en République du
              Bénin. Données d&apos;établissements issues du recensement national, sources
              officielles citées.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Institutions de référence">
              {[
                "Ministère du Numérique et de la Digitalisation",
                "MESTFP",
                "MEMP",
                "Office du Baccalauréat",
                "ANIP",
              ].map((i) => (
                <li
                  key={i}
                  className="rounded-full border border-ligne bg-papier px-3 py-1 text-xs font-medium text-encre-doux"
                >
                  {i}
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-ligne/70 pt-4 text-xs text-discret">
              Conforme aux exigences de protection des données personnelles (APDP Bénin) —
              données minimales, usage pédagogique, aucun partage commercial.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
