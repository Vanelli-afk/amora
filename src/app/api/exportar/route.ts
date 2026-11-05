import { exportUserData } from "@/data/export";
import { allow } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });

  if (!(await allow(`export:${session.user.id}`, 5, 60 * 60))) {
    return new Response("Muitas exportações. Tente mais tarde.", { status: 429 });
  }

  const data = await exportUserData(session.user.id);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="amora-dados-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
