import type { Metadata } from "next";
import Link from "next/link";
import { AuthArt } from "@/components/auth/auth-art";

export const metadata: Metadata = { title: "Confirmar e-mail" };

// Quem confirma com sucesso já tem sessão e é levado a /hoje pelo layout. Só o erro chega aqui.
export default async function VerificarEmailPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <AuthArt line="Quase lá," tagline="falta só um passinho" />
      <section className="auth-side">
        <div className="card lg auth-card">
          <h2 className="ser auth-title">{error ? "Este link não vale mais" : "E-mail confirmado"}</h2>
          <p className="t2 auth-sub">
            {error
              ? "O link expirou ou já foi usado. Tente entrar: enviamos um novo automaticamente."
              : "Agora é só entrar para abrir o seu caderno."}
          </p>
          <Link className="btn btn-p btn-w" href="/entrar">Ir para entrar</Link>
        </div>
      </section>
    </>
  );
}
