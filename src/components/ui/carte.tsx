/** La carte blanche à coins arrondis, socle de toutes les sections. */
export function Carte({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded-2xl border border-ligne bg-white p-5 ${className}`}>{children}</div>;
}
