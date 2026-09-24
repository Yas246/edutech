import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messagesCoach } from "@/db/schema";
import { utilisateurCourant } from "@/lib/auth";
import { promptSysteme } from "@/lib/coach-prompt";

export const maxDuration = 120;

/**
 * Le fil du coach : la question arrive en POST, la réponse part en
 * flux (SSE du fournisseur, relu et retransmis au navigateur). La
 * conversation est rangée côté serveur.
 */
export async function POST(requete: Request) {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) {
    return Response.json({ erreur: "Connectez-vous pour parler au coach." }, { status: 401 });
  }

  const { question } = (await requete.json()) as { question?: string };
  const texte = (question ?? "").trim();
  if (!texte) {
    return Response.json({ erreur: "Posez votre question." }, { status: 400 });
  }

  const base = process.env.LLM_BASE_URL;
  const cle = process.env.LLM_API_KEY;
  const modele = process.env.LLM_MODELE || "deepseek-chat";
  if (!base || !cle) {
    return Response.json(
      { erreur: "Le coach n'est pas encore configuré sur ce serveur." },
      { status: 503 },
    );
  }

  // Historique : les 12 derniers échanges, pour le contexte.
  const historique = await db
    .select({ role: messagesCoach.role, contenu: messagesCoach.contenu })
    .from(messagesCoach)
    .where(eq(messagesCoach.userId, utilisateur.id))
    .orderBy(asc(messagesCoach.id));
  const recents = historique.slice(-12);

  const systeme = await promptSysteme(utilisateur);

  // La question de l'utilisateur est rangée avant l'appel.
  await db.insert(messagesCoach).values({
    userId: utilisateur.id,
    role: "user",
    contenu: texte,
  });

  const reponseFournisseur = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cle}`,
    },
    body: JSON.stringify({
      model: modele,
      messages: [
        { role: "system", content: systeme },
        ...recents,
        { role: "user", content: texte },
      ],
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!reponseFournisseur.ok || !reponseFournisseur.body) {
    return Response.json(
      { erreur: "Le coach est momentanément indisponible. Réessayez dans un instant." },
      { status: 502 },
    );
  }

  // On relit le flux du fournisseur pour ranger la réponse complète
  // tout en la retransmettant au navigateur.
  const decodeur = new TextDecoder();
  const lecteur = reponseFournisseur.body.getReader();
  let tampon = "";
  let reponseComplete = "";

  const flux = new ReadableStream({
    async start(controleur) {
      while (true) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        const lignes = tampon.split("\n");
        tampon = lignes.pop() ?? "";
        for (const ligne of lignes) {
          const propre = ligne.trim();
          if (!propre.startsWith("data:")) continue;
          const charge = propre.slice(5).trim();
          if (charge === "[DONE]") continue;
          try {
            const morceau = JSON.parse(charge);
            const delta = morceau.choices?.[0]?.delta?.content;
            if (delta) {
              reponseComplete += delta;
              controleur.enqueue(new TextEncoder().encode(delta));
            }
          } catch {
            // Fragment incomplet : ignoré, le suivant complétera.
          }
        }
      }
      controleur.close();

      if (reponseComplete) {
        await db.insert(messagesCoach).values({
          userId: utilisateur.id,
          role: "assistant",
          contenu: reponseComplete,
        });
      }
    },
  });

  return new Response(flux, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
