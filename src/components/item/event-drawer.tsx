"use client";

import { useEffect, useState, useTransition } from "react";
import { loadEvent, removeEvent, saveNewEvent } from "@/actions/events";
import { Icon } from "@/components/ui/icon";
import { Overlay } from "@/components/ui/overlay";
import { REMINDER_OPTIONS } from "@/components/ui/pickers";
import { useToast } from "@/components/ui/toast";
import { replaceOverlay } from "@/components/ui/url-state";
import type { EventOccurrence } from "@/data/events";
import { formatDuration, formatLongDay } from "@/lib/dates";
import { colorMeta } from "@/lib/palette";
import { describeRule } from "@/lib/recurrence";

export function EventDrawer({ id, occurrence, onClose }: { id: string; occurrence: string; onClose: () => void }) {
  const toast = useToast();
  const [event, setEvent] = useState<EventOccurrence | null>(null);
  const [askScope, setAskScope] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    loadEvent({ id, occurrence }).then((result) => {
      if (!alive) return;
      if (result.ok) setEvent(result.data);
      else {
        toast(result.error, { tone: "error" });
        onClose();
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega ao abrir
  }, [id, occurrence]);

  function edit() {
    replaceOverlay({ novo: "compromisso", editar: id, data: occurrence }, ["evento"]);
  }

  function destroy(scope: "this" | "all") {
    if (!event) return;
    start(async () => {
      const result = await removeEvent({ id, occurrence, scope });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      const snapshot = event;
      // Excluir só um dia de uma série não tem desfazer simples; o toast apenas confirma.
      if (scope === "this" && snapshot.recurrence) {
        toast("Removido deste dia");
      } else {
        toast("Compromisso excluído", {
          action: {
            label: "Desfazer",
            run: () => void saveNewEvent({
              title: snapshot.title, date: snapshot.seriesDate, startTime: snapshot.startTime, endTime: snapshot.endTime,
              color: snapshot.color, location: snapshot.location, notes: snapshot.notes,
              recurrence: snapshot.recurrence, reminderMinutes: snapshot.reminderMinutes,
            }),
          },
        });
      }
      onClose();
    });
  }

  const meta = event ? colorMeta(event.color) : null;
  const reminderLabel = event ? REMINDER_OPTIONS.find((o) => o.value === (event.reminderMinutes === null ? "" : String(event.reminderMinutes)))?.label ?? `${event.reminderMinutes} min antes` : "";

  return (
    <Overlay label="Detalhe do compromisso" variant="drawer" onClose={onClose}>
      <div className="row jb">
        <span className="eyebrow">Compromisso</span>
        <div className="row g4">
          <button type="button" className="btn btn-g btn-ic" aria-label="Editar" onClick={edit} disabled={!event}><Icon name="edit" /></button>
          <button type="button" className="btn btn-g btn-ic" aria-label="Fechar painel" onClick={onClose}><Icon name="close" /></button>
        </div>
      </div>

      {!event || !meta ? (
        <div className="col g12" style={{ marginTop: 14 }} aria-busy="true">
          <div className="skl" style={{ height: 160, borderRadius: 22 }} />
          <div className="skl" style={{ height: 180 }} />
        </div>
      ) : (
        <>
          <section className={`c-${event.color} tape-host`} style={{ marginTop: 14, padding: "22px 20px 20px", borderRadius: 22, background: "var(--cbg)", border: "1.5px solid var(--ce)", boxShadow: "var(--sh)" }}>
            <span className="tape" />
            <span className="tag" style={{ background: "var(--surf)" }}>{meta.category}</span>
            <h1 className="ser" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.15, margin: "10px 0 14px" }}>{event.title}</h1>
            {event.startTime ? (
              <div className="row g8 b">
                <Icon name="clock" />
                <span className="num">{event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}</span>
                {event.endTime ? <span className="t2" style={{ fontWeight: 700 }}>· {formatDuration(event.startTime, event.endTime)}</span> : null}
              </div>
            ) : null}
            <div className="row g8 b" style={{ marginTop: 8 }}><Icon name="calendar" />{formatLongDay(event.date)}</div>
          </section>

          <section className="card" style={{ marginTop: 16, padding: "4px 16px" }}>
            <div className="list-row"><span className={`dot c-${event.color}`} style={{ width: 16, height: 16 }} /><span className="f1 t2 b">Cor</span><span className="b">{meta.label}</span></div>
            <div className="list-row"><Icon name="repeat" size="s" className="t2" /><span className="f1 t2 b">Repetição</span><span className="b">{describeRule(event.seriesDate, event.recurrence)}</span></div>
            <div className="list-row"><Icon name="bell" size="s" className="t2" /><span className="f1 t2 b">Lembrete</span><span className="b">{reminderLabel}</span></div>
            {event.location ? <div className="list-row"><Icon name="place" size="s" className="t2" /><span className="f1 t2 b">Onde</span><span className="b ell" style={{ maxWidth: "60%" }}>{event.location}</span></div> : null}
          </section>

          {event.notes ? (
            <section style={{ marginTop: 22 }}>
              <span className="eyebrow">Notas</span>
              <div className="pit y" style={{ marginTop: 14, transform: "rotate(-1deg)", whiteSpace: "pre-wrap" }}><span className="tape sky" />{event.notes}</div>
            </section>
          ) : null}

          <div className="col g8" style={{ marginTop: "auto", paddingTop: 20 }}>
            {askScope ? (
              <div className="col g8" role="group" aria-label="O que excluir">
                <p className="sm b">Este compromisso se repete. O que excluir?</p>
                <div className="row g8">
                  <button type="button" className="btn btn-s f1" onClick={() => destroy("this")} disabled={pending}>Só este dia</button>
                  <button type="button" className="btn btn-danger f1" onClick={() => destroy("all")} disabled={pending}>Toda a série</button>
                </div>
              </div>
            ) : (
              <div className="row g12">
                <button type="button" className="btn btn-p btn-lg f1" onClick={edit}><Icon name="edit" size="s" />Editar</button>
                <button type="button" className="btn btn-danger btn-lg f1" disabled={pending} onClick={() => (event.recurrence ? setAskScope(true) : destroy("all"))}><Icon name="trash" size="s" />Excluir</button>
              </div>
            )}
          </div>
        </>
      )}
    </Overlay>
  );
}
