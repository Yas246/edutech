import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversationsCoach, messagesCoach } from "@/db/schema";
import { utilisateurCourant } from "@/lib/auth";
import { promptSysteme } from "@/lib/coach-prompt";
import { executerOutil, outilsPourModele } from "@/lib/outils/registry";
import type { CompteOutil } from "@/lib/outils/types";

export const maxDuration = 120;

/** Deux tours d'instruments au plus : ensuite le coach répond. */
const TOURS_MAX = 2;

/** Rien de ce que renvoie un instrument ne part entier au modèle : on borne. */
const TAILLE_RESULTAT = 3000;

type AppelOutil = { id: string; nom: string; arguments: string };

/**
 * La lecture d'un flux du fournisseur : les fragments de texte passent
 * à l'émetteur au fil de l'eau, les appels d'outils se reconstituent
 * morceau par morceau (le nom et les arguments arrivent en plusieurs fois).
 */
async function lireFlux(
  reponse: Response,
  surMorceau?: (texte: string) => void,
): Promise<{ contenu: string; appels: AppelOutil[] }> {
  const decodeur = new TextDecoder();
  const lecteur = reponse.body!.getReader();
  let tampon = "";
  let contenu = "";
  const appels: AppelOutil[] = [];

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
        const delta = morceau.choices?.[0]?.delta;
        if (delta?.content) {
          contenu += delta.content;
          surMorceau?.(delta.content);
        }
        for (const tc of delta?.tool_calls ?? []) {
          const rang = tc.index ?? 0;
          appels[rang] ??= { id: "", nom: "", arguments: "" };
          if (tc.id) appels[rang].id = tc.id;
          if (tc.function?.name) appels[rang].nom = tc.function.name;
          if (tc.function?.arguments) appels[rang].arguments += tc.function.arguments;
        }
      } catch {
        // Fragment incomplet : ignoré, le suivant complétera.
      }
    }
  }
  return { contenu, appels: appels.filter(Boolean) };
}

/**
 * Le fil du coach : la question arrive en POST avec sa discussion, le
 * coach consulte ses instruments (les mêmes fonctions que les pages),
 * la réponse part en flux et tout est rangé côté serveur. L'identifiant
 * de discussion repart dans l'en-tête X-Discussion-Id.
 */
export async function POST(requete: Request) {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) {
    return Response.json({ erreur: "Connectez-vous pour parler au coach." }, { status: 401 });
  }

  const { question, discussion } = (await requete.json()) as {
    question?: string;
    discussion?: number;
  };
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

  // La discussion : celle qui est demandée si elle appartient bien au
  // compte, sinon une nouvelle, titrée par la première question.
  let discussionId: number;
  if (discussion) {
    const [existante] = await db
      .select({ id: conversationsCoach.id })
      .from(conversationsCoach)
      .where(
        and(eq(conversationsCoach.id, discussion), eq(conversationsCoach.userId, utilisateur.id)),
      )
      .limit(1);
    if (!existante) {
      return Response.json({ erreur: "Cette discussion n'existe pas." }, { status: 404 });
    }
    discussionId = existante.id;
  } else {
    const [creee] = await db
      .insert(conversationsCoach)
      .values({ userId: utilisateur.id, titre: texte.slice(0, 60) })
      .returning({ id: conversationsCoach.id });
    discussionId = creee.id;
  }

  // Historique : les 12 derniers échanges DE CETTE discussion.
  const historique = await db
    .select({ role: messagesCoach.role, contenu: messagesCoach.contenu })
    .from(messagesCoach)
    .where(eq(messagesCoach.conversationId, discussionId))
    .orderBy(asc(messagesCoach.id));
  const recents = historique.slice(-12).map((m) => ({ role: m.role, content: m.contenu }));

  const systeme = await promptSysteme(utilisateur);

  const compte: CompteOutil = {
    id: utilisateur.id,
    role: utilisateur.role as CompteOutil["role"],
    prenom: utilisateur.prenom,
    nom: utilisateur.nom,
    interets: utilisateur.interets,
  };

  // La question est rangée avant l'appel.
  await db.insert(messagesCoach).values({
    userId: utilisateur.id,
    conversationId: discussionId,
    role: "user",
    contenu: texte,
  });

  const messages: unknown[] = [
    { role: "system", content: systeme },
    ...recents,
    { role: "user", content: texte },
  ];
  const instruments = outilsPourModele();

  async function appeler(avecOutils: boolean) {
    return fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify({
        model: modele,
        messages,
        ...(avecOutils && instruments.length > 0 ? { tools: instruments } : {}),
        // Le coach répond vite et s'appuie sur ses instruments : le
        // mode de raisonnement du fournisseur est désactivé (sinon il
        // faudrait lui renvoyer sa chaîne de pensée à chaque tour) et
        // la température reste basse : des registres recopiés, pas de
        // littérature, et un format d'appel d'outil qui ne dérape pas.
        thinking: { type: "disabled" },
        stream: true,
        temperature: 0.2,
      }),
    });
  }

  let reponseComplete = "";
  let premierEchec = false;
  const flux = new ReadableStream({
    async start(controleur) {
      const emettre = (morceau: string) =>
        controleur.enqueue(new TextEncoder().encode(morceau));

      try {
        for (let tour = 0; tour <= TOURS_MAX; tour++) {
          const dernier = tour === TOURS_MAX;
          const reponseFournisseur = await appeler(!dernier);
          if (!reponseFournisseur.ok || !reponseFournisseur.body) {
            if (tour === 0) {
              premierEchec = true;
              break;
            }
            emettre("Le coach est momentanément indisponible. Réessayez dans un instant.");
            break;
          }

          // Les propos d'un tour précédent ne collent pas à ceux du suivant.
          if (tour > 0 && reponseComplete) emettre("\n\n");

          // Tout ce que le modèle écrit part au navigateur au fil de
          // l'eau, quel que soit le tour : ce qui est vu est ce qui est
          // rangé.
          const { contenu, appels } = await lireFlux(reponseFournisseur, emettre);
          reponseComplete += (reponseComplete && contenu ? "\n\n" : "") + contenu;

          if (appels.length === 0 || dernier) break;

          // Le coach a demandé des données : chaque appel passe par la
          // garde de rôle du registre, puis on lui rend la main.
          messages.push({
            role: "assistant",
            content: contenu || null,
            tool_calls: appels.map((a) => ({
              id: a.id,
              type: "function",
              function: { name: a.nom, arguments: a.arguments || "{}" },
            })),
          });
          for (const a of appels) {
            let args: Record<string, string | number | undefined> = {};
            try {
              args = JSON.parse(a.arguments || "{}");
            } catch {
              // Arguments mal formés : la garde renverra son refus.
            }
            const resultat = await executerOutil(a.nom, compte, args);
            const charge = JSON.stringify(resultat.ok ? resultat.donnees : { refus: resultat.refus });
            messages.push({
              role: "tool",
              tool_call_id: a.id,
              content:
                charge.length > TAILLE_RESULTAT
                  ? charge.slice(0, TAILLE_RESULTAT) + "…(tronqué)"
                  : charge,
            });
          }
        }
      } finally {
        controleur.close();
        if (reponseComplete) {
          await db.insert(messagesCoach).values({
            userId: utilisateur.id,
            conversationId: discussionId,
            role: "assistant",
            contenu: reponseComplete,
          });
        }
      }
    },
  });

  if (premierEchec) {
    return Response.json(
      { erreur: "Le coach est momentanément indisponible. Réessayez dans un instant." },
      { status: 502 },
    );
  }

  return new Response(flux, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Discussion-Id": String(discussionId),
    },
  });
}
