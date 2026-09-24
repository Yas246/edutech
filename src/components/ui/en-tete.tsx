import Link from "next/link";

/** L'en-tête de page : le fil d'ariane, le titre, les actions à droite. */
export function EnTetePage({
  fil,
  titre,
  sousTitre,
  actions,
}: {
  fil?: { href: string; label: string }[];
  titre: React.ReactNode;
  sousTitre?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div>
      {fil && fil.length > 0 && (
        <p className="text-sm text-encre-doux">
          {fil.map((maillon, i) => (
            <span key={maillon.href}>
              {i > 0 && " · "}
              <Link href={maillon.href} className="underline hover:text-vert">
                {maillon.label}
              </Link>
            </span>
          ))}
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{titre}</h1>
        {actions}
      </div>
      {sousTitre && <p className="mt-2 max-w-2xl text-encre-doux">{sousTitre}</p>}
    </div>
  );
}
