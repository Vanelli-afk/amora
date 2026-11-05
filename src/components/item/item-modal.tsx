"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { loadEvent, saveEvent, saveNewEvent } from "@/actions/events";
import { addReminder } from "@/actions/reminders";
import { addNote } from "@/actions/notes";
import { addTask, loadTask, removeTask, saveTask } from "@/actions/tasks";
import { FieldError } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { Overlay } from "@/components/ui/overlay";
import { ColorPicker, NoteColorPicker, REMINDER_OPTIONS, type NoteColorId } from "@/components/ui/pickers";
import { useToast } from "@/components/ui/toast";
import type { ColorId } from "@/lib/palette";
import type { ItemKind } from "./item-host";

const TABS: { id: ItemKind; label: string; save: string }[] = [
  { id: "compromisso", label: "Compromisso", save: "Salvar compromisso" },
  { id: "tarefa", label: "Tarefa", save: "Salvar tarefa" },
  { id: "nota", label: "Nota", save: "Salvar nota" },
  { id: "lembrete", label: "Lembrete", save: "Salvar lembrete" },
];

const REPEATS = [
  { value: "", label: "Não repete" },
  { value: "daily", label: "Todos os dias" },
  { value: "weekly", label: "Toda semana" },
  { value: "monthly", label: "Todo mês" },
  { value: "yearly", label: "Todo ano" },
] as const;

type Freq = "daily" | "weekly" | "monthly" | "yearly";

export function ItemModal({ kind, date, editId, onClose }: { kind: ItemKind; date: string; editId: string | null; onClose: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<ItemKind>(kind);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(Boolean(editId));
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [day, setDay] = useState(date);
  const [hasDay, setHasDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [color, setColor] = useState<ColorId>("sky");
  const [repeat, setRepeat] = useState("");
  const [reminder, setReminder] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [highlight, setHighlight] = useState(false);
  const [noteColor, setNoteColor] = useState<NoteColorId>("y");
  const [scope, setScope] = useState<"this" | "all">("all");
  const [isSeries, setIsSeries] = useState(false);

  useEffect(() => {
    if (!editId) {
      setTimeout(() => titleRef.current?.focus(), 60);
      return;
    }
    let alive = true;
    (async () => {
      if (kind === "tarefa") {
        const result = await loadTask({ id: editId });
        if (!alive) return;
        if (!result.ok) { toast(result.error, { tone: "error" }); onClose(); return; }
        const task = result.data;
        setTitle(task.title);
        setHasDay(Boolean(task.date));
        setDay(task.date ?? date);
        setStartTime(task.dueTime ?? "");
        setHighlight(task.highlight);
        setReminder(task.reminderMinutes === null ? "" : String(task.reminderMinutes));
      } else {
        const result = await loadEvent({ id: editId, occurrence: date });
        if (!alive) return;
        if (!result.ok) { toast(result.error, { tone: "error" }); onClose(); return; }
        const event = result.data;
        setTitle(event.title);
        setDay(event.date);
        setStartTime(event.startTime ?? "");
        setEndTime(event.endTime ?? "");
        setColor(event.color);
        setRepeat(event.recurrence?.freq ?? "");
        setIsSeries(Boolean(event.recurrence));
        setReminder(event.reminderMinutes === null ? "" : String(event.reminderMinutes));
        setLocation(event.location ?? "");
        setNotes(event.notes ?? "");
      }
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao abrir
  }, []);

  const reminderValue = reminder === "" ? null : Number(reminder);
  const current = (TABS.find((t) => t.id === tab) ?? TABS[0]) as (typeof TABS)[number];

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    start(async () => {
      let outcome: { ok: boolean; error?: string };
      if (tab === "compromisso") {
        const input = {
          title,
          date: day,
          startTime: startTime || null,
          endTime: endTime || null,
          color,
          location: location || null,
          notes: notes || null,
          recurrence: repeat ? { freq: repeat as Freq } : null,
          reminderMinutes: startTime ? reminderValue : null,
        };
        outcome = editId
          ? await saveEvent({ id: editId, occurrence: date, scope: isSeries ? scope : "all", input })
          : await saveNewEvent(input);
      } else if (tab === "tarefa") {
        const input = {
          title,
          date: hasDay ? day : null,
          dueTime: hasDay && startTime ? startTime : null,
          highlight,
          reminderMinutes: hasDay && startTime ? reminderValue : null,
        };
        outcome = editId ? await saveTask({ id: editId, input }) : await addTask(input);
      } else if (tab === "nota") {
        outcome = await addNote({ kind: "postit", color: noteColor, date: hasDay ? day : null, title: null, body: title, tags: [] });
      } else {
        if (!startTime) { setError("Escolha o horário do lembrete."); return; }
        outcome = await addReminder({ title, date: day, time: startTime });
      }
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      toast(editId ? "Alterações salvas" : `${current.label} criado${tab === "tarefa" || tab === "nota" ? "a" : ""}`);
      onClose();
    });
  }

  function deleteTask() {
    if (!editId) return;
    start(async () => {
      const result = await removeTask({ id: editId });
      if (!result.ok) { setError(result.error); return; }
      const snapshot = { title, date: hasDay ? day : null, dueTime: hasDay && startTime ? startTime : null, highlight, reminderMinutes: reminderValue };
      toast("Tarefa excluída", { action: { label: "Desfazer", run: () => void addTask(snapshot) } });
      onClose();
    });
  }

  // Enter salva em qualquer campo; numa área de texto, Ctrl/Cmd+Enter, porque Enter pula linha.
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  }

  const heading = editId ? (tab === "tarefa" ? "Editar tarefa" : "Editar compromisso") : "Novo item";

  return (
    <Overlay label={heading} variant="modal" onClose={onClose}>
      <div className="row jb" style={{ marginBottom: 14 }}>
        <h2 className="ser" style={{ fontSize: 28, fontWeight: 600 }}>{heading}</h2>
        <button type="button" className="btn btn-g btn-ic" aria-label="Fechar" onClick={onClose}><Icon name="close" /></button>
      </div>

      {!editId ? (
        <div className="tabs" role="tablist" aria-label="Tipo de item">
          {TABS.map((item) => (
            <button key={item.id} type="button" className={`tab${tab === item.id ? " on" : ""}`} role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setError(undefined); }}>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="col g12" style={{ marginTop: 18 }} aria-busy="true">
          <div className="skl" style={{ height: 48 }} />
          <div className="skl" style={{ height: 48 }} />
          <div className="skl" style={{ height: 96 }} />
        </div>
      ) : (
        <form className="col g16" style={{ marginTop: 18 }} onSubmit={submit} onKeyDown={onKeyDown}>
          {tab === "nota" ? (
            <div>
              <label className="lbl" htmlFor="it-texto">Post-it</label>
              <textarea id="it-texto" className="inp ruled inp-hand" placeholder="O que você quer lembrar?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={2000} required autoFocus />
            </div>
          ) : (
            <div>
              <label className="lbl" htmlFor="it-titulo">Título</label>
              <input ref={titleRef} id="it-titulo" className="inp" type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required enterKeyHint="done" />
            </div>
          )}

          {tab === "compromisso" ? (
            <>
              <div className="field-row">
                <div style={{ flex: 1.6 }}><label className="lbl" htmlFor="it-data">Data</label><input id="it-data" className="inp" type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></div>
                <div><label className="lbl" htmlFor="it-ini">Início</label><input id="it-ini" className="inp num" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                <div><label className="lbl" htmlFor="it-fim">Fim</label><input id="it-fim" className="inp num" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!startTime} /></div>
              </div>
              <ColorPicker value={color} onChange={setColor} />
              <div className="field-row">
                <div>
                  <label className="lbl" htmlFor="it-rep">Repetição</label>
                  <select id="it-rep" className="inp" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
                    {REPEATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl" htmlFor="it-lem">Lembrete</label>
                  <select id="it-lem" className="inp" value={reminder} onChange={(e) => setReminder(e.target.value)} disabled={!startTime}>
                    {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="lbl" htmlFor="it-local">Onde</label><input id="it-local" className="inp" type="text" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={300} placeholder="Endereço ou videochamada" /></div>
              <div><label className="lbl" htmlFor="it-notas">Notas</label><textarea id="it-notas" className="inp" style={{ minHeight: 76 }} placeholder="O que levar, perguntas…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} /></div>
              {editId && isSeries ? (
                <div className="row g8 wrap" role="radiogroup" aria-label="Aplicar alterações a">
                  <button type="button" className={`chip${scope === "this" ? " on" : ""}`} role="radio" aria-checked={scope === "this"} onClick={() => setScope("this")}>Só este dia</button>
                  <button type="button" className={`chip${scope === "all" ? " on" : ""}`} role="radio" aria-checked={scope === "all"} onClick={() => setScope("all")}>Toda a série</button>
                </div>
              ) : null}
            </>
          ) : null}

          {tab === "tarefa" ? (
            <>
              <label className="row g12 consent"><input className="ck" type="checkbox" checked={hasDay} onChange={(e) => setHasDay(e.target.checked)} /><span>Tem data</span></label>
              {hasDay ? (
                <div className="field-row">
                  <div style={{ flex: 1.6 }}><label className="lbl" htmlFor="it-data">Data</label><input id="it-data" className="inp" type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></div>
                  <div><label className="lbl" htmlFor="it-ini">Horário</label><input id="it-ini" className="inp num" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                </div>
              ) : null}
              {hasDay && startTime ? (
                <div>
                  <label className="lbl" htmlFor="it-lem">Lembrete</label>
                  <select id="it-lem" className="inp" value={reminder} onChange={(e) => setReminder(e.target.value)}>
                    {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ) : null}
              <label className="row g12 consent"><input className="ck" type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /><span>Marcar com <span className="hl">marca-texto</span></span></label>
            </>
          ) : null}

          {tab === "nota" ? (
            <>
              <div><span className="lbl">Cor</span><NoteColorPicker value={noteColor} onChange={setNoteColor} /></div>
              <label className="row g12 consent"><input className="ck" type="checkbox" checked={hasDay} onChange={(e) => setHasDay(e.target.checked)} /><span>Mostrar também neste dia</span></label>
            </>
          ) : null}

          {tab === "lembrete" ? (
            <div className="field-row">
              <div style={{ flex: 1.6 }}><label className="lbl" htmlFor="it-data">Data</label><input id="it-data" className="inp" type="date" value={day} onChange={(e) => setDay(e.target.value)} required /></div>
              <div><label className="lbl" htmlFor="it-ini">Horário</label><input id="it-ini" className="inp num" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div>
            </div>
          ) : null}

          {error ? <FieldError message={error} /> : null}

          <div className="row jb wrap g8" style={{ marginTop: 2 }}>
            {editId && tab === "tarefa" ? (
              <button type="button" className="btn btn-g" onClick={deleteTask} disabled={pending}><Icon name="trash" size="s" />Excluir</button>
            ) : (
              <span className="xs t3 b row g6 only-desktop"><span className="kbd">Esc</span> fecha · <span className="kbd">Enter</span> salva</span>
            )}
            <div className="row g8" style={{ marginLeft: "auto" }}>
              <button type="button" className="btn btn-s" onClick={onClose}>Cancelar</button>
              <button className="btn btn-p" disabled={pending}>{pending ? "Salvando…" : editId ? "Salvar" : current.save}</button>
            </div>
          </div>
        </form>
      )}
    </Overlay>
  );
}
