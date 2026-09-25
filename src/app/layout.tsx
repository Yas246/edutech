import type { Metadata } from "next";
import Link from "next/link";
import { Outfit, Public_Sans } from "next/font/google";
import { utilisateurCourant, nomComplet } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { Cloche } from "@/components/cloche";
import { Drapeau } from "@/components/drapeau";
import { seDeconnecter } from "@/app/deconnexion";
import BarreLaterale from "@/components/shell/barre-laterale";
import TiroirMobile from "@/components/shell/tiroir-mobile";
import LiensNav from "@/components/shell/liens-nav";
import MesEspaces from "@/components/shell/mes-espaces";
import { navigationPour } from "@/components/shell/navigation";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-affichage",
  display: "swap",
});
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-texte",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "EduTech — la plateforme éducative du Bénin",
    template: "%s — EduTech",
  },
  description:
    "EduTech relie élèves, enseignants, parents, établissements et ministère : vie scolaire, bulletins, finances, transport et orientation, partout au Bénin.",
};

/**
 * L'en-tête compact hors connexion (la barre latérale n'a de sens
 * qu'une fois connecté).
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const utilisateur = await utilisateurCourant();

  // La coquille connectée : barre latérale à l'écran large, tiroir et
  // barre du haut sur mobile. Hors connexion : un en-tête compact.
  if (utilisateur) {
    const cloche = <Cloche userId={utilisateur.id} />;

    return (
      <html lang="fr" className={`${outfit.variable} ${publicSans.variable} h-full antialiased`}>
        <body className="min-h-dvh">
          <a href="#contenu" className="evitement">
            Aller au contenu
          </a>
          <div className="lg:grid lg:grid-cols-[264px_1fr]">
            <aside className="hidden w-[264px] shrink-0 border-r border-ligne bg-white lg:sticky lg:top-0 lg:block lg:h-dvh">
              <BarreLaterale utilisateur={utilisateur} cloche={cloche} />
            </aside>
            <div className="flex min-h-dvh flex-col">
              <TiroirMobile
                cloche={cloche}
                contenu={
                  <>
                    <LiensNav groupes={navigationPour(utilisateur.role as Role)} />
                    <MesEspaces utilisateur={utilisateur} />
                  </>
                }
              />
              <main id="contenu" className="flex-1">
                {children}
              </main>
              <footer className="border-t border-ligne bg-white">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-sm text-encre-doux sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2">
                    <Drapeau />
                    <span className="font-medium text-encre">EduTech</span>
                    — la plateforme éducative du Bénin
                  </p>
                  <p>Données d&apos;établissements : recensement national, sources officielles citées.</p>
                </div>
              </footer>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="fr" className={`${outfit.variable} ${publicSans.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        <a href="#contenu" className="evitement">
          Aller au contenu
        </a>
        <header className="border-b border-ligne bg-white">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
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
                    className="rounded-lg px-3 py-2 font-medium text-encre-doux transition hover:bg-vert-clair hover:text-vert-fonce"
                  >
                    <span className="hidden sm:inline">Établissements</span>
                    <span className="sm:hidden">Écoles</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/connexion"
                    className="rounded-lg px-3 py-2 font-medium text-encre-doux transition hover:bg-vert-clair hover:text-vert-fonce"
                  >
                    Connexion
                  </Link>
                </li>
                <li>
                  <Link
                    href="/inscription"
                    className="rounded-lg bg-vert px-3 py-2 font-medium text-white transition hover:bg-vert-fonce"
                  >
                    Créer un compte
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-ligne bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-sm text-encre-doux sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2">
              <Drapeau />
              <span className="font-medium text-encre">EduTech</span>
              — la plateforme éducative du Bénin
            </p>
            <p>Données d&apos;établissements : recensement national, sources officielles citées.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
