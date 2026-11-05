import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Único ponto que decide quem é o usuário atual. O id nunca vem do cliente. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/entrar");
  return session.user;
}
