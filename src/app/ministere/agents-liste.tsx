import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { utilisateurCourant } from "@/lib/auth";
import { changerNiveauEmploye } from "./employes-actions";
import { BoutonRetirerEmploye } from "./employes";

const libellesNiveau: Record<string, string> = {
  admin: "Administrateur",
  validation: "Validation",
  lecture: "Lecture",
};

/** La liste des comptes ministère, relue à chaque affichage. Seul un
 * administrateur voit les actions de niveau et de retrait. */
export async function AgentsListe() {
  const courant = await utilisateurCourant();
  const suisAdmin = courant?.permissions === "admin";

  const agents = await db
    .select({
      id: users.id,
      prenom: users.prenom,
      nom: users.nom,
      email: users.email,
      permissions: users.permissions,
    })
    .from(users)
    .where(eq(users.role, "ministere"))
    .orderBy(asc(users.nom));

  return (
    <ul className="mt-3 divide-y divide-ligne rounded-2xl border border-ligne bg-white text-sm">
      {agents.map((a) => {
        const estMoi = a.id === courant?.id;
        return (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <span>
              <span className="font-medium">
                {a.prenom} {a.nom}
                {estMoi && <span className="ml-1.5 text-xs text-discret">(vous)</span>}
              </span>{" "}
              <span className="text-encre-doux">{a.email}</span>
            </span>
            <span className="flex items-center gap-2">
              {suisAdmin && !estMoi ? (
                <form action={changerNiveauEmploye}>
                  <input type="hidden" name="employeId" value={a.id} />
                  <select
                    name="niveau"
                    defaultValue={a.permissions}
                    className="rounded-lg border border-ligne bg-papier px-2 py-1 text-xs font-medium text-encre"
                  >
                    <option value="admin">Administrateur</option>
                    <option value="validation">Validation</option>
                    <option value="lecture">Lecture</option>
                  </select>
                  <button
                    type="submit"
                    className="ml-1 rounded-lg border border-ligne px-2.5 py-1 text-xs font-medium text-encre-doux hover:bg-papier"
                  >
                    Appliquer
                  </button>
                </form>
              ) : (
                <span className="rounded-full bg-papier px-2.5 py-1 text-xs font-medium text-encre-doux">
                  {libellesNiveau[a.permissions] ?? a.permissions}
                </span>
              )}
              {suisAdmin && !estMoi && <BoutonRetirerEmploye id={a.id} />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
