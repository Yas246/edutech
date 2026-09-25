import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, devoirs, inscriptions, matieres, messagesTuteur } from "@/db/schema";
import { IconBulb } from "@tabler/icons-react";
import { exiger } from "@/lib/auth";
import { EnTetePage } from "@/components/ui/en-tete";
import { EtatVide } from "@/components/ui/etat-vide";
import FormulaireTuteur from "./formulaire";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aide devoirs" };

function jour(iso: string) {
  const [a, m, j] = iso.split("-");
  return `${j}/${m}/${a}`;
}

/**
 * Le fil d'aide d'un devoir : mes questions et les réponses du
 * tuteur, qui reste sur son parti — guider, jamais résoudre.
 */
export default async function FilAideDevoir({
  params,
}: {
  params: Promise<{ devoirId: string }>;
}) {
  const { devoirId: brut } = await params;
  const devoirId = Number(brut);
  if (!Number.isInteger(devoirId)) notFound();

  const utilisateur = await exiger("eleve");

  const [devoir] = await db
    .select({
      id: devoirs.id,
      titre: devoirs.titre,
      consigne: devoirs.consigne,
      aRendreLe: devoirs.aRendreLe,
      matiere: matieres.nom,
      classe: classes.nom,
    })
    .from(devoirs)
    .innerJoin(matieres, eq(matieres.id, devoirs.matiereId))
    .innerJoin(classes, eq(classes.id, devoirs.classeId))
    .innerJoin(inscriptions, eq(inscriptions.classeId, devoirs.classeId))
    .where(and(eq(devoirs.id, devoirId), eq(inscriptions.eleveUserId, utilisateur.id)))
    .limit(1);
  if (!devoir) notFound();

  const fil = await db
    .select({
      id: messagesTuteur.id,
      contenu: messagesTuteur.contenu,
      duTuteur: messagesTuteur.duTuteur,
      date: messagesTuteur.createdAt,
    })
    .from(messagesTuteur)
    .where(
      and(eq(messagesTuteur.devoirId, devoirId), eq(messagesTuteur.eleveUserId, utilisateur.id)),
    )
    .orderBy(asc(messagesTuteur.id));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <EnTetePage
        fil={[{ href: "/aide-devoirs", label: "Aide devoirs" }]}
        titre={`${devoir.matiere} : ${devoir.titre}`}
        sousTitre={`${devoir.classe} · à rendre le ${jour(devoir.aRendreLe)}`}
      />

      {devoir.consigne && (
        <div className="mt-4 rounded-2xl border border-ligne bg-white p-4 text-sm">
          <p className="font-semibold">La consigne du professeur</p>
          <p className="mt-1 whitespace-pre-line">{devoir.consigne}</p>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-vert/30 bg-vert-clair/50 p-4 text-sm">
        <p className="font-semibold text-vert-fonce">La règle du tuteur</p>
        <p className="mt-1">
          Le tuteur ne donne jamais la solution : il vous guide par des
          questions et des indices.
        </p>
      </div>

      <section className="mt-6 space-y-3">
        {fil.length === 0 ? (
          <EtatVide>
            Aucun échange pour l&apos;instant : posez votre première question
            ci-dessous.
          </EtatVide>
        ) : (
          fil.map((m) => {
            const mien = !m.duTuteur;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${mien ? "justify-end" : "justify-start"}`}
              >
                {!mien && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vert-clair text-vert-fonce">
                    <IconBulb className="h-4 w-4" stroke={1.7} />
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-xs ${
                    mien
                      ? "rounded-br-md bg-vert text-sm text-white"
                      : "rounded-bl-md border border-ligne bg-white text-sm"
                  }`}
                >
                  <p className="whitespace-pre-line">{m.contenu}</p>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="mt-6">
        <FormulaireTuteur devoirId={devoir.id} />
        <p className="mt-3 text-sm text-encre-doux">
          <Link href="/aide-devoirs" className="text-vert underline hover:text-vert-fonce">
            Retour à mes devoirs
          </Link>
        </p>
      </section>
    </div>
  );
}
