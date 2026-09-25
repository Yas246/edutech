import Link from "next/link";
import { IconLogout } from "@tabler/icons-react";
import { libellesRole, type Role } from "@/lib/roles";
import { seDeconnecter } from "@/app/deconnexion";
import type { Utilisateur } from "@/lib/auth";
import LiensNav from "./liens-nav";
import MesEspaces from "./mes-espaces";
import { navigationPour } from "./navigation";

/** Les initiales de la personne, pour l'avatar sans photo. */
function initiales(prenom: string, nom: string) {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

/**
 * La barre latérale du compte connecté : le sceau du produit en haut,
 * la navigation au centre, la place de la personne épinglée en bas.
 */
export default function BarreLaterale({ utilisateur }: { utilisateur: Utilisateur }) {
  const role = utilisateur.role as Role;
  const prenom = utilisateur.prenom;
  const nom = utilisateur.nom;

  return (
    <div className="flex h-dvh flex-col">
      <Link
        href="/tableau-de-bord"
        className="flex items-center gap-2.5 border-b border-ligne px-5 py-4"
      >
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
        <span className="text-lg leading-tight font-bold tracking-tight">
          Edu<span className="text-vert">Tech</span>
        </span>
      </Link>

      <div className="scroll-doux flex-1 overflow-y-auto px-3 py-4">
        <LiensNav groupes={navigationPour(role)} />
        <MesEspaces utilisateur={utilisateur} />
      </div>

      <div className="border-t border-ligne px-3 py-3">
        <Link
          href="/mon-espace"
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-vert-clair"
          title="Mon espace : mes informations"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-vert to-vert-fonce text-sm font-bold text-white">
            {initiales(prenom, nom)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-encre">
              {prenom} {nom}
            </span>
            <span className="block truncate text-xs text-discret">
              {libellesRole[role] ?? role} · mon espace
            </span>
          </span>
        </Link>
        <form action={seDeconnecter} className="mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-encre-doux transition hover:bg-rouge-clair hover:text-rouge"
          >
            <IconLogout className="h-[18px] w-[18px]" stroke={1.7} />
            Déconnexion
          </button>
        </form>
      </div>
    </div>
  );
}
