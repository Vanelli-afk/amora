import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, schema } from "@/db";

let migrated = false;

export async function prepareDb() {
  if (!process.env.DATABASE_URL?.includes("amora_test")) {
    throw new Error("Os testes de integração só rodam no banco amora_test.");
  }
  if (!migrated) {
    await migrate(db, { migrationsFolder: "drizzle" });
    migrated = true;
  }
}

export async function createUser(name = "Pessoa de teste") {
  const id = randomUUID();
  await db.insert(schema.user).values({ id, name, email: `${id}@teste.local`, emailVerified: true });
  return id;
}
