import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteStored, processImage, readStored, writeStored, type ImageKind } from "@/lib/storage";

/** Regrava a imagem e registra o arquivo em nome do dono. */
export async function saveImage(userId: string, kind: ImageKind, input: Buffer): Promise<string> {
  const output = await processImage(kind, input);
  const storageKey = await writeStored(output);
  const [row] = await db.insert(schema.files)
    .values({ userId, kind, mime: "image/webp", size: output.length, storageKey })
    .returning({ id: schema.files.id });
  if (!row) throw new Error("Falha ao registrar o arquivo.");
  return row.id;
}

/** Só devolve o arquivo se ele pertencer a este usuário. */
export async function readUserFile(userId: string, fileId: string) {
  const [file] = await db.select().from(schema.files)
    .where(and(eq(schema.files.id, fileId), eq(schema.files.userId, userId)));
  if (!file) return null;
  const body = await readStored(file.storageKey);
  return body ? { mime: file.mime, body } : null;
}

export async function removeFile(userId: string, fileId: string) {
  const [file] = await db.delete(schema.files)
    .where(and(eq(schema.files.id, fileId), eq(schema.files.userId, userId)))
    .returning({ storageKey: schema.files.storageKey });
  if (file) await deleteStored(file.storageKey);
}

export async function removeAllUserFiles(userId: string) {
  const rows = await db.select({ storageKey: schema.files.storageKey }).from(schema.files)
    .where(eq(schema.files.userId, userId));
  await Promise.all(rows.map((row) => deleteStored(row.storageKey)));
}
