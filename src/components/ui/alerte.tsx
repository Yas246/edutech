/** Le retour d'une action : erreur en rouge, confirmation en vert. */
export type Retour = { erreur?: string; message?: string };

export function Alerte({ erreur, message }: Retour) {
  if (!erreur && !message) return null;
  return (
    <p
      role="alert"
      className={`rounded-xl px-3 py-2 text-sm ${
        erreur
          ? "border border-rouge/30 bg-rouge-clair text-rouge"
          : "border border-vert/30 bg-vert-clair text-vert-fonce"
      }`}
    >
      {erreur ?? message}
    </p>
  );
}
