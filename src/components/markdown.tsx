import type { ReactNode } from "react";

/**
 * Le rendu des réponses du coach : elles arrivent en markdown léger
 * (gras, italique, code, listes, titres, liens). Analyse directe en
 * éléments, sans HTML injecté : rien de ce que le modèle écrit ne peut
 * devenir une balise dangereuse.
 */

/** Les segments en ligne : gras, italique, code et liens. */
function enLigne(texte: string): ReactNode[] {
  const morceaux = texte.split(
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g,
  );
  return morceaux.map((m, i) => {
    if (/^\*\*[^*]+\*\*$/.test(m)) return <strong key={i}>{m.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(m)) return <em key={i}>{m.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(m)) {
      return (
        <code key={i} className="rounded bg-papier px-1 py-0.5 text-[0.85em]">
          {m.slice(1, -1)}
        </code>
      );
    }
    const lien = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(m);
    if (lien) {
      return (
        <a
          key={i}
          href={lien[2]}
          className="underline underline-offset-2"
          rel="noreferrer noopener"
        >
          {lien[1]}
        </a>
      );
    }
    return <span key={i}>{m}</span>;
  });
}

export function Markdown({ texte }: { texte: string }) {
  const blocs: ReactNode[] = [];
  let liste: { ordonnee: boolean; items: string[] } | null = null;

  function fermerListe() {
    if (!liste) return;
    const Items = liste.items;
    blocs.push(
      liste.ordonnee ? (
        <ol key={`l${blocs.length}`} className="list-decimal space-y-1 pl-5">
          {Items.map((item, i) => (
            <li key={i}>{enLigne(item)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`l${blocs.length}`} className="list-disc space-y-1 pl-5">
          {Items.map((item, i) => (
            <li key={i}>{enLigne(item)}</li>
          ))}
        </ul>
      ),
    );
    liste = null;
  }

  for (const ligne of texte.split("\n")) {
    const propre = ligne.trim();
    if (!propre) {
      fermerListe();
      continue;
    }
    const titre = /^(#{1,4})\s+(.*)$/.exec(propre);
    if (titre) {
      fermerListe();
      blocs.push(
        <p key={`t${blocs.length}`} className="text-base font-semibold">
          {enLigne(titre[2])}
        </p>,
      );
      continue;
    }
    const puce = /^[-*•]\s+(.*)$/.exec(propre);
    if (puce) {
      if (!liste || liste.ordonnee) {
        fermerListe();
        liste = { ordonnee: false, items: [] };
      }
      liste.items.push(puce[1]);
      continue;
    }
    const numero = /^\d+[.)]\s+(.*)$/.exec(propre);
    if (numero) {
      if (!liste || !liste.ordonnee) {
        fermerListe();
        liste = { ordonnee: true, items: [] };
      }
      liste.items.push(numero[1]);
      continue;
    }
    fermerListe();
    blocs.push(
      <p key={`p${blocs.length}`}>{enLigne(propre)}</p>,
    );
  }
  fermerListe();

  return <div className="space-y-2 text-sm leading-relaxed">{blocs}</div>;
}
