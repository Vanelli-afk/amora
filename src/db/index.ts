import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// Mantém um único pool entre recargas do servidor de desenvolvimento.
const store = globalThis as unknown as { __amoraPool?: Pool; __amoraDb?: Db };

function open(): Db {
  if (!store.__amoraDb) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não definida.");
    // Na Vercel cada instância abre o próprio pool; quem multiplexa as conexões é o pooler do banco.
    store.__amoraPool = new Pool({ connectionString, max: process.env.VERCEL ? 3 : 10 });
    store.__amoraDb = drizzle(store.__amoraPool, { schema });
  }
  return store.__amoraDb;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = open();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export async function closeDb() {
  await store.__amoraPool?.end();
  store.__amoraPool = undefined;
  store.__amoraDb = undefined;
}

export { schema };
