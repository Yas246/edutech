import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // La plateforme reste consultable sans base ; les pages qui ont
  // besoin des données afficheront une erreur claire.
  console.warn("DATABASE_URL absente : la base n'est pas joignable.");
}

const client = neon(connectionString ?? "");

export const db = drizzle(client, { schema });
