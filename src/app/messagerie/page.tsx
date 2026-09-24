import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages, users } from "@/db/schema";
import { exiger, nomComplet } from "@/lib/auth";
import { contactsAutorises, conversationDeux } from "@/lib/contacts";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import Rafraichissement from "@/components/rafraichissement";
import { envoyerMessage, marquerMessagesLus } from "./actions";

export const metadata: Metadata = { title: "Messagerie" };

const libellesRole: Record<string, string> = {
  enseignant: "enseignant",
  direction: "direction",
  parent: "parent",
  eleve: "élève",
};

function heureFr(date: Date) {
  return date.toISOString().slice(11, 16);
}

export default async function Messagerie({
  searchParams,
}: {
  searchParams: Promise<{ avec?: string }>;
}) {
  const utilisateur = await exiger();
  const contacts = await contactsAutorises(utilisateur.id, utilisateur.role);
  const { avec } = await searchParams;
  const idAutre = Number(avec);

  // Les conversations existantes de l'utilisateur.
  const mesConversations = await db
    .select({
      id: conversations.id,
      userA: conversations.userA,
      userB: conversations.userB,
    })
    .from(conversations)
    .where(or(eq(conversations.userA, utilisateur.id), eq(conversations.userB, utilisateur.id)));

  const pairsIds = mesConversations.map((c) => (c.userA === utilisateur.id ? c.userB : c.userA));
  const pairs = pairsIds.length
    ? await db
        .select({ id: users.id, prenom: users.prenom, nom: users.nom, role: users.role })
        .from(users)
        .where(inArray(users.id, pairsIds))
    : [];

  const filOuvert =
    Number.isInteger(idAutre) && contacts.some((c) => c.id === idAutre) ? idAutre : null;

  const fils = filOuvert
    ? await db
        .select({
          id: messages.id,
          auteurUserId: messages.auteurUserId,
          contenu: messages.contenu,
          date: messages.createdAt,
        })
        .from(messages)
        .where(
          eq(messages.conversationId, await conversationDeux(utilisateur.id, filOuvert)),
        )
        .orderBy(asc(messages.id))
    : [];

  if (filOuvert) await marquerMessagesLus(filOuvert, utilisateur.id);

  const autre = filOuvert ? contacts.find((c) => c.id === filOuvert) : undefined;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <EnTetePage
        titre="Messagerie"
        sousTitre="Échangez avec l'équipe et les familles liées à vos enfants, vos classes ou votre école."
        actions={<Rafraichissement />}
      />

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_2fr]">
        {/* Les contacts autorisés */}
        <aside>
          <h2 className="text-sm font-semibold">Nouvelle conversation</h2>
          {contacts.length === 0 ? (
            <div className="mt-2">
              <EtatVide>
                Aucun contact disponible : vos relations viendront de vos
                classes et de vos écoles.
              </EtatVide>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-ligne rounded-2xl border border-ligne bg-white">
              {contacts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/messagerie?avec=${c.id}`}
                    className={`block px-3 py-2 text-sm hover:bg-papier ${
                      c.id === filOuvert ? "bg-vert-clair font-medium" : ""
                    }`}
                  >
                    {c.prenom} {c.nom}
                    <span className="block text-xs text-encre-doux">
                      {libellesRole[c.role] ?? c.role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Le fil ouvert */}
        <section>
          {filOuvert && autre ? (
            <>
              <h2 className="text-lg font-semibold">
                Conversation avec {nomComplet(autre)}{" "}
                <span className="text-sm font-normal text-encre-doux">
                  ({libellesRole[autre.role] ?? autre.role})
                </span>
              </h2>
              <ul className="mt-4 space-y-2">
                {fils.length === 0 && (
                  <li className="text-sm text-encre-doux">
                    Aucun message : écrivez le premier.
                  </li>
                )}
                {fils.map((m) => {
                  const mien = m.auteurUserId === utilisateur.id;
                  return (
                    <li
                      key={m.id}
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        mien
                          ? "ml-auto bg-vert text-white"
                          : "border border-ligne bg-white"
                      }`}
                    >
                      <p className="whitespace-pre-line">{m.contenu}</p>
                      <p
                        className={`mt-1 text-[11px] ${
                          mien ? "text-white/70" : "text-encre-doux"
                        }`}
                      >
                        {heureFr(m.date)}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <form action={envoyerMessage} className="mt-4 flex items-center gap-2">
                <input type="hidden" name="destinataireId" value={filOuvert} />
                <input
                  name="contenu"
                  required
                  maxLength={1000}
                  autoComplete="off"
                  placeholder="Votre message…"
                  className="flex-1 rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
                >
                  Envoyer
                </button>
              </form>
            </>
          ) : (
            <EtatVide>
              Choisissez un contact à gauche pour ouvrir une conversation.
            </EtatVide>
          )}
        </section>
      </div>
    </div>
  );
}
