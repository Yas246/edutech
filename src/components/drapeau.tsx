/**
 * Le drapeau national, conforme à l'article premier de la Constitution :
 * une bande verte sur toute la hauteur aux deux cinquièmes côté hampe,
 * puis deux bandes horizontales égales, jaune en haut, rouge en bas.
 */
export function Drapeau() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 w-[30px] overflow-hidden rounded-[3px] border border-black/10"
    >
      <span className="h-full w-2/5 bg-vert" />
      <span className="flex h-full w-3/5 flex-col">
        <span className="h-1/2 w-full bg-jaune" />
        <span className="h-1/2 w-full bg-rouge" />
      </span>
    </span>
  );
}
