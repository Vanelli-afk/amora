import type { Metadata } from "next";
import { AuthArt } from "@/components/auth/auth-art";
import { LoginForm, TwoFactorForm } from "@/components/auth/login-form";
import { isGoogleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar" };

type Search = Promise<{ etapa?: string; volta?: string; senha?: string }>;

export default async function EntrarPage({ searchParams }: { searchParams: Search }) {
  const { etapa, volta, senha } = await searchParams;
  return (
    <>
      <AuthArt line="Querido diário," tagline="o seu cantinho de cada dia" />
      <section className="auth-side">
        <div className="col g12 auth-stack">
          {senha === "redefinida" ? <p className="toast" role="status">Senha alterada. Entre com a nova senha.</p> : null}
          {etapa === "2fa" ? <TwoFactorForm next={volta} /> : <LoginForm googleEnabled={isGoogleEnabled()} next={volta} />}
        </div>
      </section>
    </>
  );
}
