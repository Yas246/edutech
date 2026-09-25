import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inscriptions } from "@/db/schema";
import { exiger } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ma classe" };

/** L'élève atterrit sur la page de SA classe. */
export default async function MaClasse() {
  const utilisateur = await exiger("eleve");
  const [inscription] = await db
    .select({ classeId: inscriptions.classeId })
    .from(inscriptions)
    .where(eq(inscriptions.eleveUserId, utilisateur.id))
    .limit(1);
  if (!inscription) redirect("/rejoindre");
  redirect(`/classes/${inscription.classeId}`);
}
