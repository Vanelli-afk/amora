"use client";

import { AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { FieldError, PasswordField } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { Overlay } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { authClient, authErrorMessage } from "@/lib/auth-client";

type Account = { providerId: string; accountId: string };
type DeviceSession = { token: string; userAgent?: string | null; updatedAt: Date | string };

function describeDevice(userAgent?: string | null) {
  if (!userAgent) return "Aparelho desconhecido";
  const os = /iphone|ipad/i.test(userAgent) ? "iPhone" : /android/i.test(userAgent) ? "Android" : /windows/i.test(userAgent) ? "Windows" : /mac os/i.test(userAgent) ? "Mac" : /linux/i.test(userAgent) ? "Linux" : "Aparelho";
  const browser = /edg\//i.test(userAgent) ? "Edge" : /chrome\//i.test(userAgent) ? "Chrome" : /firefox\//i.test(userAgent) ? "Firefox" : /safari\//i.test(userAgent) ? "Safari" : "Navegador";
  return `${browser} · ${os}`;
}

export function ConnectedAccounts({ googleEnabled, email }: { googleEnabled: boolean; email: string }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const { data } = await authClient.listAccounts();
    setAccounts((data as Account[] | null) ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const google = accounts?.find((a) => a.providerId === "google");
  const hasPassword = accounts?.some((a) => a.providerId === "credential");

  function disconnect() {
    if (!google) return;
    start(async () => {
      const { error } = await authClient.unlinkAccount({ accountId: google.accountId });
      if (error) {
        toast(authErrorMessage(error), { tone: "error" });
        return;
      }
      await load();
    });
  }

  function connect() {
    start(async () => {
      const { error } = await authClient.linkSocial({ provider: "google", callbackURL: "/perfil" });
      if (error) toast(authErrorMessage(error), { tone: "error" });
    });
  }

  if (!googleEnabled && !google) return null;

  return (
    <section className="card lg">
      <h2 className="h3" style={{ marginBottom: 6 }}>Contas conectadas</h2>
      <div className="list-row">
        <span aria-hidden="true" className="google-mark" style={{ width: 40, height: 40, fontSize: 18, flex: "none" }}>G</span>
        <div className="f1" style={{ minWidth: 0 }}><b>Google</b><div className="xs t2 ell">{google ? `${email} · só para entrar` : "Entre também com a sua conta Google"}</div></div>
        {google ? (
          <>
            <span className="tag c-sage only-desktop"><Icon name="check" size="s" style={{ width: 14, height: 14 }} />Conectada</span>
            <button type="button" className="btn btn-g" onClick={disconnect} disabled={pending || !hasPassword} title={hasPassword ? undefined : "Crie uma senha antes de desconectar"}>Desconectar</button>
          </>
        ) : <button type="button" className="btn btn-s" onClick={connect} disabled={pending}>Conectar</button>}
      </div>
    </section>
  );
}

export function SecurityCard({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"senha" | "2fa" | "2fa-off" | null>(null);
  const [error, setError] = useState<string>();
  const [totp, setTotp] = useState<{ uri: string; backup: string[] } | null>(null);
  const [pending, start] = useTransition();

  const loadSessions = useCallback(async () => {
    const [list, me] = await Promise.all([authClient.listSessions(), authClient.getSession()]);
    setSessions((list.data as DeviceSession[] | null) ?? []);
    setCurrent(me.data?.session.token ?? null);
  }, []);

  useEffect(() => {
    void loadSessions();
    void authClient.listAccounts().then(({ data }) => {
      setHasPassword(((data as Account[] | null) ?? []).some((a) => a.providerId === "credential"));
    });
  }, [loadSessions]);

  function close() {
    setDialog(null);
    setError(undefined);
    setTotp(null);
    router.refresh();
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    start(async () => {
      const { error: failure } = await authClient.changePassword({
        currentPassword: String(form.get("atual")),
        newPassword: String(form.get("nova")),
        revokeOtherSessions: true,
      });
      if (failure) {
        setError(authErrorMessage(failure));
        return;
      }
      toast("Senha alterada. Os outros aparelhos foram desconectados.");
      close();
      void loadSessions();
    });
  }

  function enableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("senha2fa"));
    setError(undefined);
    start(async () => {
      const { data, error: failure } = await authClient.twoFactor.enable({ password });
      if (failure || !data || !("totpURI" in data)) {
        setError(authErrorMessage(failure));
        return;
      }
      setTotp({ uri: data.totpURI, backup: data.backupCodes });
    });
  }

  function confirmTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("codigo2fa")).trim();
    setError(undefined);
    start(async () => {
      const { error: failure } = await authClient.twoFactor.verifyTotp({ code });
      if (failure) {
        setError(authErrorMessage(failure));
        return;
      }
      toast("Verificação em duas etapas ativada");
      close();
    });
  }

  function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("senha2fa"));
    setError(undefined);
    start(async () => {
      const { error: failure } = await authClient.twoFactor.disable({ password });
      if (failure) {
        setError(authErrorMessage(failure));
        return;
      }
      toast("Verificação em duas etapas desativada");
      close();
    });
  }

  function revoke(token: string) {
    start(async () => {
      const { error: failure } = await authClient.revokeSession({ token });
      if (failure) toast(authErrorMessage(failure), { tone: "error" });
      await loadSessions();
    });
  }

  const secret = totp ? new URL(totp.uri).searchParams.get("secret") : null;

  return (
    <section className="card lg">
      <h2 className="h3" style={{ marginBottom: 4 }}>Segurança</h2>
      {hasPassword === null ? <div className="skl" aria-hidden="true" style={{ height: 124, margin: "6px 0" }} /> : null}
      {hasPassword ? (
        <>
          <div className="list-row">
            <div className="f1"><b>Senha</b><div className="xs t2">Trocar desconecta os outros aparelhos</div></div>
            <button type="button" className="btn btn-s" onClick={() => setDialog("senha")}>Trocar</button>
          </div>
          <div className="list-row">
            <div className="f1"><b>Verificação em duas etapas</b><div className="xs t2">{twoFactorEnabled ? "Ativada" : "Pede um código do aplicativo autenticador ao entrar"}</div></div>
            <button type="button" className="btn btn-s" onClick={() => setDialog(twoFactorEnabled ? "2fa-off" : "2fa")}>{twoFactorEnabled ? "Desativar" : "Ativar"}</button>
          </div>
        </>
      ) : null}
      <h3 className="eyebrow" style={{ marginTop: 16 }}>Aparelhos conectados</h3>
      {!sessions.length ? <div className="skl session-row" aria-hidden="true" style={{ margin: "6px 0" }} /> : null}
      {sessions.map((device) => (
        <div key={device.token} className="list-row session-row">
          <Icon name="shield" size="s" className="t2" />
          <div className="f1" style={{ minWidth: 0 }}>
            <b className="ell" style={{ display: "block" }}>{describeDevice(device.userAgent)}</b>
            <div className="xs t2">{device.token === current ? "Este aparelho" : `Ativo em ${new Date(device.updatedAt).toLocaleDateString("pt-BR")}`}</div>
          </div>
          {device.token !== current ? <button type="button" className="btn btn-g" onClick={() => revoke(device.token)} disabled={pending}>Desconectar</button> : null}
        </div>
      ))}

      <AnimatePresence>
        {dialog === "senha" ? (
          <Overlay key="senha" label="Trocar senha" variant="modal" narrow onClose={close}>
            <h2 className="ser" style={{ fontSize: 26, fontWeight: 600, marginBottom: 14 }}>Trocar senha</h2>
            <form className="col g16" onSubmit={changePassword}>
              <PasswordField id="atual" label="Senha atual" autoComplete="current-password" />
              <PasswordField id="nova" label="Nova senha" placeholder="Mínimo de 8 caracteres" autoComplete="new-password" minLength={8} />
              {error ? <FieldError message={error} /> : null}
              <div className="row g8" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-s" onClick={close}>Cancelar</button>
                <button className="btn btn-p" disabled={pending}>Salvar</button>
              </div>
            </form>
          </Overlay>
        ) : null}

        {dialog === "2fa" ? (
          <Overlay key="2fa" label="Ativar verificação em duas etapas" variant="modal" narrow onClose={close}>
            <h2 className="ser" style={{ fontSize: 26, fontWeight: 600, marginBottom: 14 }}>Verificação em duas etapas</h2>
            {!totp ? (
              <form className="col g16" onSubmit={enableTwoFactor}>
                <PasswordField id="senha2fa" label="Confirme a sua senha" autoComplete="current-password" />
                {error ? <FieldError message={error} /> : null}
                <button className="btn btn-p" disabled={pending}>Continuar</button>
              </form>
            ) : (
              <form className="col g12" onSubmit={confirmTwoFactor}>
                <p className="sm">1. No aplicativo autenticador, adicione uma conta com esta chave:</p>
                <div className="secret-box">{secret}</div>
                <a className="btn btn-s only-mobile" href={totp.uri}>Abrir no aplicativo</a>
                <p className="sm">2. Guarde estes códigos de recuperação. Eles só aparecem agora:</p>
                <div className="backup-codes">{totp.backup.map((code) => <span key={code}>{code}</span>)}</div>
                <div><label className="lbl" htmlFor="codigo2fa">3. Digite o código de 6 dígitos</label><input id="codigo2fa" name="codigo2fa" className="inp num" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></div>
                {error ? <FieldError message={error} /> : null}
                <button className="btn btn-p" disabled={pending}>Ativar</button>
              </form>
            )}
          </Overlay>
        ) : null}

        {dialog === "2fa-off" ? (
          <Overlay key="2fa-off" label="Desativar verificação em duas etapas" variant="modal" narrow onClose={close}>
            <h2 className="ser" style={{ fontSize: 26, fontWeight: 600, marginBottom: 14 }}>Desativar duas etapas?</h2>
            <form className="col g16" onSubmit={disableTwoFactor}>
              <PasswordField id="senha2fa" label="Confirme a sua senha" autoComplete="current-password" />
              {error ? <FieldError message={error} /> : null}
              <div className="row g8" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-s" onClick={close}>Cancelar</button>
                <button className="btn btn-danger" disabled={pending}>Desativar</button>
              </div>
            </form>
          </Overlay>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

export function DataCard({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    void authClient.listAccounts().then(({ data }) => {
      setHasPassword(((data as Account[] | null) ?? []).some((a) => a.providerId === "credential"));
    });
  }, []);

  function destroy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = hasPassword ? String(new FormData(event.currentTarget).get("senha-excluir")) : undefined;
    setError(undefined);
    start(async () => {
      const { error: failure } = await authClient.deleteUser(password ? { password } : {});
      if (failure) {
        setError(authErrorMessage(failure));
        return;
      }
      router.replace("/entrar");
      router.refresh();
    });
  }

  return (
    <section className="card lg">
      <h2 className="h3" style={{ marginBottom: 4 }}>Seus dados</h2>
      <p className="sm t2" style={{ marginBottom: 12 }}>Baixe uma cópia de tudo o que você escreveu no Amora: compromissos, tarefas, notas e livros.</p>
      <div className="row g12 wrap">
        <a className="btn btn-s" href="/api/exportar" download><Icon name="download" size="s" />Exportar dados</a>
        <span className="xs t3">Arquivo em JSON, pronto em poucos segundos</span>
      </div>
      <hr className="line" style={{ margin: "16px 0" }} />
      <div className="row jb g12 wrap">
        <div className="f1" style={{ minWidth: 200 }}><b>Excluir conta</b><div className="xs t2">Apaga tudo de forma definitiva, sem como recuperar.</div></div>
        <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>Excluir conta</button>
      </div>

      <AnimatePresence>
        {open ? (
          <Overlay key="excluir" label="Excluir conta" variant="modal" narrow onClose={() => setOpen(false)}>
            <h2 className="ser" style={{ fontSize: 26, fontWeight: 600 }}>Excluir a sua conta?</h2>
            <p className="t2" style={{ margin: "8px 0 16px" }}>Todos os compromissos, tarefas, notas, livros e arquivos serão apagados. Considere exportar os dados antes.</p>
            <form className="col g16" onSubmit={destroy}>
              <div>
                <label className="lbl" htmlFor="confirma-email">Digite o seu e-mail para confirmar</label>
                <input id="confirma-email" className="inp" type="email" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} autoComplete="off" required />
              </div>
              {hasPassword ? <PasswordField id="senha-excluir" label="Senha" autoComplete="current-password" /> : null}
              {error ? <FieldError message={error} /> : null}
              <div className="row g8" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-s" onClick={() => setOpen(false)}>Cancelar</button>
                <button className="btn btn-danger" disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase()}>Excluir definitivamente</button>
              </div>
            </form>
          </Overlay>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function signOut() {
    start(async () => {
      await authClient.signOut();
      router.replace("/entrar");
      router.refresh();
    });
  }

  return (
    <button type="button" className="btn btn-danger btn-lg btn-w" onClick={signOut} disabled={pending}>
      <Icon name="logout" size="s" />Sair
    </button>
  );
}
