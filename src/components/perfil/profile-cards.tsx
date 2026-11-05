"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { saveSettings, subscribePush, unsubscribePush, uploadAvatar } from "@/actions/account";
import { FieldError } from "@/components/auth/fields";
import { Avatar } from "@/components/shell/navigation";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { authClient, authErrorMessage } from "@/lib/auth-client";

type Theme = "light" | "dark" | "auto";

export function AccountCard({ name, email, image, since }: { name: string; email: string; image: string | null; since: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextName = String(form.get("nome")).trim();
    const nextEmail = String(form.get("email")).trim();
    setError(undefined);
    start(async () => {
      if (nextName !== name) {
        const { error: failure } = await authClient.updateUser({ name: nextName });
        if (failure) { setError(authErrorMessage(failure)); return; }
      }
      if (nextEmail !== email) {
        const { error: failure } = await authClient.changeEmail({ newEmail: nextEmail, callbackURL: "/perfil" });
        if (failure) { setError(authErrorMessage(failure)); return; }
        toast("Enviamos um link de confirmação para o novo e-mail");
      } else {
        toast("Alterações salvas");
      }
      router.refresh();
    });
  }

  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("foto", file);
    start(async () => {
      const result = await uploadAvatar(form);
      toast(result.ok ? "Foto atualizada" : result.error, { tone: result.ok ? "ok" : "error" });
    });
  }

  return (
    <section className="card lg">
      <div className="row g20" style={{ marginBottom: 18 }}>
        <div className="rel">
          <Avatar user={{ name, image }} large />
          <button type="button" className="btn btn-s btn-ic" aria-label="Trocar foto" style={{ position: "absolute", right: -8, bottom: -8, minHeight: 36, width: 36, borderRadius: "50%" }} onClick={() => fileInput.current?.click()}><Icon name="camera" size="s" /></button>
          <input ref={fileInput} className="sr" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} aria-label="Escolher foto" tabIndex={-1} />
        </div>
        <div className="f1" style={{ minWidth: 0 }}>
          <div className="ser ell" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}>{name}</div>
          <div className="t2 ell">{email}</div>
          <div className="hand t3" style={{ fontSize: 22, marginTop: 2 }}>no Amora desde {since}</div>
        </div>
      </div>
      <form onSubmit={save}>
        <div className="row g16 wrap as">
          <div className="f1" style={{ minWidth: 200 }}><label className="lbl" htmlFor="pn">Nome</label><input id="pn" name="nome" className="inp" type="text" defaultValue={name} maxLength={80} required autoComplete="name" /></div>
          <div className="f1" style={{ minWidth: 200 }}><label className="lbl" htmlFor="pe">E-mail</label><input id="pe" name="email" className="inp" type="email" defaultValue={email} maxLength={254} required autoComplete="email" /></div>
        </div>
        {error ? <FieldError message={error} /> : null}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}><button className="btn btn-p" disabled={pending}>Salvar alterações</button></div>
      </form>
    </section>
  );
}

const THEMES: { id: Theme; label: string; icon?: "sun" | "moon" }[] = [
  { id: "light", label: "Claro", icon: "sun" },
  { id: "dark", label: "Abajur", icon: "moon" },
  { id: "auto", label: "Auto" },
];

export function ThemeCard({ theme }: { theme: Theme }) {
  const toast = useToast();
  const [current, setCurrent] = useState<Theme>(theme);

  function choose(next: Theme) {
    const before = current;
    setCurrent(next);
    document.documentElement.dataset.theme = next;
    void saveSettings({ theme: next }).then((result) => {
      if (!result.ok) {
        setCurrent(before);
        document.documentElement.dataset.theme = before;
        toast(result.error, { tone: "error" });
      }
    });
  }

  return (
    <section className="card lg">
      <h2 className="h3" style={{ marginBottom: 10 }}>Tema</h2>
      <div className="tabs" role="radiogroup" aria-label="Tema">
        {THEMES.map((item) => (
          <button key={item.id} type="button" className={`tab${current === item.id ? " on" : ""}`} role="radio" aria-checked={current === item.id} onClick={() => choose(item.id)}>
            {item.icon ? <Icon name={item.icon} size="s" /> : null}{item.label}
          </button>
        ))}
      </div>
      <p className="hint">“Abajur” é o modo escuro, em marrom quente.</p>
      <div className="row g12" style={{ marginTop: 14 }} aria-hidden="true">
        <div className="f1 theme-sample" style={{ background: "#F7F0E1", border: "1.5px solid #E2D5BA" }}>
          <div style={{ height: 8, width: "55%", background: "#BE4B33", marginBottom: 8 }} /><div style={{ height: 6, background: "#EADCC0", marginBottom: 5 }} /><div style={{ height: 6, width: "70%", background: "#CFE3F1" }} />
        </div>
        <div className="f1 theme-sample" style={{ background: "#2B221D", border: "1.5px solid #41342B" }}>
          <div style={{ height: 8, width: "55%", background: "#E8745A", marginBottom: 8 }} /><div style={{ height: 6, background: "#5A4B33", marginBottom: 5 }} /><div style={{ height: 6, width: "70%", background: "#38526A" }} />
        </div>
      </div>
    </section>
  );
}

function urlBase64ToUint8Array(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

type PushState = "unsupported" | "blocked" | "off" | "on" | "ios-install";

function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" className={`tg${checked ? " on" : ""}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}><i /></button>
  );
}

export function NotificationsCard({ notifyEvents, notifyMorning, morningTime, notifyEvening, eveningTime, vapidKey }: {
  notifyEvents: boolean; notifyMorning: boolean; morningTime: string; notifyEvening: boolean; eveningTime: string; vapidKey: string | null;
}) {
  const toast = useToast();
  const [events, setEvents] = useState(notifyEvents);
  const [morning, setMorning] = useState(notifyMorning);
  const [evening, setEvening] = useState(notifyEvening);
  const [morningAt, setMorningAt] = useState(morningTime);
  const [eveningAt, setEveningAt] = useState(eveningTime);
  const [push, setPush] = useState<PushState>("off");

  useEffect(() => {
    (async () => {
      const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (iOS && !standalone) { setPush("ios-install"); return; }
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidKey) { setPush("unsupported"); return; }
      if (Notification.permission === "denied") { setPush("blocked"); return; }
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      setPush(subscription ? "on" : "off");
    })();
  }, [vapidKey]);

  async function persist(patch: Parameters<typeof saveSettings>[0]) {
    const result = await saveSettings(patch);
    if (!result.ok) toast(result.error, { tone: "error" });
  }

  async function togglePush(enable: boolean) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      if (enable) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setPush(permission === "denied" ? "blocked" : "off"); return; }
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey as string) });
        const json = subscription.toJSON();
        const result = await subscribePush({ endpoint: subscription.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" });
        if (!result.ok) throw new Error(result.error);
        setPush("on");
        toast("Notificações ativadas neste aparelho");
      } else {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await unsubscribePush({ endpoint: subscription.endpoint });
          await subscription.unsubscribe();
        }
        setPush("off");
      }
    } catch {
      toast("Não foi possível alterar as notificações.", { tone: "error" });
    }
  }

  const pushHint: Record<PushState, string> = {
    on: "Este aparelho recebe os lembretes.",
    off: "Ative para receber os lembretes neste aparelho.",
    blocked: "As notificações estão bloqueadas nas configurações do navegador.",
    unsupported: "Este navegador não permite notificações.",
    "ios-install": "No iPhone, primeiro adicione o Amora à Tela de Início: compartilhar › “Adicionar à Tela de Início”.",
  };

  return (
    <section className="card lg">
      <h2 className="h3" style={{ marginBottom: 4 }}>Notificações de lembrete</h2>
      <div className="list-row">
        <div className="f1"><b>Neste aparelho</b><div className="xs t2">{pushHint[push]}</div></div>
        <Switch label="Notificações neste aparelho" checked={push === "on"} disabled={push === "unsupported" || push === "blocked" || push === "ios-install"} onChange={(v) => void togglePush(v)} />
      </div>
      <div className="list-row">
        <div className="f1"><b>Avisar antes dos compromissos</b><div className="xs t2">Inclui tarefas com horário</div></div>
        <Switch label="Avisar antes dos compromissos" checked={events} onChange={(v) => { setEvents(v); void persist({ notifyEvents: v }); }} />
      </div>
      <div className="list-row">
        <div className="f1">
          <b>Resumo da manhã</b>
          <div className="row g8 xs t2">Agenda do dia às
            <label className="sr" htmlFor="hora-manha">Horário do resumo</label>
            <input id="hora-manha" className="inp pill-edit num" type="time" value={morningAt} onChange={(e) => setMorningAt(e.target.value)} onBlur={() => { if (morningAt) void persist({ morningTime: morningAt }); }} />
          </div>
        </div>
        <Switch label="Resumo da manhã" checked={morning} onChange={(v) => { setMorning(v); void persist({ notifyMorning: v }); }} />
      </div>
      <div className="list-row">
        <div className="f1">
          <b>Reflexão da noite</b>
          <div className="row g8 xs t2">Lembrete às
            <label className="sr" htmlFor="hora-noite">Horário da reflexão</label>
            <input id="hora-noite" className="inp pill-edit num" type="time" value={eveningAt} onChange={(e) => setEveningAt(e.target.value)} onBlur={() => { if (eveningAt) void persist({ eveningTime: eveningAt }); }} />
          </div>
        </div>
        <Switch label="Reflexão da noite" checked={evening} onChange={(v) => { setEvening(v); void persist({ notifyEvening: v }); }} />
      </div>
    </section>
  );
}

const TIMEZONES = [
  ["America/Sao_Paulo", "Brasília (UTC−03:00)"],
  ["America/Manaus", "Manaus (UTC−04:00)"],
  ["America/Rio_Branco", "Rio Branco (UTC−05:00)"],
  ["America/Noronha", "Fernando de Noronha (UTC−02:00)"],
  ["America/Fortaleza", "Fortaleza (UTC−03:00)"],
  ["America/Belem", "Belém (UTC−03:00)"],
  ["America/Cuiaba", "Cuiabá (UTC−04:00)"],
  ["America/Argentina/Buenos_Aires", "Buenos Aires"],
  ["America/New_York", "Nova York"],
  ["America/Los_Angeles", "Los Angeles"],
  ["Europe/Lisbon", "Lisboa"],
  ["Europe/London", "Londres"],
  ["Europe/Paris", "Paris"],
  ["Asia/Tokyo", "Tóquio"],
  ["UTC", "UTC"],
] as const;

export function PreferencesCard({ timezone, stepGoal, pagesGoal, booksGoal }: { timezone: string; stepGoal: number; pagesGoal: number; booksGoal: number }) {
  const toast = useToast();
  const options: readonly (readonly [string, string])[] = TIMEZONES.some(([id]) => id === timezone) ? TIMEZONES : [[timezone, timezone], ...TIMEZONES];

  async function persist(patch: Parameters<typeof saveSettings>[0]) {
    const result = await saveSettings(patch);
    if (!result.ok) toast(result.error, { tone: "error" });
  }

  const goal = (raw: string, fallback: number) => {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
  };

  return (
    <section className="card lg col g16">
      <div>
        <label className="lbl" htmlFor="fuso">Fuso horário</label>
        <select id="fuso" className="inp" defaultValue={timezone} onChange={(e) => void persist({ timezone: e.target.value })}>
          {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      <div className="field-row">
        <div><label className="lbl" htmlFor="meta-passos">Meta de passos</label><input id="meta-passos" className="inp num" type="number" min={100} max={200000} defaultValue={stepGoal} onBlur={(e) => void persist({ stepGoal: goal(e.target.value, stepGoal) })} /></div>
        <div><label className="lbl" htmlFor="meta-paginas">Páginas por dia</label><input id="meta-paginas" className="inp num" type="number" min={1} max={2000} defaultValue={pagesGoal} onBlur={(e) => void persist({ pagesGoal: goal(e.target.value, pagesGoal) })} /></div>
        <div><label className="lbl" htmlFor="meta-livros">Livros por ano</label><input id="meta-livros" className="inp num" type="number" min={1} max={1000} defaultValue={booksGoal} onBlur={(e) => void persist({ booksGoal: goal(e.target.value, booksGoal) })} /></div>
      </div>
    </section>
  );
}
