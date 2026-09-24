/** Les classes partagées des champs et les boutons des formulaires. */

export const champClasse =
  "mt-1 w-full rounded-xl border border-ligne bg-white px-3 py-2 text-sm";

export function Champ({
  label,
  htmlFor,
  children,
  indice,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  indice?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {indice && <span className="font-normal text-encre-doux"> {indice}</span>}
      </label>
      {children}
    </div>
  );
}

const variantes = {
  principal: "bg-vert text-white hover:bg-vert-fonce",
  secondaire: "border border-ligne bg-white text-encre hover:bg-papier",
  danger: "border border-rouge/40 bg-white text-rouge hover:bg-rouge-clair",
} as const;

export function Bouton({
  variante = "principal",
  taille = "normal",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: keyof typeof variantes;
  taille?: "normal" | "petit";
}) {
  const tailleClasse =
    taille === "petit" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      {...props}
      className={`rounded-xl font-medium disabled:opacity-60 ${variantes[variante]} ${tailleClasse} ${className}`}
    >
      {children}
    </button>
  );
}
