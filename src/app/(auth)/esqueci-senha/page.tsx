import type { Metadata } from "next";
import { AuthArt } from "@/components/auth/auth-art";
import { ForgotForm } from "@/components/auth/recovery-forms";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function EsqueciSenhaPage() {
  return (
    <>
      <AuthArt line="Sem pressa," tagline="a gente dá um jeito" />
      <section className="auth-side"><ForgotForm /></section>
    </>
  );
}
