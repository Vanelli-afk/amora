"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { Field, FieldError, GoogleButton, PasswordField, safeNext } from "./fields";

export function LoginForm({ googleEnabled, next }: { googleEnabled: boolean; next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error: failure } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("senha")),
    });
    if (failure) {
      setError(authErrorMessage(failure));
      setPending(false);
      return;
    }
    router.replace(safeNext(next));
    router.refresh();
  }

  return (
    <div className="card lg auth-card">
      <h2 className="ser auth-title">Que bom ver você de novo</h2>
      <p className="t2 auth-sub">Entre para abrir o seu dia.</p>
      <form className="col g16" onSubmit={submit}>
        <Field id="email" label="E-mail" icon="mail" type="email" placeholder="voce@exemplo.com" autoComplete="email" required maxLength={254} />
        <PasswordField id="senha" label="Senha" placeholder="Sua senha" autoComplete="current-password" />
        <div className="row auth-forgot"><Link className="btn btn-g" href="/esqueci-senha">Esqueci a senha</Link></div>
        {error ? <FieldError message={error} /> : null}
        <button className="btn btn-p btn-lg btn-w" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
        {googleEnabled ? <GoogleButton next={next} /> : null}
        <p className="tc">Ainda não tem conta? <Link className="b cr link" href="/criar-conta">Criar conta</Link></p>
      </form>
    </div>
  );
}

export function TwoFactorForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [useBackup, setUseBackup] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("codigo")).trim();
    const { error: failure } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code });
    if (failure) {
      setError(authErrorMessage(failure));
      setPending(false);
      return;
    }
    router.replace(safeNext(next));
    router.refresh();
  }

  return (
    <div className="card lg auth-card">
      <h2 className="ser auth-title">Só mais um passo</h2>
      <p className="t2 auth-sub">{useBackup ? "Digite um dos seus códigos de recuperação." : "Digite o código de 6 dígitos do seu aplicativo autenticador."}</p>
      <form className="col g16" onSubmit={submit}>
        <Field key={String(useBackup)} id="codigo" label="Código" icon="shield" autoComplete="one-time-code" inputMode={useBackup ? "text" : "numeric"} required maxLength={32} autoFocus />
        {error ? <FieldError message={error} /> : null}
        <button className="btn btn-p btn-lg btn-w" disabled={pending}>{pending ? "Verificando…" : "Confirmar"}</button>
        <button type="button" className="btn btn-g" onClick={() => setUseBackup((v) => !v)}>
          {useBackup ? "Usar o aplicativo autenticador" : "Usar um código de recuperação"}
        </button>
      </form>
    </div>
  );
}
