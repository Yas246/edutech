"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { IconBulb, IconSend } from "@tabler/icons-react";
import { Markdown } from "@/components/markdown";

type Message = { role: "user" | "assistant"; contenu: string };
type Fil = { id: number; titre: string; messages: Message[] };

/**
 * L'espace de discussion avec le coach : les fils à gauche, le fil
 * ouvert au centre, la saisie en bas. Une nouvelle discussion naît à
 * la première question ; le serveur renvoie son identifiant dans
 * l'en-tête de la réponse.
 */
export default function CoachEspace({ fils }: { fils: Fil[] }) {
  const [filsLocaux, setFilsLocaux] = useState<Fil[]>(fils);
  const [actif, setActif] = useState<number | null>(fils[0]?.id ?? null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const finDuFil = useRef<HTMLDivElement>(null);

  const filActif = filsLocaux.find((f) => f.id === actif) ?? null;
  const messages = filActif?.messages ?? [];

  function suivre() {
    requestAnimationFrame(() => {
      finDuFil.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  async function poser() {
    const question = brouillon.trim();
    if (!question || enCours) return;
    setErreur(null);
    setBrouillon("");
    setEnCours(true);

    // Une discussion qui n'existe pas encore porte une clé provisoire,
    // remplacée par l'identifiant du serveur à la réponse.
    const cleProvisoire = actif ?? -Date.now();

    setFilsLocaux((avant) => {
      const filExistant = avant.find((f) => f.id === cleProvisoire);
      if (filExistant) {
        return avant.map((f) =>
          f.id === cleProvisoire
            ? {
                ...f,
                messages: [
                  ...f.messages,
                  { role: "user" as const, contenu: question },
                  { role: "assistant" as const, contenu: "" },
                ],
              }
            : f,
        );
      }
      return [
        {
          id: cleProvisoire,
          titre: question.slice(0, 60),
          messages: [
            { role: "user" as const, contenu: question },
            { role: "assistant" as const, contenu: "" },
          ],
        },
        ...avant,
      ];
    });
    suivre();

    try {
      const reponse = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          discussion: actif && actif > 0 ? actif : undefined,
        }),
      });

      if (!reponse.ok) {
        const erreurJson = await reponse.json().catch(() => null);
        setErreur(erreurJson?.erreur ?? "Le coach n'a pas pu répondre.");
        setEnCours(false);
        return;
      }

      // L'identifiant du fil, connu dès les en-têtes.
      const idServeur = Number(reponse.headers.get("X-Discussion-Id")) || null;
      if (idServeur && idServeur !== cleProvisoire) {
        setActif(idServeur);
        setFilsLocaux((avant) =>
          avant.map((f) => (f.id === cleProvisoire ? { ...f, id: idServeur } : f)),
        );
      }

      const lecteur = reponse.body!.getReader();
      const decodeur = new TextDecoder();
      while (true) {
        const { done, value } = await lecteur.read();
        if (done) break;
        const morceau = decodeur.decode(value, { stream: true });
        setFilsLocaux((avant) =>
          avant.map((f) => {
            if (f.id !== cleProvisoire && f.id !== idServeur) return f;
            const copie = { ...f, messages: [...f.messages] };
            const dernier = { ...copie.messages[copie.messages.length - 1] };
            dernier.contenu += morceau;
            copie.messages[copie.messages.length - 1] = dernier;
            return copie;
          }),
        );
        suivre();
      }
    } catch {
      setErreur("Connexion interrompue. Réessayez.");
    }
    setEnCours(false);
  }

  function envoyer(e: FormEvent) {
    e.preventDefault();
    poser();
  }

  function toucherTouche(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Entrée envoie, Maj+Entrée passe à la ligne.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      poser();
    }
  }

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Les discussions */}
      <aside className="scroll-doux min-h-0 overflow-y-auto border-b border-ligne bg-white lg:border-b-0 lg:border-r">
        <p className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-discret">
          Discussions
        </p>
        <button
          type="button"
          onClick={() => setActif(null)}
          className={`mx-1.5 mb-1.5 flex w-[calc(100%-12px)] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            actif === null
              ? "bg-vert-clair text-vert-fonce"
              : "text-encre-doux hover:bg-papier"
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-vert/50 text-vert">
            +
          </span>
          Nouvelle discussion
        </button>
        <ul className="pb-2">
          {filsLocaux.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setActif(f.id)}
                className={`mx-1.5 w-[calc(100%-12px)] rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  f.id === actif
                    ? "bg-vert-clair font-semibold text-vert-fonce"
                    : "text-encre-doux hover:bg-papier"
                }`}
              >
                <span className="block truncate font-medium text-encre">
                  {f.titre || "Discussion"}
                </span>
                <span className="block text-xs text-discret">
                  {f.messages.length} message{f.messages.length > 1 ? "s" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* La conversation */}
      <section className="flex min-h-[50vh] flex-col lg:min-h-0">
        {/* L'en-tête du coach */}
        <div className="flex items-center gap-3 border-b border-ligne bg-white px-5 py-3.5">
          <span className="relative">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-vert to-vert-fonce text-white">
              <IconBulb className="h-5 w-5" stroke={1.7} />
            </span>
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-vert"
            />
          </span>
          <div>
            <p className="text-sm font-semibold text-encre">Coach EduTech</p>
            <p className="flex items-center gap-1.5 text-xs text-discret">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-vert" />
              orientation · devoirs · registres de votre place
            </p>
          </div>
        </div>

        {/* Les messages */}
        <div className="scroll-doux min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="max-w-sm text-center text-sm text-discret">
                Posez votre première question : le coach consulte les
                registres de votre place avant de répondre.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vert-clair text-vert-fonce">
                    <IconBulb className="h-4 w-4" stroke={1.7} />
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-xs ${
                    m.role === "user"
                      ? "rounded-br-md bg-vert text-sm text-white"
                      : "rounded-bl-md border border-ligne bg-white"
                  }`}
                >
                  {m.role === "user" ? (
                    <span className="whitespace-pre-line">{m.contenu || "…"}</span>
                  ) : (
                    <Markdown texte={m.contenu || "…"} />
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={finDuFil} />
        </div>

        {erreur && (
          <p
            role="alert"
            className="mx-5 mb-2 rounded-xl border border-rouge/30 bg-rouge-clair px-3 py-2 text-sm text-rouge"
          >
            {erreur}
          </p>
        )}

        {/* La barre d'envoi */}
        <form
          onSubmit={envoyer}
          className="flex items-center gap-2 border-t border-ligne bg-white px-4 py-3"
        >
          <textarea
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            onKeyDown={toucherTouche}
            rows={1}
            maxLength={1000}
            disabled={enCours}
            placeholder="Écrivez au coach… (Entrée pour envoyer)"
            className="max-h-40 flex-1 resize-none rounded-full border border-ligne bg-papier px-4 py-2.5 text-sm focus:border-vert/40 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={enCours || !brouillon.trim()}
            aria-label="Envoyer au coach"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vert text-white transition hover:bg-vert-fonce disabled:opacity-60"
          >
            <IconSend className="h-[18px] w-[18px]" stroke={1.8} />
          </button>
        </form>
      </section>
    </div>
  );
}
