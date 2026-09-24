import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import { Bouton } from "@/components/ui/formulaire";
import { marquerLue, toutMarquer } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

function heureFr(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function Notifications() {
  const utilisateur = await exiger();
  const liste = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, utilisateur.id))
    .orderBy(desc(notifications.id))
    .limit(50);

  const nonLues = liste.filter((n) => !n.lue).length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <EnTetePage
        titre="Notifications"
        actions={
          nonLues > 0 ? (
            <form action={toutMarquer}>
              <Bouton variante="secondaire" taille="petit" type="submit">
                Tout marquer comme lu
              </Bouton>
            </form>
          ) : null
        }
      />

      {liste.length === 0 ? (
        <div className="mt-8">
          <EtatVide>
            Aucune notification : les alertes d&apos;appel, de paiement et
            d&apos;activité apparaîtront ici.
          </EtatVide>
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {liste.map((n) => (
            <li key={n.id}>
              <div
                className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${
                  n.lue ? "border-ligne bg-white" : "border-vert/30 bg-vert-clair/60"
                }`}
              >
                <div>
                  <p className={n.lue ? "text-encre-doux" : "font-medium"}>
                    {n.texte}
                  </p>
                  <p className="mt-1 text-xs text-encre-doux">{heureFr(n.createdAt)}</p>
                </div>
                <div className="flex flex-none items-center gap-3">
                  {n.lien && (
                    <Link
                      href={n.lien}
                      className="text-xs font-medium text-vert underline hover:text-vert-fonce"
                    >
                      Ouvrir
                    </Link>
                  )}
                  {!n.lue && (
                    <form action={marquerLue}>
                      <input type="hidden" name="notificationId" value={n.id} />
                      <button type="submit" className="text-xs text-encre-doux underline">
                        Marquer lue
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
