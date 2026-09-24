import { NextResponse } from "next/server";
import { envoyerRelances } from "@/lib/relances";

/**
 * La tâche quotidienne des relances. Le cron de l'hébergeur l'appelle
 * chaque nuit avec son secret ; en local, le script npm run relances
 * appelle la même fonction.
 */
export async function GET(requete: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const autorisation = requete.headers.get("authorization");
    if (autorisation !== `Bearer ${secret}`) {
      return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
    }
  }
  const resultat = await envoyerRelances();
  return NextResponse.json({ ok: true, ...resultat });
}
