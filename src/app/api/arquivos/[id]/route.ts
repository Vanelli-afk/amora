import { z } from "zod";
import { readUserFile } from "@/data/files";
import { getSession } from "@/lib/session";

// Arquivos são privados: sem sessão ou de outro dono, a resposta é a mesma, para não revelar se existem.
const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return notFound();

  const session = await getSession();
  if (!session) return notFound();

  const file = await readUserFile(session.user.id, id);
  if (!file) return notFound();

  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
