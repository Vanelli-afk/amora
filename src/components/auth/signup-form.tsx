"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { Field, FieldError, GoogleButton, PasswordField } from "./fields";

export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    if (form.get("termos") !== "on") {
      setError("Para continuar, aceite os termos e a política de privacidade.");
      return;
    }
    setPending(true);
    const email = String(form.get("email"));
    // acceptTerms é conferido no servidor por um hook do Better Auth.
    const payload = {
      name: String(form.get("nome")).trim(),
      email,
      password: String(form.get("senha")),
      callbackURL: "/verificar-email",
      acceptTerms: true,
    };
    const { error: failure } = await authClient.signUp.email(payload as Parameters<typeof authClient.signUp.email>[0]);
    if (failure) {
      setError(authErrorMessage(failure));
      setPending(false);
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="card lg auth-card tc" role="status">
        <Icon name="mail" size="xl" className="cr" />
        <h2 className="ser auth-title" style={{ marginTop: 12 }}>Olhe o seu e-mail</h2>
        <p className="t2 auth-sub">Enviamos um link de confirmação para <b>{sentTo}</b>. Confirme para abrir o seu caderno.</p>
        <Link className="btn btn-s btn-w" href="/entrar">Voltar para entrar</Link>
      </div>
    );
  }

  return (
    <div className="card lg auth-card">
      <h2 className="ser auth-title">Criar conta</h2>
      <p className="t2 auth-sub">Vamos abrir o seu caderno.</p>
      <form className="col g16" onSubmit={submit}>
        <Field id="nome" label="Nome" icon="user" placeholder="Como quer ser chamado?" autoComplete="name" required maxLength={80} />
        <Field id="email" label="E-mail" icon="mail" type="email" placeholder="voce@exemplo.com" autoComplete="email" required maxLength={254} />
        <PasswordField id="senha" label="Senha" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" minLength={8} />
        <label className="row g12 consent">
          <input className="ck" type="checkbox" name="termos" required />
          <span className="sm">Li e aceito os <Link className="b cr link" href="/termos" target="_blank">termos</Link> e a <Link className="b cr link" href="/privacidade" target="_blank">política de privacidade</Link>.</span>
        </label>
        {error ? <FieldError message={error} /> : null}
        <button className="btn btn-p btn-lg btn-w" disabled={pending}>{pending ? "Criando…" : "Criar conta"}</button>
        {googleEnabled ? (
          <>
            <GoogleButton />
            <p className="xs t2 tc">Ao continuar com o Google, você aceita os termos e a política de privacidade.</p>
          </>
        ) : null}
        <p className="tc">Já tem conta? <Link className="b cr link" href="/entrar">Entrar</Link></p>
      </form>
    </div>
  );
}
