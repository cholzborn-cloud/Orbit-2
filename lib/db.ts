import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to connect to Neon.");
}

export const db = drizzle(neon(process.env.DATABASE_URL), { schema });
