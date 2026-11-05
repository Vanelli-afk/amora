import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

const keys = new Map<string, Buffer>();

function masterKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY inválida.");
  return key;
}

// Chave própria por usuário: comprometer um registro não dá acesso aos de outra conta.
function userKey(userId: string): Buffer {
  const cached = keys.get(userId);
  if (cached) return cached;
  const derived = Buffer.from(hkdfSync("sha256", masterKey(), "amora/field-encryption/v1", userId, 32));
  if (keys.size > 500) keys.clear();
  keys.set(userId, derived);
  return derived;
}

// O AAD amarra o texto cifrado ao dono e ao campo: copiá-lo para outra linha faz a decifragem falhar.
const aad = (userId: string, field: string) => Buffer.from(`${userId}\0${field}`);

export function encrypt(plain: string, userId: string, field: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", userKey(userId), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(userId, field));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}.${iv.toString("base64url")}.${body.toString("base64url")}`;
}

export function decrypt(payload: string, userId: string, field: string): string {
  const [version, ivPart, bodyPart] = payload.split(".");
  if (version !== VERSION || !ivPart || !bodyPart) throw new Error("Formato cifrado desconhecido.");
  const iv = Buffer.from(ivPart, "base64url");
  const body = Buffer.from(bodyPart, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", userKey(userId), iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(aad(userId, field));
  decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
  return Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_BYTES)), decipher.final()]).toString("utf8");
}

export const encryptOpt = (plain: string | null | undefined, userId: string, field: string) =>
  plain ? encrypt(plain, userId, field) : null;

export const decryptOpt = (payload: string | null | undefined, userId: string, field: string) =>
  payload ? decrypt(payload, userId, field) : null;
