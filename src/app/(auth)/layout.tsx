import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getSession()) redirect("/hoje");
  return <div className="auth-page">{children}</div>;
}
