import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { codesClasse } from "@/db/schema";
import { exiger } from "@/lib/auth";
import { genererCode } from "@/lib/codes";

async function codeDeClasse(classeId: number): Promise<string> {
  const [existant] = await db
    .select({ code: codesClasse.code })
    .from(codesClasse)
    .where(eq(codesClasse.classeId, classeId))
    .limit(1);
  if (existant) return existant.code;
  const code = await genererCode("VMT-", async (c) =>
    Boolean(
      await db
        .select({ id: codesClasse.classeId })
        .from(codesClasse)
        .where(eq(codesClasse.code, c))
        .limit(1)
        .then((r) => r.length),
    ),
  );
  await db.insert(codesClasse).values({ classeId, code }).onConflictDoNothing();
  const [relu] = await db
    .select({ code: codesClasse.code })
    .from(codesClasse)
    .where(eq(codesClasse.classeId, classeId))
    .limit(1);
  return relu.code;
}

/** Un nouveau code pour la classe : l'ancien ne marche plus. */
async function regenerer(donnees: FormData) {
  "use server";
  const utilisateur = await exiger("direction");
  const classeId = Number(donnees.get("classeId"));
  // Seule la direction de l'établissement de la classe renouvelle.
  const { classes, etablissements } = await import("@/db/schema");
  const [classe] = await db
    .select({ directionUserId: etablissements.directionUserId })
    .from(classes)
    .innerJoin(etablissements, eq(etablissements.id, classes.etablissementId))
    .where(eq(classes.id, classeId))
    .limit(1);
  if (!classe || classe.directionUserId !== utilisateur.id) return;

  const code = await genererCode("VMT-", async (c) =>
    Boolean(
      await db
        .select({ id: codesClasse.classeId })
        .from(codesClasse)
        .where(eq(codesClasse.code, c))
        .limit(1)
        .then((r) => r.length),
    ),
  );
  await db
    .insert(codesClasse)
    .values({ classeId, code })
    .onConflictDoUpdate({ target: codesClasse.classeId, set: { code } });
  revalidatePath("/mon-ecole");
  revalidatePath(`/classes/${classeId}`);
}

/**
 * Le code d'entrée de la classe : les élèves le saisissent dans
 * « Rejoindre » et sont inscrits réellement. Un seul code actif.
 */
export default async function CodeClasse({ classeId }: { classeId: number }) {
  const code = await codeDeClasse(classeId);

  return (
    <div className="rounded-xl border border-ligne p-3">
      <p className="text-sm font-semibold">Code de la classe</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="rounded-lg border border-vert/30 bg-vert-clair/60 px-3 py-1.5 font-mono text-base font-bold tracking-widest text-vert-fonce">
          {code}
        </span>
        <form action={regenerer}>
          <input type="hidden" name="classeId" value={classeId} />
          <button
            type="submit"
            className="text-xs text-encre-doux underline hover:text-encre"
          >
            Régénérer
          </button>
        </form>
      </div>
      <p className="mt-1 text-xs text-encre-doux">
        L&apos;élève le saisit dans « Rejoindre » : il est inscrit, sans
        email à collecter.
      </p>
    </div>
  );
}
