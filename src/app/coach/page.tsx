import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messagesCoach } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import ChatCoach from "./chat";

export const metadata: Metadata = { title: "Mon coach" };

export default async function Coach() {
  const utilisateur = await exiger();

  const historique = await db
    .select({ role: messagesCoach.role, contenu: messagesCoach.contenu })
    .from(messagesCoach)
    .where(eq(messagesCoach.userId, utilisateur.id))
    .orderBy(asc(messagesCoach.id))
    .limit(40);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <EnTetePage
        titre="Mon coach"
        sousTitre="Un accompagnement adapté à votre place sur la plateforme : orientation, méthodes, vie scolaire."
      />
      <div className="mt-8">
        <ChatCoach questionInitiale={undefined} />
      </div>
      {historique.length > 0 && (
        <details className="mt-8 rounded-2xl border border-ligne bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold">
            Historique de mes conversations ({historique.length} messages)
          </summary>
          <ul className="mt-3 space-y-2">
            {historique.map((m, i) => (
              <li
                key={i}
                className={`rounded-xl px-3 py-2 ${
                  m.role === "user" ? "bg-vert-clair/60" : "bg-papier"
                }`}
              >
                <span className="block text-xs font-medium text-encre-doux">
                  {m.role === "user" ? "Vous" : "Coach"}
                </span>
                {m.contenu}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
