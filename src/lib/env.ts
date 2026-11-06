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
  EMAIL_FROM: optional.transform((v) => v ?? "Amora <nao-responda@amora.local>"),
  MAIL_CAPTURE_FILE: optional,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional,
  GOOGLE_BOOKS_API_KEY: optional,
  CRON_SECRET: optional,
  ALLOWED_EMAILS: optional,
});

export type Env = z.infer<typeof schema>;

const invalid = (fields: string[]) =>
  new Error(`Variáveis de ambiente inválidas: ${fields.join(", ")}. Em desenvolvimento, rode \`npm run setup\`; em produção, veja docs/lancamento.md.`);

/** Em produção, o que só faltaria na hora de enviar um e-mail ou lembrete precisa falhar ao iniciar. */
function productionProblems(data: Env): string[] {
  const usesExample = (value: string | undefined) => !value || value.includes("amora.local");
  const problems = [
    !data.SMTP_URL && "SMTP_URL",
    !data.NEXT_PUBLIC_VAPID_PUBLIC_KEY && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    !data.VAPID_PRIVATE_KEY && "VAPID_PRIVATE_KEY",
    usesExample(data.VAPID_SUBJECT) && "VAPID_SUBJECT",
    usesExample(data.EMAIL_FROM) && "EMAIL_FROM",
    (data.CRON_SECRET?.length ?? 0) < 32 && "CRON_SECRET",
    // Abrir o cadastro precisa ser uma escolha (`*`), nunca o efeito de esquecer a variável.
    !data.ALLOWED_EMAILS && "ALLOWED_EMAILS",
  ];
  return problems.filter((name) => typeof name === "string");
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw invalid(parsed.error.issues.map((i) => i.path.join(".")));
  if (parsed.data.NODE_ENV === "production") {
    const problems = productionProblems(parsed.data);
    if (problems.length) throw invalid(problems);
  }
  return parsed.data;
}

let cached: Env | undefined;

export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
