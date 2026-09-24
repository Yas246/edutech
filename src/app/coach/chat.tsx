"use client";

import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/formulaire";

export default function ChatCoach({
  questionInitiale,
}: {
  questionInitiale?: string;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; contenu: string }[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const envoye = useRef(false);

  // La question posée depuis l'accueil guidé part automatiquement.
  if (questionInitiale && !envoye.current) {
    envoye.current = true;
    questionInitiale = undefined;
  }

  async function poser(question: string) {
    if (!question.trim() || enCours) return;
    setErreur(null);
    setEnCours(true);
    setMessages((avant) => [...avant, { role: "user", contenu: question }]);
    setMessages((avant) => [...avant, { role: "assistant", contenu: "" }]);

    try {
      const reponse = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!reponse.ok) {
        const erreurJson = await reponse.json().catch(() => null);
        setErreur(erreurJson?.erreur ?? "Le coach n'a pas pu répondre.");
        setMessages((avant) => avant.slice(0, -2));
        setEnCours(false);
        return;
      }

      const lecteur = reponse.body!.getReader();
      const decodeur = new TextDecoder();
      while (true) {
        const { done, value } = await lecteur.read();
        if (done) break;
        const morceau = decodeur.decode(value, { stream: true });
        setMessages((avant) => {
          const copie = [...avant];
          const dernier = copie[copie.length - 1];
          copie[copie.length - 1] = { ...dernier, contenu: dernier.contenu + morceau };
          return copie;
        });
      }
    } catch {
      setErreur("Connexion interrompue. Réessayez.");
    }
    setEnCours(false);
    champ.current?.focus();
  }

  return (
    <div>
      <div className="min-h-64 space-y-3">
        {messages.length === 0 && (
          <p className="rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
            Posez votre question : orientation, méthodes de travail, vie de
            classe…
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
              m.role === "user"
                ? "ml-auto bg-vert text-white"
                : "border border-ligne bg-white"
            }`}
          >
            {m.contenu || "…"}
          </div>
        ))}
      </div>

      {erreur && (
        <p role="alert" className="mt-3 rounded-xl border border-rouge/30 bg-rouge-clair px-3 py-2 text-sm text-rouge">
          {erreur}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const valeur = champ.current?.value ?? "";
          if (champ.current) champ.current.value = "";
          poser(valeur);
        }}
        className="mt-4 flex items-center gap-2"
      >
        <input
          ref={champ}
          name="question"
          required
          maxLength={1000}
          autoComplete="off"
          disabled={enCours}
          placeholder="Écrivez au coach…"
          className="flex-1 rounded-xl border border-ligne bg-white px-3 py-2 text-sm"
        />
        <Bouton type="submit" disabled={enCours}>
          {enCours ? "Le coach écrit…" : "Envoyer"}
        </Bouton>
      </form>
    </div>
  );
}
