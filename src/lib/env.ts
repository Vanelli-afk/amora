import "server-only";
import { z } from "zod";

const optional = z.string().optional().transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  DATA_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, {
    message: "DATA_ENCRYPTION_KEY precisa ter 32 bytes em base64",
  }),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  SMTP_URL: optional,
  EMAIL_FROM: z.string().default("Amora <nao-responda@amora.local>"),
  MAIL_CAPTURE_FILE: optional,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional,
  GOOGLE_BOOKS_API_KEY: optional,
  STORAGE_DIR: z.string().default("./storage"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Lido sob demanda: `next build` importa os módulos sem precisar de todos os segredos.
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente inválidas: ${fields}. Rode \`npm run setup\`.`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.SMTP_URL) {
    throw new Error("SMTP_URL é obrigatória em produção.");
  }
  cached = parsed.data;
  return cached;
}
