"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { messages, notifications, users } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { contactsAutorises, conversationDeux } from "@/lib/contacts";

export async function envoyerMessage(donnees: FormData) {
  const utilisateur = await exiger();
  const destinataireId = Number(donnees.get("destinataireId"));
  const contenu = String(donnees.get("contenu") ?? "").trim();
  if (!Number.isInteger(destinataireId) || !contenu) return;

  // Le destinataire doit figurer parmi les contacts autorisés.
  const contacts = await contactsAutorises(utilisateur.id, utilisateur.role);
  if (!contacts.some((c) => c.id === destinataireId)) return;

  const idConversation = await conversationDeux(utilisateur.id, destinataireId);
  await db.insert(messages).values({
    conversationId: idConversation,
    auteurUserId: utilisateur.id,
    contenu: contenu.slice(0, 1000),
  });

  const [destinataire] = await db
    .select({ prenom: users.prenom, nom: users.nom })
    .from(users)
    .where(eq(users.id, destinataireId))
    .limit(1);
  if (destinataire) {
    await db.insert(notifications).values({
      userId: destinataireId,
      texte: `Nouveau message de ${utilisateur.prenom} ${utilisateur.nom}.`,
      lien: `/messagerie?avec=${utilisateur.id}`,
    });
  }
  revalidatePath("/messagerie");
}

/** Marquer les messages de l'autre comme lus à l'ouverture du fil. */
export async function marquerMessagesLus(idAutre: number, idUtilisateur: number) {
  const conversationId = await conversationDeux(idAutre, idUtilisateur);
  await db
    .update(messages)
    .set({ lu: true })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        inArray(messages.auteurUserId, [idAutre]),
        eq(messages.lu, false),
      ),
    );
}
