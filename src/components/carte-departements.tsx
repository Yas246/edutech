import Link from "next/link";

/**
 * La carte du Bénin : les douze départements aux frontières réelles
 * (source geoBoundaries gbOpen/BEN/ADM1, projection équirectangulaire
 * simplifiée), cinq paliers de couleur du bon à l'alerte. Chaque
 * département est un lien vers son détail.
 */
export type DepartementCarte = {
  nom: string;
  /** Le texte affiché au survol : « 8,4 élèves par enseignant ». */
  valeurAffichee: string;
  /** 0 (bon) à 4 (alerte) ; null = pas de donnée (gris). */
  palier: number | null;
};

// Tracés réels (source geoBoundaries gbOpen/BEN/ADM1, projection équirectangulaire).
const SILHOUETTE: { nom: string; points: string; labelX: number; labelY: number }[] = [
  { nom: "Borgou", points: "439.3,249.4 372.9,265.8 335.9,279.2 314.9,282.3 306.6,279.2 305,274.5 288.1,274.6 278.6,284.1 272.3,284.5 246.7,273.3 226,277.9 217.6,274.9 210.5,281.6 205,293.3 214.5,310.8 219.7,329.8 212.6,337.6 192,342.2 189.4,378.8 192.8,390.6 200.9,401.7 195.1,439.4 190.2,443.6 177.6,444.3 173.4,452.4 172.6,473.7 183.7,482.7 178.6,506.2 182.9,515.7 204.1,522.9 203.3,529.7 281,528.6 286.6,510.7 284.4,507.2 288.5,484.6 309.2,481.5 317.7,484.2 331.7,479.3 342.9,450.3 338.9,429.6 340.8,425 354.5,407.8 356.4,400.2 368.2,396.4 366.6,379.6 369.2,374.9 394,366.6 406,349.8 408.1,334.2 414.8,327.7 416.1,320.6 402.8,305.7 411.3,285.3 419.7,280.6 431.7,283.4 440,258.4 439.3,249.4", labelX: 286.2, labelY: 384.5 },
  { nom: "Alibori", points: "439.3,249.4 438.9,242.7 431.7,240.9 430.9,234.8 426.4,232.1 429.8,217 423.3,200.1 423.3,186.8 416.9,185 390.4,161.2 404.6,104 386.1,85.4 372.1,77.2 363.5,78.9 354.7,59.8 344.6,52.1 340.4,43.4 335.9,43.9 332.1,38 322.5,33.9 319.9,23.5 312.3,20.1 291.8,0 274.5,6.5 271.8,16.3 259.1,14.7 253.8,19.4 247.1,16.1 245.7,21.7 242.5,18.8 241.2,23.1 238.1,19.9 230.4,21.3 238.4,56.7 245.8,59.2 246.1,63.3 234.5,66.8 236.3,80.2 231.7,93.1 223.3,102.3 224.7,109.9 206.8,118 180.9,141.6 215.9,206.6 227.7,210.3 232.4,216.7 218.9,228.2 217.9,275 226,277.9 246.7,273.3 254.7,274.6 259.3,280.9 272.3,284.5 278.6,284.1 288.1,274.6 305,274.5 306.6,279.2 314.9,282.3 335.9,279.2 372.9,265.8 439.3,249.4", labelX: 306.2, labelY: 159.8 },
  { nom: "Atakora", points: "217.9,275 218.9,228.2 232.4,216.7 227.7,210.3 215.9,206.6 182.6,143.2 158.3,138.5 124.2,146.6 118.5,146 110.7,138 97.6,136.1 89.6,140.2 86.8,149.3 77.4,154.6 82.3,159.3 80.4,161.4 67.5,160.4 71.2,165 69,169.1 53.7,165.4 50.4,167.6 55.1,181.5 50.2,180.5 39.9,186.4 43.5,187.7 49.8,200.8 26.8,195 25.6,206.2 19.1,207.8 15.4,219 17.7,224.5 13.6,236 2.8,248.8 0,294.2 85.4,351.4 117.4,349.6 133,342.6 137,336.1 147.3,334.5 154.5,340.5 205.3,340.1 216.6,335.2 218.7,322.3 205,293.3 210.5,281.6 217.9,275", labelX: 118.6, labelY: 248.1 },
  { nom: "Donga", points: "193.2,340.4 154.5,340.5 147.3,334.5 137,336.1 133,342.6 117.4,349.6 84.6,350.4 86.7,401.7 82.6,414.4 86.2,422.7 89,422.1 93.1,446.3 119.3,479 122.1,553.7 146,550.4 181.9,570.7 198.8,573.3 206.2,569.3 202.1,533.2 205.2,524.2 184.3,516.7 178.6,508.8 183.7,482.7 172.6,473.7 171.9,466.8 174.1,448.2 177.6,444.3 190.2,443.6 195.1,439.4 200.9,401.7 192.8,390.6 189.4,378.8 193.2,340.4", labelX: 147.1, labelY: 442.1 },
  { nom: "Collines", points: "203.3,529.7 206.2,569.3 198.8,573.3 181.9,570.7 146,550.4 127.1,554.2 121.2,550.7 121.5,559.4 126.1,566.5 120.8,585.1 123.7,690.2 162.8,695.9 186.7,706.6 208.2,709.8 228.1,720.9 235.7,718.8 243.6,708.5 245.7,692.3 279.7,690.7 280.6,668 273.1,655.7 281.8,611.7 276.4,588.1 282.6,570 282.5,537.1 281,528.6 203.3,529.7", labelX: 205, labelY: 622.5 },
  { nom: "Plateau", points: "233.7,719.5 241.9,754.1 250.7,760.7 253.7,781.1 250.2,802.5 252.2,808.7 266,847.1 279.4,849.3 281.4,831.6 287.9,825.9 284.5,816 280.1,814.6 281.4,795.3 277.8,791.8 279.9,783.2 287.3,776.9 281.1,768.9 284.7,761.7 282.6,727 287.6,722.4 288.5,710.8 280.9,703.2 279.7,690.7 245.7,692.3 244.4,706.7 233.7,719.5", labelX: 264.9, labelY: 759 },
  { nom: "Zou", points: "123.7,690.2 124.8,708.3 131.5,716.6 140.5,742 148.9,749.3 159.3,772.4 179.7,800.4 214,792.9 220.8,788.2 223.5,792.7 229.8,785.7 234.4,788.8 252.6,788.4 250.7,760.7 241.9,754.1 233.7,719.5 224.5,719.8 208.2,709.8 186.7,706.6 162.8,695.9 123.7,690.2", labelX: 189.5, labelY: 745.7 },
  { nom: "Littoral", points: "223.3,885.3 254.6,880.4 248,872.4 239.5,869.5 227.4,873.8 223.3,885.3", labelX: 238, labelY: 881 },
  { nom: "Couffo", points: "125.2,708.5 125.3,784.8 111.8,783.2 119.6,797.6 122.9,820 120.4,823.8 154.6,816.1 160.9,820 163.7,826.7 177.7,833.4 189,805.1 187.4,798.6 179.7,800.4 162.7,777.9 154.8,758.2 140.5,742 131.5,716.6 125.2,708.5", labelX: 146.8, labelY: 786.2 },
  { nom: "Ouémé", points: "252.6,788.4 234.3,788.7 228.9,798.5 235.3,809 237.8,855.2 244.4,859.1 244.3,869.8 254.6,880.4 277.4,874.8 279.4,849.3 266,847.1 250.2,802.5 252.6,788.4", labelX: 252.4, labelY: 838.9 },
  { nom: "Atlantique", points: "187.4,798.6 189,805.1 186.2,806.2 179,837.4 174.8,843.3 175.7,859.7 171.4,874.3 176.6,893.1 223.4,886.2 227.4,873.8 244.3,869.8 244.8,866.9 244.4,859.1 237.8,855.2 235.3,809 228.9,798.5 233.1,786.4 229.8,785.7 223.5,792.7 220.8,788.2 214,792.9 187.4,798.6", labelX: 207, labelY: 843.7 },
  { nom: "Mono", points: "120.4,823.8 117.4,829.8 123,843.5 130,846 135.7,859.6 142.1,863.2 150,891.7 128.9,894.8 127.3,899 176.6,893.1 171.4,874.3 178.5,834.3 163.7,826.7 160.9,820 154.6,816.1 120.4,823.8", labelX: 152.2, labelY: 853.1 },
];

/** Cinq paliers, du bon (vert) à l'alerte (rouge). */
const PALETTE = ["#0e7a5f", "#27a97c", "#e8c34a", "#e08a3c", "#c94f43"];
const SANS_DONNEE = "#d8d5cd";

export default function CarteDepartements({
  departements,
}: {
  departements: DepartementCarte[];
}) {
  const parNom = new Map(departements.map((d) => [d.nom.toLowerCase(), d]));

  return (
    <svg
      viewBox="0 0 440 899"
      role="img"
      aria-label="Carte des départements du Bénin"
      className="mx-auto h-auto w-full max-w-xs"
    >
      {SILHOUETTE.map((d) => {
        const donnees = parNom.get(d.nom.toLowerCase());
        const palier = donnees?.palier ?? null;
        const remplissage = palier === null ? SANS_DONNEE : PALETTE[palier];
        return (
          <Link
            key={d.nom}
            href={`/ministere/indicateurs?dep=${encodeURIComponent(d.nom)}`}
            title={
              donnees
                ? `${d.nom} — ${donnees.valeurAffichee}`
                : `${d.nom} — pas de donnée`
            }
          >
            <polygon
              points={d.points}
              fill={remplissage}
              stroke="#ffffff"
              strokeWidth={1.5}
              className="transition-opacity hover:opacity-75"
            >
              <title>
                {donnees ? `${d.nom} — ${donnees.valeurAffichee}` : `${d.nom} — pas de donnée`}
              </title>
            </polygon>
            <text
              x={d.labelX}
              y={d.labelY}
              textAnchor="middle"
              className="pointer-events-none fill-white text-[13px] font-semibold"
              style={{ paintOrder: "stroke", stroke: "rgba(9,25,51,0.45)", strokeWidth: 2 }}
            >
              {d.nom}
            </text>
          </Link>
        );
      })}
    </svg>
  );
}

/** La légende des cinq paliers, à poser sous la carte. */
export function LegendeCarte({
  paliers,
}: {
  paliers: { couleur: string; texte: string }[];
}) {
  return (
    <ul className="mx-auto mt-3 flex w-fit flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-encre-doux">
      {paliers.map((p, i) => (
        <li key={`${p.couleur}-${i}`} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-4 rounded-sm"
            style={{ backgroundColor: p.couleur }}
          />
          {p.texte}
        </li>
      ))}
    </ul>
  );
}

/**
 * La découpe d'une série de valeurs en cinq paliers par rang
 * (quintiles) : le premier cinquième est bon, le dernier est en
 * alerte. Renvoie un tableau parallèle de paliers.
 */
export function quintiles(valeurs: number[]): number[] {
  const tri = [...valeurs].sort((a, b) => a - b);
  return valeurs.map((v) => {
    const rang = tri.indexOf(v);
    return Math.min(4, Math.floor((5 * rang) / Math.max(tri.length, 1)));
  });
}
