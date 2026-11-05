import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { UserError } from "./errors";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp"]);

// O cache do sharp segura imagens já processadas na memória, e aqui nenhuma se repete.
sharp.cache(false);
sharp.concurrency(2);

export type ImageKind = "cover" | "avatar";

const dir = () => resolve(process.env.STORAGE_DIR ?? "./storage");

/**
 * Regrava toda imagem recebida: confere o conteúdo real em vez do nome ou do tipo informado,
 * remove metadados (EXIF, GPS) e garante que nada além de WebP chega ao disco.
 */
export async function processImage(kind: ImageKind, input: Buffer): Promise<Buffer> {
  if (input.length > MAX_UPLOAD_BYTES) throw new UserError("A imagem precisa ter até 5 MB.");
  try {
    const image = sharp(input, { limitInputPixels: 25_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.format || !ACCEPTED.has(meta.format)) throw new UserError("Envie uma imagem JPG ou PNG.");
    const resized = kind === "avatar"
      ? image.rotate().resize(256, 256, { fit: "cover" })
      : image.rotate().resize(600, 900, { fit: "inside", withoutEnlargement: true });
    return await resized.webp({ quality: 80 }).toBuffer();
  } catch (error) {
    if (error instanceof UserError) throw error;
    throw new UserError("Envie uma imagem JPG ou PNG válida.");
  }
}

export async function writeStored(body: Buffer): Promise<string> {
  const key = `${randomUUID()}.webp`;
  await mkdir(dir(), { recursive: true });
  await writeFile(join(dir(), key), body, { mode: 0o600 });
  return key;
}

export async function readStored(key: string): Promise<Buffer | null> {
  try {
    return await readFile(join(dir(), key));
  } catch {
    return null;
  }
}

export async function deleteStored(key: string): Promise<void> {
  await rm(join(dir(), key), { force: true });
}
