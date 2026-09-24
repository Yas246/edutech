/** L'état vide rédigé : jamais une page blanche. */
export function EtatVide({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-ligne bg-white p-6 text-center text-encre-doux">
      {children}
    </p>
  );
}
