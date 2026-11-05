import type { Metadata } from "next";
import { AuthArt } from "@/components/auth/auth-art";
import { SignupForm } from "@/components/auth/signup-form";
import { isGoogleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Criar conta" };

export default function CriarContaPage() {
  return (
    <>
      <AuthArt line="Primeira página" tagline="cada dia, uma página nova" />
      <section className="auth-side">
        <SignupForm googleEnabled={isGoogleEnabled()} />
      </section>
    </>
  );
}
