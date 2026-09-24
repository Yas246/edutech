import { nomComplet } from "@/lib/auth";
import { consulterApprenants, statistiquesParDepartement } from "@/lib/nation";
import type { Utilisateur } from "@/lib/auth";

/**
 * Le prompt système du coach : adapté à la place de chacun, avec le
 * contexte réel (intérêts de l'élève, registres du ministère).
 */
export async function promptSysteme(utilisateur: Utilisateur): Promise<string> {
  const base = `Tu es le coach EduTech, un accompagnateur scolaire bienveillant pour la plateforme éducative du Bénin. Tu t'adresses toujours en vouvoiant, avec des réponses courtes, concrètes et encourageantes. Tu connais le contexte béninois (CEG, lycée, francs CFA, trimestres, probatoire et baccalauréat). Tu n'inventes jamais de chiffres : si tu ne sais pas, tu dis ce que l'utilisateur peut consulter dans son espace.`;

  if (utilisateur.role === "eleve") {
    const interets = utilisateur.interets
      ? `Ses centres d'intérêts : ${utilisateur.interets.split(",").join(", ")}.`
      : "Ses centres d'intérêts ne sont pas encore connus.";
    return `${base} Tu parles à un élève. ${interets} Aide-le avec ses méthodes de travail, son orientation et son moral.`;
  }
  if (utilisateur.role === "parent") {
    return `${base} Tu parles à un parent. Aide-le à accompagner son enfant : suivi des notes, organisation à la maison, dialogue avec l'école.`;
  }
  if (utilisateur.role === "enseignant") {
    return `${base} Tu parles à un enseignant. Aide-le sur la pédagogie, la gestion de classe et la communication avec les familles.`;
  }
  if (utilisateur.role === "direction") {
    return `${base} Tu parles à une direction d'établissement. Aide-la sur l'organisation, le suivi du recouvrement et la vie scolaire.`;
  }

  // Ministère : les registres réels, recopiés jamais inventés.
  const stats = await statistiquesParDepartement();
  const top = await consulterApprenants({ requete: "moyenne15" });
  const tableauStats = stats
    .map(
      (d) =>
        `- ${d.departement} : ${d.etablissements} écoles validées, ${d.eleves} élèves, absentéisme ${d.tauxAbsenteisme ?? "—"} %, recouvrement ${d.tauxRecouvrement ?? "—"} %`,
    )
    .join("\n");
  const tableauTop = top
    .map((a) => `- ${a.prenom} ${a.nom} (${a.classe}, ${a.etablissement}) : ${a.moyenne ?? "—"}/20`)
    .join("\n");

  return `${base} Tu parles à un agent du ministère. Voici les REGISTRES ACTUELS de la plateforme ; recopie ces chiffres exacts, ne les invente jamais et n'en déduis pas d'autres :\n\nPar département :\n${tableauStats}\n\nApprenants avec moyenne indicative >= 15 :\n${tableauTop || "(aucun pour l'instant)"}\n\nPour toute autre demande de données, renvoie l'agent vers la page « Suivi des apprenants ». Les montants des finances ne sont jamais communiqués.`;
}
