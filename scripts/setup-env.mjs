// Gera um .env local com segredos aleatórios. Nunca sobrescreve um .env existente,
// pois trocar DATA_ENCRYPTION_KEY tornaria ilegíveis os dados já criptografados.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

if (existsSync(".env")) {
  console.log(".env já existe; nada foi alterado.");
  process.exit(0);
}

const secret = (n = 32) => randomBytes(n).toString("base64");
const dbPassword = randomBytes(24).toString("hex");

let vapidPublic = "";
let vapidPrivate = "";
try {
  const webPush = createRequire(import.meta.url)("web-push");
  const keys = webPush.generateVAPIDKeys();
  vapidPublic = keys.publicKey;
  vapidPrivate = keys.privateKey;
} catch {
  console.warn("web-push indisponível; rode `npm install` e preencha as chaves VAPID depois.");
}

const env = readFileSync(".env.example", "utf8")
  .replace("__DB_PASSWORD__", dbPassword)
  .replaceAll("__DB_PASSWORD__", dbPassword)
  .replace("__BETTER_AUTH_SECRET__", secret())
  .replace("__DATA_ENCRYPTION_KEY__", secret())
  .replace("__VAPID_PUBLIC__", vapidPublic)
  .replace("__VAPID_PRIVATE__", vapidPrivate);

writeFileSync(".env", env, { mode: 0o600 });
console.log(".env criado. Faça backup de DATA_ENCRYPTION_KEY em local separado do banco.");
