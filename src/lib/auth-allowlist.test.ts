import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { prepareDb } from "@/test/db";

const allowed = `${randomUUID()}@permitido.local`;
const blocked = `${randomUUID()}@bloqueado.local`;

// A lista é lida ao criar o usuário, mas o env() guarda o primeiro valor: precisa vir antes do import.
process.env.ALLOWED_EMAILS = allowed;
const { auth } = await import("./auth");

const signUp = (email: string) => auth.api.signUpEmail({
  body: { name: "Pessoa", email, password: "senha-de-teste-123", acceptTerms: true } as never,
});
const rows = (email: string) => db.select().from(schema.user).where(eq(schema.user.email, email));

beforeAll(prepareDb);

describe("cadastro restrito", () => {
  it("recusa e-mail fora da lista, sem criar a conta", async () => {
    await expect(signUp(blocked)).rejects.toMatchObject({ body: { message: "EMAIL_NOT_ALLOWED" } });
    expect(await rows(blocked)).toEqual([]);
  });

  it("aceita e-mail da lista", async () => {
    await signUp(allowed);
    expect(await rows(allowed)).toHaveLength(1);
  });
});
