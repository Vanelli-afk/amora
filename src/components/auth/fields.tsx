"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { authClient, authErrorMessage } from "@/lib/auth-client";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; icon: IconName; error?: string };

export function Field({ id, label, icon, error, ...input }: FieldProps) {
  return (
    <div>
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="inw">
        <Icon name={icon} />
        <input id={id} name={id} className={`inp${error ? " err" : ""}`} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-erro` : undefined} {...input} />
      </div>
      {error ? <FieldError id={`${id}-erro`} message={error} /> : null}
    </div>
  );
}

export function PasswordField({ id, label, placeholder, autoComplete, error, minLength }: {
  id: string; label: string; placeholder?: string; autoComplete: string; error?: string; minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="inw">
        <Icon name="lock" />
        <input id={id} name={id} className={`inp inp-trail${error ? " err" : ""}`} type={visible ? "text" : "password"} placeholder={placeholder} autoComplete={autoComplete} required minLength={minLength} maxLength={128} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-erro` : undefined} />
        <button type="button" className="btn btn-g btn-ic" aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </div>
      {error ? <FieldError id={`${id}-erro`} message={error} /> : null}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} className="errmsg" role="alert">
      <Icon name="warn" size="s" />
      {message}
    </p>
  );
}

export function GoogleButton({ next }: { next?: string }) {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const { error: failure } = await authClient.signIn.social({ provider: "google", callbackURL: safeNext(next) });
    if (failure) {
      setError(authErrorMessage(failure));
      setPending(false);
    }
  }

  return (
    <>
      <div className="row g12 t3 sm b"><hr className="line f1" /><span>ou</span><hr className="line f1" /></div>
      <button type="button" className="btn btn-s btn-lg btn-w" onClick={signIn} disabled={pending}>
        <span aria-hidden="true" className="google-mark">G</span>
        Continuar com Google
      </button>
      {error ? <FieldError message={error} /> : null}
    </>
  );
}

/** Aceita apenas caminhos internos, para o parâmetro "volta" não virar redirecionamento aberto. */
export function safeNext(value: string | null | undefined): string {
  // O navegador descarta tabulações e quebras de linha e trata "\" como "/": "/\t/site" viraria "//site".
  if (!value || !value.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(value)) return "/hoje";
  const origin = "https://amora.invalid";
  try {
    const url = new URL(value, origin);
    // Confere o resultado, não só a entrada: "/.//site" normaliza para "//site".
    return url.origin === origin && !url.pathname.startsWith("//") ? `${url.pathname}${url.search}${url.hash}` : "/hoje";
  } catch {
    return "/hoje";
  }
}
