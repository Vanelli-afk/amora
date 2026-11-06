import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://u:p@h/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "https://amora.example",
  DATA_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
};

const production = {
  ...base,
  NODE_ENV: "production",
  SMTP_URL: "smtp://u:p@smtp.example:587",
  EMAIL_FROM: "Amora <nao-responda@amora.example>",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "publica",
  VAPID_PRIVATE_KEY: "privada",
  VAPID_SUBJECT: "mailto:contato@amora.example",
  CRON_SECRET: "c".repeat(32),
  ALLOWED_EMAILS: "pessoa@exemplo.com",
};

describe("parseEnv", () => {
  it("em desenvolvimento, aceita só o essencial", () => {
    expect(parseEnv(base).EMAIL_FROM).toContain("amora.local");
  });

  it("em produção, aceita a configuração completa", () => {
    expect(parseEnv(production).CRON_SECRET).toBe(production.CRON_SECRET);
  });

  it.each(["SMTP_URL", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "CRON_SECRET", "EMAIL_FROM", "ALLOWED_EMAILS"])(
    "em produção, exige %s",
    (name) => {
      expect(() => parseEnv({ ...production, [name]: "" })).toThrow(name);
    },
  );

  it.each(["EMAIL_FROM", "VAPID_SUBJECT"])("em produção, recusa o endereço de exemplo em %s", (name) => {
    expect(() => parseEnv({ ...production, [name]: "mailto:contato@amora.local" })).toThrow(name);
  });

  it("em produção, recusa CRON_SECRET curto", () => {
    expect(() => parseEnv({ ...production, CRON_SECRET: "curto" })).toThrow("CRON_SECRET");
  });

  it("não revela valores na mensagem de erro", () => {
    expect(() => parseEnv({ ...production, BETTER_AUTH_SECRET: "segredo-curto" })).toThrow(/^(?!.*segredo-curto)/);
  });
});
