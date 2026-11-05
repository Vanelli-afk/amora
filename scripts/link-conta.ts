// Gera o link de confirmação de uma conta já criada, enquanto não há envio de e-mail.
// Uso: npm run link:conta -- pessoa@exemplo.com
import { createEmailVerificationToken } from "better-auth/api";
import { Client } from "pg";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Este comando não roda em produção.");

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Informe o e-mail: npm run link:conta -- pessoa@exemplo.com");

  const secret = process.env.BETTER_AUTH_SECRET;
  const baseUrl = process.env.BETTER_AUTH_URL;
  if (!secret || !baseUrl) throw new Error("Falta o .env. Rode `npm run setup`.");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query<{ email_verified: boolean }>('SELECT email_verified FROM "user" WHERE email = $1', [email]);
  await client.end();

  const account = rows[0];
  if (!account) throw new Error(`Não há conta com ${email}. Crie em ${baseUrl}/criar-conta primeiro.`);
  if (account.email_verified) {
    console.log(`${email} já está confirmado: é só entrar em ${baseUrl}/entrar`);
    return;
  }

  const token = await createEmailVerificationToken(secret, email);
  console.log(`\nLink de confirmação para ${email} (vale por 1 hora, não compartilhe):\n`);
  console.log(`${baseUrl}/api/auth/verify-email?token=${token}&callbackURL=%2Fverificar-email\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao gerar o link.");
  process.exitCode = 1;
});
