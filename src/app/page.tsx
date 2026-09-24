import Link from "next/link";
import { nombreCommunes, nombreDepartements, nombreEtablissements } from "@/lib/recensement";

const roles = [
  {
    titre: "Élèves",
    texte:
      "Vos notes, vos absences, votre emploi du temps, vos bulletins et un coach qui vous oriente.",
  },
  {
    titre: "Parents",
    texte:
      "Le suivi de chacun de vos enfants en un seul endroit : résultats, présences, échéances de scolarité.",
  },
  {
    titre: "Enseignants",
    texte:
      "Faites l'appel en un instant, saisissez les évaluations, laissez les moyennes se calculer seules.",
  },
  {
    titre: "Établissements",
    texte:
      "Classes, matières, bulletins officiels, recouvrement de la scolarité et annonces à toute la communauté.",
  },
  {
    titre: "Ministère",
    texte:
      "Valide les établissements et lit la nation : effectifs, absentéisme et recouvrement, département par département.",
  },
];

const modules = [
  {
    titre: "Vie scolaire",
    texte:
      "Appel quotidien, évaluations, moyennes pondérées par coefficient et bulletins trimestriels au format béninois.",
  },
  {
    titre: "Famille",
    texte:
      "Un parent suit plusieurs enfants, même dans des classes différentes. L'élève est informé, l'argent reste entre l'école et le parent.",
  },
  {
    titre: "Finances scolaires",
    texte:
      "Frais, factures par tranches, reçus numérotés et paiement par Mobile Money. Le suivi, sans remplacer la comptabilité.",
  },
  {
    titre: "Transport",
    texte:
      "Les lignes de bus, leurs arrêts et le ticket à 200 F, achetable en ligne ou par code USSD pour ceux qui n'ont pas de smartphone.",
  },
];

export default function Accueil() {
  return (
    <>
      {/* Héros */}
      <section className="bg-vert text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-jaune" aria-hidden="true" />
            Recensement chargé : {nombreEtablissements} établissements réels
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Toute l&apos;école béninoise sur une seule plateforme
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85">
            EduTech relie les élèves, les enseignants, les parents, les établissements et le
            ministère : la vie de la classe, les bulletins, la scolarité, le transport et
            l&apos;orientation, même avec une connexion modeste.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/inscription"
              className="rounded-xl bg-jaune px-5 py-3 font-semibold text-encre hover:brightness-95"
            >
              Créer un compte
            </Link>
            <Link
              href="/etablissements"
              className="rounded-xl border border-white/40 px-5 py-3 font-medium text-white hover:bg-white/10"
            >
              Parcourir les établissements
            </Link>
          </div>
        </div>
      </section>

      {/* Chiffres réels du recensement */}
      <section aria-label="Le pays couvert" className="border-b border-ligne bg-white">
        <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-encre-doux">Établissements recensés</dt>
            <dd className="text-3xl font-bold text-vert">{nombreEtablissements}</dd>
          </div>
          <div>
            <dt className="text-sm text-encre-doux">Départements</dt>
            <dd className="text-3xl font-bold text-vert">{nombreDepartements}</dd>
          </div>
          <div>
            <dt className="text-sm text-encre-doux">Communes</dt>
            <dd className="text-3xl font-bold text-vert">{nombreCommunes}</dd>
          </div>
          <div>
            <dt className="text-sm text-encre-doux">Ticket de bus</dt>
            <dd className="text-3xl font-bold text-vert">200 F</dd>
          </div>
        </dl>
      </section>

      {/* Les cinq rôles */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight">Une plateforme, cinq places</h2>
        <p className="mt-2 max-w-2xl text-encre-doux">
          Chacun voit ce qui le concerne, et rien d&apos;autre. Le ministère valide les
          établissements ; l&apos;école fait vivre ses classes ; la famille suit ses enfants.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <li key={r.titre} className="rounded-2xl border border-ligne bg-white p-5">
              <h3 className="font-semibold text-vert-fonce">{r.titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-encre-doux">{r.texte}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Les modules */}
      <section className="border-y border-ligne bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight">Ce que la plateforme fait</h2>
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {modules.map((m) => (
              <div key={m.titre}>
                <h3 className="flex items-center gap-2 font-semibold">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm bg-jaune"
                    aria-hidden="true"
                  />
                  {m.titre}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-encre-doux">{m.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Appel final */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="rounded-2xl bg-vert-clair p-8 sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight text-vert-fonce">
            Votre établissement est peut-être déjà là
          </h2>
          <p className="mt-2 max-w-2xl text-encre-doux">
            Les {nombreEtablissements} établissements du recensement national sont chargés. La
            direction se crée un compte, le ministère valide, et la classe ouvre.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/inscription"
              className="rounded-xl bg-vert px-5 py-3 font-semibold text-white hover:bg-vert-fonce"
            >
              Inscrire mon établissement
            </Link>
            <Link
              href="/etablissements"
              className="rounded-xl border border-vert px-5 py-3 font-medium text-vert-fonce hover:bg-white"
            >
              Voir l&apos;annuaire
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
