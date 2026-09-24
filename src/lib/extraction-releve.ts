/**
 * La lecture d'un relevé de notes par le modèle de vision du
 * fournisseur : il RECOPIE ce qui est écrit, jamais plus. Tout le
 * reste — coefficients, moyenne, mention, cohérence — est recalculé
 * ensuite par la couche déterministe (orientation-moteur), et les
 * écarts sont montrés à l'élève pour correction.
 */

export type ExtractionBrut = {
  serie?: string | null;
  nom?: string | null;
  num_table?: string | null;
  moyenne?: number | null;
  mention?: string | null;
  decision?: string | null;
  matieres?: { matiere?: string; note?: number | null; points?: number | null }[];
};

const MODELE_VISION = process.env.LLM_VISION || "deepseek-v4-flash-vision-exp";

const CONSIGNE = `Voici la photo d'un relevé de notes du baccalauréat du Bénin.
Recopie ce qui est écrit. Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :
{"serie": "...", "nom": "...", "num_table": "...", "moyenne": null, "mention": "...", "decision": "...", "matieres": [{"matiere": "...", "note": null, "points": null}]}
- "serie" : la grande lettre de série visible (A1, A2, B, C ou D), null si illisible.
- "matieres" : chaque ligne de matière du tableau, avec "note" (sur 20) et "points" tels qu'affichés ; null quand une valeur est illisible.
- "moyenne" : la moyenne générale affichée (ex. 10,64), null sinon.
- "decision" : Admis ou Ajourné, null sinon.
Ne calcule rien et ne complète rien : recopie uniquement.`;

/** Retire les décorations éventuelles autour du JSON répondu. */
function extraireJson(texte: string): ExtractionBrut | null {
  const propre = texte.replace(/```json|```/g, "").trim();
  const debut = propre.indexOf("{");
  const fin = propre.lastIndexOf("}");
  if (debut === -1 || fin === -1) return null;
  try {
    return JSON.parse(propre.slice(debut, fin + 1)) as ExtractionBrut;
  } catch {
    return null;
  }
}

export async function extraireReleve(dataUrl: string): Promise<ExtractionBrut> {
  const base = process.env.LLM_BASE_URL;
  const cle = process.env.LLM_API_KEY;
  if (!base || !cle) {
    throw new Error("La lecture des relevés n'est pas configurée sur ce serveur.");
  }

  const reponse = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
    body: JSON.stringify({
      model: MODELE_VISION,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CONSIGNE },
            { type: "image_url", image_url: { url: dataUrl, detail: "original" } },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
      // La lecture recopie : le mode de raisonnement du fournisseur
      // mangerait la fenêtre de tokens sans produire la réponse.
      thinking: { type: "disabled" },
    }),
  });

  if (!reponse.ok) {
    throw new Error("La lecture de la photo a échoué. Réessayez dans un instant.");
  }
  const contenu = (await reponse.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const brut = extraireJson(contenu.choices?.[0]?.message?.content ?? "");
  if (!brut) {
    throw new Error("La lecture de la photo n'a rien renvoyé d'exploitable. Vérifiez la photo ou saisissez vos notes.");
  }
  return brut;
}
