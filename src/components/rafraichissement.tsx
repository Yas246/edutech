"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Le rafraîchissement léger du fil de messages, toutes les 6 secondes. */
export default function Rafraichissement({ secondes = 6 }: { secondes?: number }) {
  const router = useRouter();
  const [actif, setActif] = useState(true);

  useEffect(() => {
    if (!actif) return;
    const horloge = setInterval(() => router.refresh(), secondes * 1000);
    return () => clearInterval(horloge);
  }, [actif, router, secondes]);

  return (
    <button
      type="button"
      onClick={() => setActif((avant) => !avant)}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        actif ? "bg-vert-clair text-vert-fonce" : "border border-ligne text-encre-doux"
      }`}
    >
      {actif ? "Temps réel activé" : "Temps réel en pause"}
    </button>
  );
}
