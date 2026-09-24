import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { etablissements, inscriptions, liensFamille } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { Bouton } from "@/components/ui/formulaire";
import { terminer } from "./actions";

export const metadata: Metadata = { title: "Premiers pas" };

export default async function PremiersPas() {
  const utilisateur = await exiger();

  // Ce que le compte a déjà, pour un parcours honnête.
  let etapes: { titre: string; fait: boolean; lien: { href: string; label: string } | null }[] = [];

  if (utilisateur.role === "direction") {
    const [ecole] = await db
      .select({ id: etablissements.id })
      .from(etablissements)
      .where(eq(etablissements.directionUserId, utilisateur.id))
      .limit(1);
    etapes = [
      {
        titre: "Votre école est rattachée à votre compte",
        fait: Boolean(ecole),
        lien: ecole ? null : { href: "/inscription", label: "Inscrire mon école" },
      },
      {
        titre: "Créez vos classes et posez le programme",
        fait: false,
        lien: { href: "/mon-ecole", label: "Ouvrir mon école" },
      },
      {
        titre: "Confiez des rôles : finances, vie scolaire, emploi du temps",
        fait: false,
        lien: { href: "/delegations", label: "Ouvrir les délégations" },
      },
    ];
  }

  if (utilisateur.role === "parent") {
    const enfants = await db
      .select({ id: liensFamille.id })
      .from(liensFamille)
      .where(eq(liensFamille.parentUserId, utilisateur.id));
    etapes = [
      {
        titre: "Reliez votre premier enfant à votre compte",
        fait: enfants.length > 0,
        lien: { href: "/mes-enfants", label: "Relier un enfant" },
      },
      {
        titre: "Suivez notes, présences et échéances depuis votre tableau de bord",
        fait: false,
        lien: { href: "/tableau-de-bord", label: "Voir mon espace" },
      },
    ];
  }

  if (utilisateur.role === "eleve") {
    const [inscription] = await db
      .select({ id: inscriptions.id })
      .from(inscriptions)
      .where(eq(inscriptions.eleveUserId, utilisateur.id))
      .limit(1);
    etapes = [
      {
        titre: "Votre classe vous attend : la direction vous inscrit",
        fait: Boolean(inscription),
        lien: inscription ? null : { href: "/tableau-de-bord", label: "Voir mon espace" },
      },
      {
        titre: "Choisissez vos centres d'intérêts : votre coach s'en servira",
        fait: utilisateur.interets !== "",
        lien: null,
      },
    ];
  }

  if (utilisateur.role === "enseignant") {
    etapes = [
      {
        titre: "La direction vous confiera vos matières",
        fait: false,
        lien: { href: "/tableau-de-bord", label: "Voir mon espace" },
      },
    ];
  }

  const dejaFait = utilisateur.onboardingFait;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <EnTetePage
        titre={`Bienvenue sur EduTech, ${utilisateur.prenom}`}
        sousTitre="Trois minutes pour préparer votre espace. Vous pouvez passer et revenir plus tard."
      />

      <ol className="mt-8 space-y-3">
        {etapes.map((etape, i) => (
          <li key={i} className="flex items-start gap-3 rounded-2xl border border-ligne bg-white p-4">
            <span
              className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-sm font-semibold ${
                etape.fait ? "bg-vert text-white" : "bg-jaune text-encre"
              }`}
              aria-hidden="true"
            >
              {etape.fait ? "✓" : i + 1}
            </span>
            <div className="flex-1">
              <p className="font-medium">{etape.titre}</p>
              {etape.lien && (
                <Link
                  href={etape.lien.href}
                  className="mt-1 inline-block text-sm font-medium text-vert underline hover:text-vert-fonce"
                >
                  {etape.lien.label}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {utilisateur.role === "eleve" && (
        <details className="mt-6 rounded-2xl border border-ligne bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Mes centres d&apos;intérêts
          </summary>
          <form action={terminer} className="mt-3 space-y-2 text-sm">
            <input type="hidden" name="interets" value="" />
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="sciences" /> Sciences et expériences
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="arts" /> Dessin, arts et musique
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="sport" /> Sport
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="lettres" /> Lecture et écriture
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="technologie" /> Informatique et technologie
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="agriculture" /> Agriculture et nature
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="commerce" /> Commerce et gestion
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="sante" /> Santé et aide aux autres
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="construction" /> Bâtir et réparer
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="droit" /> Défendre et organiser
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="interets" value="voyage" /> Voyager et découvrir
            </label>
            <Bouton type="submit">Enregistrer et terminer</Bouton>
          </form>
        </details>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <form action={terminer}>
          <button
            type="submit"
            className="rounded-xl bg-vert px-5 py-2.5 font-medium text-white hover:bg-vert-fonce"
          >
            Terminer l&apos;accueil guidé
          </button>
        </form>
        <Link
          href="/tableau-de-bord"
          className="rounded-xl border border-ligne bg-white px-5 py-2.5 font-medium hover:bg-papier"
        >
          Passer pour l&apos;instant
        </Link>
      </div>

      {dejaFait && (
        <p className="mt-4 text-sm text-encre-doux">
          Vous avez déjà parcouru ces étapes : elles restent ici pour mémoire.
        </p>
      )}
    </div>
  );
}

