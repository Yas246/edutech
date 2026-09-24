"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { IconMenu2, IconX } from "@tabler/icons-react";

/**
 * La barre du haut sur mobile et le tiroir qui l'accompagne : le
 * contenu de la navigation est rendu côté serveur, seul l'ouverture
 * est gérée ici. Le tiroir se ferme à la navigation, à Échap, ou en
 * touchant le voile.
 */
export default function TiroirMobile({
  cloche,
  contenu,
}: {
  cloche: ReactNode;
  contenu: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  const panneau = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("keydown", fermer);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fermer);
      document.body.style.overflow = "";
    };
  }, [ouvert]);

  return (
    <>
      {/* La barre du haut, mobile seulement. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-ligne bg-white/95 px-3 py-2.5 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={ouvert}
          className="rounded-xl p-2 text-encre transition hover:bg-vert-clair"
        >
          <IconMenu2 className="h-6 w-6" stroke={1.7} />
        </button>
        <Link href="/tableau-de-bord" className="flex items-center gap-2 font-bold tracking-tight">
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
          <span className="text-lg">
            Edu<span className="text-vert">Tech</span>
          </span>
        </Link>
        <div className="flex items-center">{cloche}</div>
      </header>

      {/* Le voile et le tiroir. */}
      {ouvert && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOuvert(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div
            ref={panneau}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-ligne px-4 py-3">
              <span className="text-sm font-semibold text-encre-doux">Menu</span>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer le menu"
                className="rounded-xl p-2 text-encre transition hover:bg-vert-clair"
              >
                <IconX className="h-5 w-5" stroke={1.7} />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto px-3 py-4"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) setOuvert(false);
              }}
            >
              {contenu}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
