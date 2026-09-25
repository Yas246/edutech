import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, inArray, or } from "drizzle-orm";
import { IconSend } from "@tabler/icons-react";
import { db } from "@/db";
import { conversations, messages, users } from "@/db/schema";
import { exiger, nomComplet } from "@/lib/auth";
import { contactsAutorises, conversationDeux } from "@/lib/contacts";
import { EtatVide } from "@/components/ui/etat-vide";
import Rafraichissement from "@/components/rafraichissement";
import { envoyerMessage, marquerMessagesLus } from "./actions";

export const metadata: Metadata = { title: "Messagerie" };

const libellesRole: Record<string, string> = {
  enseignant: "Enseignant",
  direction: "Direction",
  parent: "Parent",
  eleve: "Élève",
};

function heureFr(date: Date) {
  return date.toISOString().slice(11, 16);
}

function initiales(prenom: string, nom: string) {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

/**
 * La messagerie : une vraie conversation, bulles à deux voix,
 * interlocuteur en en-tête, envoi rond en bas. Le rafraîchissement
 * périodique fait vivre l'échange sans recharger la page.
 */
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
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Messagerie</h1>
        <Rafraichissement />
      </div>

      {/* La table de conversation : liste à gauche, échange à droite. */}
      <div className="mt-5 grid overflow-hidden rounded-2xl border border-ligne bg-white shadow-xs md:grid-cols-[280px_minmax(0,1fr)]">
        {/* La liste des interlocuteurs */}
        <aside className="border-b border-ligne md:border-b-0 md:border-r">
          <p className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-discret">
            Contacts
          </p>
          {contacts.length === 0 ? (
            <div className="p-3">
              <EtatVide>
                Aucun contact : vos relations viendront de vos classes et
                de vos écoles.
              </EtatVide>
            </div>
          ) : (
            <ul className="pb-2">
              {contacts.map((c) => {
                const actif = c.id === filOuvert;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/messagerie?avec=${c.id}`}
                      className={`m-1.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                        actif
                          ? "bg-vert-clair font-semibold text-vert-fonce"
                          : "hover:bg-papier"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                          actif ? "bg-vert-fonce" : "bg-vert"
                        }`}
                      >
                        {initiales(c.prenom, c.nom)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-encre">
                          {c.prenom} {c.nom}
                        </span>
                        <span className="block truncate text-xs text-discret">
                          {libellesRole[c.role] ?? c.role}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* La conversation ouverte */}
        <section className="flex min-h-[60vh] flex-col">
          {filOuvert && autre ? (
            <>
              {/* L'en-tête de l'échange */}
              <div className="flex items-center gap-3 border-b border-ligne px-5 py-3.5">
                <span className="relative">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-vert to-vert-fonce text-sm font-bold text-white">
                    {initiales(autre.prenom, autre.nom)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-vert"
                    title="Notifications actives"
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {nomComplet(autre)}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-discret">
                    <span
                      aria-hidden="true"
                      className="inline-block h-1.5 w-1.5 rounded-full bg-vert"
                    />
                    {libellesRole[autre.role] ?? autre.role} · répond via notification
                  </p>
                </div>
                <div className="ml-auto">{/* La place du titre court */}</div>
              </div>

              {/* Les messages */}
              <ul className="flex-1 space-y-2.5 overflow-y-auto p-5">
                {fils.length === 0 && (
                  <li className="flex h-full items-center justify-center text-sm text-discret">
                    Aucun message : écrivez le premier.
                  </li>
                )}
                {fils.map((m) => {
                  const mien = m.auteurUserId === utilisateur.id;
                  return (
                    <li
                      key={m.id}
                      className={`flex items-end gap-2 ${mien ? "justify-end" : "justify-start"}`}
                    >
                      {!mien && (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-papier text-[10px] font-bold text-encre-doux">
                          {initiales(autre.prenom, autre.nom)}
                        </span>
                      )}
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                          mien
                            ? "rounded-br-md bg-vert text-white"
                            : "rounded-bl-md border border-ligne bg-white text-encre"
                        }`}
                      >
                        <p className="whitespace-pre-line">{m.contenu}</p>
                        <p
                          className={`mt-1 text-right text-[10px] tabular-nums ${
                            mien ? "text-white/70" : "text-discret"
                          }`}
                        >
                          {heureFr(m.date)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* La barre d'envoi */}
              <form
                action={envoyerMessage}
                className="flex items-center gap-2 border-t border-ligne bg-papier/60 px-4 py-3"
              >
                <input type="hidden" name="destinataireId" value={filOuvert} />
                <input
                  name="contenu"
                  required
                  maxLength={1000}
                  autoComplete="off"
                  placeholder="Écrivez votre message…"
                  className="flex-1 rounded-full border border-ligne bg-white px-4 py-2.5 text-sm focus:border-vert/40 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Envoyer le message"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vert text-white transition hover:bg-vert-fonce"
                >
                  <IconSend className="h-[18px] w-[18px]" stroke={1.8} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <EtatVide>
                Choisissez un contact à gauche pour ouvrir la
                conversation.
              </EtatVide>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
