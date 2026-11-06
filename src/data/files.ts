import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { processImage, type ImageKind } from "@/lib/image";

/** Regrava a imagem e registra o arquivo em nome do dono. */
export async function saveImage(userId: string, kind: ImageKind, input: Buffer): Promise<string> {
  const body = await processImage(kind, input);
  const [row] = await db.insert(schema.files)
    .values({ userId, kind, mime: "image/webp", size: body.length, body })
    .returning({ id: schema.files.id });
  if (!row) throw new Error("Falha ao registrar o arquivo.");
  return row.id;
}

/** Só devolve o arquivo se ele pertencer a este usuário. */
export async function readUserFile(userId: string, fileId: string) {
  const [file] = await db.select({ mime: schema.files.mime, body: schema.files.body }).from(schema.files)
    .where(and(eq(schema.files.id, fileId), eq(schema.files.userId, userId)));
  return file ?? null;
}

export async function removeFile(userId: string, fileId: string) {
  await db.delete(schema.files).where(and(eq(schema.files.id, fileId), eq(schema.files.userId, userId)));
}
