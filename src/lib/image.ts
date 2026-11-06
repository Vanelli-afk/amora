import "server-only";
import sharp from "sharp";
import { UserError } from "./errors";
import { MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE } from "./upload-limit";

const ACCEPTED = new Set(["jpeg", "png", "webp"]);

// O cache do sharp segura imagens já processadas na memória, e aqui nenhuma se repete.
sharp.cache(false);
sharp.concurrency(2);

export type ImageKind = "cover" | "avatar";

/**
 * Regrava toda imagem recebida: confere o conteúdo real em vez do nome ou do tipo informado,
 * remove metadados (EXIF, GPS) e garante que nada além de WebP chega ao banco.
 */
export async function processImage(kind: ImageKind, input: Buffer): Promise<Buffer> {
  if (input.length > MAX_UPLOAD_BYTES) throw new UserError(UPLOAD_TOO_LARGE);
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
