import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // La plateforme reste consultable sans base ; les pages qui ont
  // besoin des données afficheront une erreur claire.
  console.warn("DATABASE_URL absente : la base n'est pas joignable.");
}

// prepare: false est requis derrière le regroupement de connexions de
// Neon, et ne change rien en local.
const client = postgres(connectionString ?? "", { prepare: false });

export const db = drizzle(client, { schema });
