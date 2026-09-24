import type { Metadata } from "next";
import Link from "next/link";
import { utilisateurCourant, nomComplet } from "@/lib/auth";
import { Cloche } from "@/components/cloche";
import { seDeconnecter } from "@/app/deconnexion";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "EduTech — la plateforme éducative du Bénin",
    template: "%s — EduTech",
  },
  description:
    "EduTech relie élèves, enseignants, parents, établissements et ministère : vie scolaire, bulletins, finances, transport et orientation, partout au Bénin.",
};

/**
 * Le drapeau national, conforme à l'article premier de la Constitution :
 * une bande verte sur toute la hauteur aux deux cinquièmes côté hampe,
 * puis deux bandes horizontales égales, jaune en haut, rouge en bas.
 */
function Drapeau() {
  return (
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
  );
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const utilisateur = await utilisateurCourant();

  // Les liens privés dépendent de la place de chacun.
  const liensParRole: Record<string, { href: string; titre: string }[] | undefined> = {
    direction: [
      { href: "/mon-ecole", titre: "Mon école" },
      { href: "/delegations", titre: "Délégations" },
    ],
    ministere: [{ href: "/ministere", titre: "Ministère" }],
    // tous rôles : le fil et la messagerie

    parent: [
      { href: "/mes-enfants", titre: "Mes enfants" },
      { href: "/calendrier", titre: "Calendrier" },
    ],
    enseignant: undefined,
    eleve: [{ href: "/calendrier", titre: "Calendrier" }],
  };
  const liensPrives = utilisateur ? (liensParRole[utilisateur.role] ?? []) : [];

  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a href="#contenu" className="evitement">
          Aller au contenu
        </a>
        <header className="border-b border-ligne bg-white">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <Drapeau />
              <span className="text-lg">
                Edu<span className="text-vert">Tech</span>
              </span>
            </Link>
            <nav aria-label="Navigation principale">
              <ul className="flex items-center gap-1 text-sm">
                <li>
                  <Link
                    href="/etablissements"
                    className="rounded-lg px-3 py-2 text-encre-doux hover:bg-vert-clair hover:text-vert-fonce"
                  >
                    Établissements
                  </Link>
                </li>
                {liensPrives.map((lien) => (
                  <li key={lien.href}>
                    <Link
                      href={lien.href}
                      className="rounded-lg px-3 py-2 font-medium text-vert-fonce hover:bg-vert-clair"
                    >
                      {lien.titre}
                    </Link>
                  </li>
                ))}
                {utilisateur && (
                  <li>
                    <Link
                      href="/coach"
                      className="rounded-lg px-3 py-2 font-medium text-vert-fonce hover:bg-vert-clair"
                    >
                      Coach
                    </Link>
                  </li>
                )}
                {utilisateur && (
                  <li>
                    <Link
                      href="/fil"
                      className="rounded-lg px-3 py-2 font-medium text-vert-fonce hover:bg-vert-clair"
                    >
                      Fil
                    </Link>
                  </li>
                )}
                {utilisateur && utilisateur.role !== "ministere" && (
                  <li>
                    <Link
                      href="/messagerie"
                      className="rounded-lg px-3 py-2 font-medium text-vert-fonce hover:bg-vert-clair"
                    >
                      Messages
                    </Link>
                  </li>
                )}
                {utilisateur && <Cloche userId={utilisateur.id} />}
                {utilisateur ? (
                  <>
                    <li>
                      <Link
                        href="/tableau-de-bord"
                        className="rounded-lg px-3 py-2 font-medium text-vert-fonce hover:bg-vert-clair"
                      >
                        {nomComplet(utilisateur)}
                      </Link>
                    </li>
                    <li>
                      <form action={seDeconnecter}>
                        <button
                          type="submit"
                          className="rounded-lg border border-ligne px-3 py-2 text-encre-doux hover:bg-papier"
                        >
                          Déconnexion
                        </button>
                      </form>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link
                        href="/connexion"
                        className="rounded-lg px-3 py-2 text-encre-doux hover:bg-vert-clair hover:text-vert-fonce"
                      >
                        Connexion
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/inscription"
                        className="rounded-lg bg-vert px-3 py-2 font-medium text-white hover:bg-vert-fonce"
                      >
                        Créer un compte
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </nav>
          </div>
        </header>
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-ligne bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-encre-doux sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2">
              <Drapeau />
              <span className="font-medium text-encre">EduTech</span>
              — la plateforme éducative du Bénin
            </p>
            <p>
              Données d&apos;établissements : recensement national, sources officielles citées.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
