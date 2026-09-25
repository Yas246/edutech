"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
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
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Les discussions */}
      <aside>
        <button
          type="button"
          onClick={() => setActif(null)}
          className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition ${
            actif === null
              ? "bg-vert text-white"
              : "border border-ligne bg-white hover:border-vert/40"
          }`}
        >
          + Nouvelle discussion
        </button>
        <ul className="mt-2 space-y-1">
          {filsLocaux.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setActif(f.id)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  f.id === actif
                    ? "bg-vert-clair font-medium text-vert-fonce"
                    : "text-encre-doux hover:bg-papier"
                }`}
              >
                <span className="block truncate">{f.titre || "Discussion"}</span>
                <span className="block text-xs text-encre-doux">
                  {f.messages.length} message{f.messages.length > 1 ? "s" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Le fil ouvert */}
      <section className="flex min-h-[420px] flex-col rounded-2xl border border-ligne bg-papier/60">
        <div className="scroll-doux max-h-[60vh] flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-sm text-encre-doux">
              Posez votre première question : le coach consulte les registres
              de votre place avant de répondre.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  m.role === "user"
                    ? "ml-auto bg-vert text-sm text-white"
                    : "border border-ligne bg-white"
                }`}
              >
                {m.role === "user" ? (
                  <span className="whitespace-pre-line">{m.contenu || "…"}</span>
                ) : (
                  <Markdown texte={m.contenu || "…"} />
                )}
              </div>
            ))
          )}
          <div ref={finDuFil} />
        </div>

        {erreur && (
          <p role="alert" className="mx-4 mb-2 rounded-xl border border-rouge/30 bg-rouge-clair px-3 py-2 text-sm text-rouge">
            {erreur}
          </p>
        )}

        <form
          onSubmit={envoyer}
          className="flex items-end gap-2 rounded-b-2xl border-t border-ligne bg-white p-3"
        >
          <textarea
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            onKeyDown={toucherTouche}
            rows={1}
            maxLength={1000}
            disabled={enCours}
            placeholder="Écrivez au coach… (Entrée pour envoyer)"
            className="max-h-40 flex-1 resize-none rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={enCours || !brouillon.trim()}
            className="rounded-xl bg-vert px-4 py-2.5 text-sm font-medium text-white hover:bg-vert-fonce disabled:opacity-60"
          >
            {enCours ? "Le coach écrit…" : "Envoyer"}
          </button>
        </form>
      </section>
    </div>
  );
}
