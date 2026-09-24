import Link from "next/link";
import type { ReactNode } from "react";
import { IconLogout } from "@tabler/icons-react";
import { libellesRole, type Role } from "@/lib/roles";
import { seDeconnecter } from "@/app/deconnexion";
import LiensNav from "./liens-nav";
import { navigationPour } from "./navigation";

/** Les initiales de la personne, pour l'avatar sans photo. */
function initiales(prenom: string, nom: string) {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

/**
 * La barre latérale du compte connecté : logo et navigation en haut,
 * la place de la personne en bas, avec sa sortie de session.
 */
export default function BarreLaterale({
  role,
  prenom,
  nom,
  cloche,
}: {
  role: Role;
  prenom: string;
  nom: string;
  cloche: ReactNode;
}) {
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
        <span className="text-lg font-bold tracking-tight">
          Edu<span className="text-vert">Tech</span>
        </span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <LiensNav groupes={navigationPour(role)} />
      </div>

      <div className="border-t border-ligne px-3 py-3">
        <Link
          href="/tableau-de-bord"
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-vert-clair"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vert text-sm font-bold text-white">
            {initiales(prenom, nom)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-encre">
              {prenom} {nom}
            </span>
            <span className="block truncate text-xs text-encre-doux">
              {libellesRole[role] ?? role}
            </span>
          </span>
        </Link>
        <div className="mt-1 flex items-center gap-1 px-1 pb-1">
          {cloche}
          <form action={seDeconnecter} className="flex-1">
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
    </div>
  );
}
