import "dotenv/config";
import { envoyerRelances } from "../src/lib/relances";

async function principal() {
  const resultat = await envoyerRelances();
  console.log(
    `Relances : ${resultat.envoyees} envoyée(s) (jalons ${resultat.jalons.join(", ")} jours).`,
  );
  process.exit(0);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
