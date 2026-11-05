"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { Field, FieldError, PasswordField } from "./fields";

export function ForgotForm() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const email = String(new FormData(event.currentTarget).get("email"));
    const { error: failure } = await authClient.requestPasswordReset({ email, redirectTo: "/redefinir-senha" });
    setPending(false);
    if (failure?.status === 429) {
      setError(authErrorMessage(failure));
      return;
    }
    // Mesma resposta exista ou não a conta, para não revelar quem está cadastrado.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card lg auth-card" role="status">
        <h2 className="ser auth-title">Olhe o seu e-mail</h2>
        <p className="t2 auth-sub">Se houver uma conta com esse endereço, enviamos um link para redefinir a senha. Ele vale por 30 minutos.</p>
        <Link className="btn btn-s btn-w" href="/entrar">Voltar para entrar</Link>
      </div>
    );
  }

  return (
    <div className="card lg auth-card">
      <h2 className="ser auth-title">Esqueceu a senha?</h2>
      <p className="t2 auth-sub">Acontece. Enviamos um link para você criar outra.</p>
      <form className="col g16" onSubmit={submit}>
        <Field id="email" label="E-mail" icon="mail" type="email" placeholder="voce@exemplo.com" autoComplete="email" required maxLength={254} />
        {error ? <FieldError message={error} /> : null}
        <button className="btn btn-p btn-lg btn-w" disabled={pending}>{pending ? "Enviando…" : "Enviar link"}</button>
        <p className="tc"><Link className="b cr link" href="/entrar">Voltar para entrar</Link></p>
      </form>
    </div>
  );
}

export function ResetForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError(undefined);
    setPending(true);
    const newPassword = String(new FormData(event.currentTarget).get("senha"));
    const { error: failure } = await authClient.resetPassword({ newPassword, token });
    if (failure) {
      setError(authErrorMessage(failure));
      setPending(false);
      return;
    }
    router.replace("/entrar?senha=redefinida");
  }

  if (!token) {
    return (
      <div className="card lg auth-card">
        <h2 className="ser auth-title">Link inválido</h2>
        <p className="t2 auth-sub">Este link expirou ou já foi usado.</p>
        <Link className="btn btn-p btn-w" href="/esqueci-senha">Pedir outro link</Link>
      </div>
    );
  }

  return (
    <div className="card lg auth-card">
      <h2 className="ser auth-title">Criar nova senha</h2>
      <p className="t2 auth-sub">Por segurança, todos os aparelhos serão desconectados.</p>
      <form className="col g16" onSubmit={submit}>
        <PasswordField id="senha" label="Nova senha" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" minLength={8} />
        {error ? <FieldError message={error} /> : null}
        <button className="btn btn-p btn-lg btn-w" disabled={pending}>{pending ? "Salvando…" : "Salvar nova senha"}</button>
      </form>
    </div>
  );
}
