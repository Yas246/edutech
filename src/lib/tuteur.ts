import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, devoirs, matieres, messagesTuteur } from "@/db/schema";

/**
 * Le tuteur de devoirs : il guide l'élève par des questions et des
 * indices, il ne donne JAMAIS la solution. Le garde-fou est imposé
 * ici, dans le prompt système, et rappelé longueur limitée.
 */
const PROMPT_TUTEUR = `Tu es le tuteur de devoirs d'une plateforme éducative béninoise, pour des élèves du secondaire.
Règle absolue : tu ne donnes JAMAIS la solution d'un exercice, pas même partielle sous forme de résultat final.
Tu guides : poses des questions qui font avancer, donnes des indices, rappeles une définition ou une méthode du cours, encourages.
Si l'élève insiste pour avoir la réponse, tu le rappelles à la règle avec bienveillance et tu proposes la prochaine petite étape.
Réponds en français simple, en 120 mots au plus. Structure courte : un mot d'accueil, une piste ou une question, rien de plus.`;

/** Le devoir d'un fil d'aide, avec sa classe et sa matière. */
async function contexteDevoir(idDevoir: number) {
  const [devoir] = await db
    .select({
      titre: devoirs.titre,
      consigne: devoirs.consigne,
      aRendreLe: devoirs.aRendreLe,
      matiere: matieres.nom,
      classe: classes.nom,
    })
    .from(devoirs)
    .innerJoin(matieres, eq(matieres.id, devoirs.matiereId))
    .innerJoin(classes, eq(classes.id, devoirs.classeId))
    .where(eq(devoirs.id, idDevoir))
    .limit(1);
  return devoir;
}

/**
 * La réponse du tuteur à partir du fil existant. Le moteur est
 * appelé sans mode de raisonnement (réponse directe, courte) et
 * température basse : un cadre pédagogique constant.
 */
export async function repondreTuteur(idDevoir: number): Promise<string | null> {
  const base = process.env.LLM_BASE_URL;
  const cle = process.env.LLM_API_KEY;
  const modele = process.env.LLM_MODELE || "deepseek-chat";
  if (!base || !cle) return null;

  const devoir = await contexteDevoir(idDevoir);
  if (!devoir) return null;

  const fil = await db
    .select({ role: messagesTuteur.duTuteur, contenu: messagesTuteur.contenu })
    .from(messagesTuteur)
    .where(eq(messagesTuteur.devoirId, idDevoir))
    .orderBy(asc(messagesTuteur.id));

  const historique = fil.slice(-8).map((m) => ({
    role: (m.role ? "assistant" : "user") as "assistant" | "user",
    content: m.contenu,
  }));

  const consigne = devoir.consigne
    ? ` Consigne donnée à l'élève : ${devoir.consigne}`
    : "";
  try {
    const reponse = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify({
        model: modele,
        messages: [
          { role: "system", content: PROMPT_TUTEUR },
          {
            role: "system",
            content: `Devoir concerné : ${devoir.matiere} en ${devoir.classe} — « ${devoir.titre} », à rendre le ${devoir.aRendreLe}.${consigne}`,
          },
          ...historique,
        ],
        thinking: { type: "disabled" },
        temperature: 0.3,
        max_tokens: 500,
      }),
    });
    if (!reponse.ok) return null;
    const donnees = (await reponse.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return donnees.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
