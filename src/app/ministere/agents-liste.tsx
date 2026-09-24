import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { BoutonRetirerEmploye } from "./employes";

/** La liste des comptes ministère, relue à chaque affichage. */
export async function AgentsListe() {
  const agents = await db
    .select({ id: users.id, prenom: users.prenom, nom: users.nom, email: users.email })
    .from(users)
    .where(eq(users.role, "ministere"))
    .orderBy(asc(users.nom));

  return (
    <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white text-sm">
      {agents.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span>
            <span className="font-medium">
              {a.prenom} {a.nom}
            </span>{" "}
            <span className="text-encre-doux">{a.email}</span>
          </span>
          <BoutonRetirerEmploye id={a.id} />
        </li>
      ))}
    </ul>
  );
}
