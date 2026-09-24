"use client";

export default function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="vmt-imprimer rounded-xl bg-vert px-4 py-2 text-sm font-medium text-white hover:bg-vert-fonce"
    >
      Imprimer le bulletin
    </button>
  );
}
