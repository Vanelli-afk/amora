import type { Metadata } from "next";
import { AuthArt } from "@/components/auth/auth-art";
import { ResetForm } from "@/components/auth/recovery-forms";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <AuthArt line="Página nova," tagline="senha nova também" />
      <section className="auth-side"><ResetForm token={token ?? null} /></section>
    </>
  );
}
