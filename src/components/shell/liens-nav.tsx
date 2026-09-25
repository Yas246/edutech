"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconArrowsExchange,
  IconBell,
  IconBuildingBank,
  IconBuildingCommunity,
  IconBus,
  IconCalendarEvent,
  IconCalendarMonth,
  IconChartBar,
  IconCompass,
  IconDoor,
  IconBulb,
  IconKey,
  IconLayoutDashboard,
  IconRss,
  IconSchool,
  IconUserCheck,
  IconUserShield,
  IconUsers,
  IconUsersGroup,
  IconWallet,
  IconMessages,
  type Icon,
} from "@tabler/icons-react";
import { lienActif, type GroupeNav, type IconeNav } from "./navigation";

/** Les clés d'icône traduites en composants Tabler. */
const ICONES: Record<IconeNav, Icon> = {
  tableau: IconLayoutDashboard,
  etablissements: IconBuildingCommunity,
  fil: IconRss,
  messagerie: IconMessages,
  notifications: IconBell,
  coach: IconBulb,
  calendrier: IconCalendarEvent,
  ecole: IconSchool,
  finances: IconWallet,
  assiduite: IconUserCheck,
  transferts: IconArrowsExchange,
  salles: IconDoor,
  agenda: IconCalendarMonth,
  delegations: IconUserShield,
  ministere: IconBuildingBank,
  indicateurs: IconChartBar,
  apprenants: IconUsersGroup,
  orientation: IconCompass,
  transport: IconBus,
  enfants: IconUsers,
  rejoindre: IconKey,
};

/**
 * La liste des liens, partagée par la barre latérale et le tiroir
 * mobile : un seul lien actif à l'écran, le plus long préfixe gagnant.
 */
export default function LiensNav({
  groupes,
  onNavigation,
}: {
  groupes: GroupeNav[];
  onNavigation?: () => void;
}) {
  const chemin = usePathname();
  const actif = lienActif(
    chemin ?? "",
    groupes.flatMap((g) => g.liens),
  );

  return (
    <nav aria-label="Navigation principale" onClick={onNavigation}>
      <ul className="space-y-4">
        {groupes.map((groupe, i) => (
          <li key={groupe.titre ?? `g${i}`}>
            {groupe.titre && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-encre-doux/70">
                {groupe.titre}
              </p>
            )}
            <ul className="space-y-0.5">
              {groupe.liens.map((lien) => {
                const Icône = ICONES[lien.icone];
                const estActif = actif?.href === lien.href;
                return (
                  <li key={lien.href}>
                    <Link
                      href={lien.href}
                      aria-current={estActif ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                        estActif
                          ? "bg-vert font-semibold text-white shadow-sm"
                          : "font-medium text-encre-doux hover:bg-vert-clair hover:text-vert-fonce"
                      }`}
                    >
                      {Icône && <Icône className="h-[18px] w-[18px] shrink-0" stroke={1.7} />}
                      <span>{lien.titre}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
