import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversationsCoach, messagesCoach } from "@/db/schema";
import { exiger } from "@/lib/auth";
import CoachEspace from "./coach-espace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mon coach" };

export default async function Coach() {
  const utilisateur = await exiger();

  // Toutes les discussions du compte, et les fils qui vont avec : le
  // basculement d'un fil à l'autre se fait alors sans rechargement.
  const discussions = await db
    .select({ id: conversationsCoach.id, titre: conversationsCoach.titre })
    .from(conversationsCoach)
    .where(eq(conversationsCoach.userId, utilisateur.id))
    .orderBy(desc(conversationsCoach.id))
    .limit(50);

  const messages = await db
    .select({
      id: messagesCoach.id,
      conversationId: messagesCoach.conversationId,
      role: messagesCoach.role,
      contenu: messagesCoach.contenu,
    })
    .from(messagesCoach)
    .where(eq(messagesCoach.userId, utilisateur.id))
    .orderBy(asc(messagesCoach.id))
    .limit(600);

  const fils = discussions.map((d) => ({
    id: d.id,
    titre: d.titre,
    messages: messages
      .filter((m) => m.conversationId === d.id)
      .map((m) => ({ role: m.role as "user" | "assistant", contenu: m.contenu })),
  }));

  return (
    <div className="flex h-[calc(100dvh-61px)] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-ligne bg-white px-5 py-3">
        <h1 className="text-lg font-bold tracking-tight">Mon coach</h1>
        <p className="text-xs text-discret">
          Orientation · méthodes · registres de votre place
        </p>
      </div>
      <CoachEspace fils={fils} />
    </div>
  );
}
