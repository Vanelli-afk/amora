import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit não carrega o .env sozinho.
if (!process.env.DATABASE_URL) {
  try {
    const match = readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m);
    if (match?.[1]) process.env.DATABASE_URL = match[1].trim();
  } catch {
    // Sem .env: a validação abaixo acusa a falta.
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida. Rode `npm run setup`.");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
});
