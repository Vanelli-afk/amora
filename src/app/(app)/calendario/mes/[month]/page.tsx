import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarTop } from "@/components/calendario/calendar-top";
import { MiniMonth } from "@/components/calendario/mini-month";
import { Sticker } from "@/components/calendario/stickers";
import { Icon } from "@/components/ui/icon";
import { OverlayLink } from "@/components/ui/links";
import { listStickers } from "@/data/day";
import { listOccurrenceDays, listOccurrences, type EventOccurrence } from "@/data/events";
import { getSettings } from "@/data/settings";
import { countByDay } from "@/data/tasks";
import {
  addMonths, dayOfWeek, formatDayMonth, isValidDay, isValidMonth, MONTHS, monthGrid, monthOf, parseDay, todayIn, WEEKDAYS, WEEKDAYS_INITIAL, WEEKDAYS_SHORT,
} from "@/lib/dates";
import { holidayOn } from "@/lib/holidays";
import { COLORS } from "@/lib/palette";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Calendário" };

const MAX_LABELS = 3;
const MAX_SUMMARY = 4;

const label = (e: EventOccurrence) => (e.startTime ? `${e.startTime} ${e.title}` : e.title);

export default async function MesPage({ params, searchParams }: {
  params: Promise<{ month: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { month } = await params;
  const { dia } = await searchParams;
  if (!isValidMonth(month)) notFound();

  const user = await requireUser();
  const { timezone } = await getSettings(user.id);
  const today = todayIn(timezone);
  const cells = monthGrid(month);
  const from = cells[0]?.day as string;
  const to = cells.at(-1)?.day as string;

  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  const [events, stickers, taskCounts, marked] = await Promise.all([
    listOccurrences(user.id, from, to),
    listStickers(user.id, from, to),
    countByDay(user.id, from, to),
    listOccurrenceDays(user.id, `${prevMonth}-01`, `${addMonths(month, 2)}-01`),
  ]);

  const byDay = new Map<string, EventOccurrence[]>();
  for (const event of events) {
    if (!byDay.has(event.date)) byDay.set(event.date, []);
    byDay.get(event.date)?.push(event);
  }

  const selected = dia && isValidDay(dia) ? dia : monthOf(today) === month ? today : `${month}-01`;
  const selectedEvents = byDay.get(selected) ?? [];
  const selectedTasks = taskCounts.get(selected) ?? { total: 0, done: 0 };
  const pendingTasks = selectedTasks.total - selectedTasks.done;
  const progress = selectedTasks.total ? Math.round((selectedTasks.done / selectedTasks.total) * 100) : 0;
  const { y, m } = parseDay(`${month}-01`);

  return (
    <>
      <CalendarTop
        title={<>{(MONTHS[m - 1] ?? "").replace(/^./, (c) => c.toUpperCase())} <span className="cr">{y}</span></>}
        prevHref={`/calendario/mes/${prevMonth}`}
        nextHref={`/calendario/mes/${nextMonth}`}
        prevLabel="Mês anterior"
        nextLabel="Próximo mês"
        view="mes"
        monthHref={`/calendario/mes/${month}`}
        weekHref={`/calendario/semana/${selected}`}
        date={selected}
      />

      <div className="row wrap g20 cal-layout">
        <section className="cal-main" aria-label={`Calendário de ${MONTHS[m - 1]} de ${y}`}>
          <div className="mg">
            {WEEKDAYS_SHORT.map((name) => <div key={name} className="mh">{name}</div>)}
            {cells.map(({ day, inMonth }) => {
              const list = byDay.get(day) ?? [];
              const holiday = holidayOn(day);
              const sticker = stickers.get(day);
              const visible = list.slice(0, holiday ? MAX_LABELS - 1 : MAX_LABELS);
              const extra = list.length - visible.length;
              const { d } = parseDay(day);
              const description = [`${d} de ${MONTHS[parseDay(day).m - 1]}`, holiday, list.length ? `${list.length} compromisso(s)` : null].filter(Boolean).join(", ");
              return (
                <Link
                  key={day}
                  href={`/calendario/mes/${month}?dia=${day}`}
                  scroll={false}
                  className={`mc${inMonth ? "" : " out"}${day === selected ? " sel" : ""}`}
                  aria-current={day === today ? "date" : undefined}
                >
                  <span className="sr">{description}</span>
                  <span className={`dn${day === today ? " t" : ""}`} aria-hidden="true">{d}</span>
                  {sticker ? <Sticker kind={sticker} /> : null}
                  {holiday ? <span className="lb fer">{holiday}</span> : null}
                  {visible.map((event) => <span key={`${event.id}-${event.date}`} className={`lb c-${event.color}`}>{label(event)}</span>)}
                  {extra > 0 ? <span className="lb c-sand">+{extra} mais</span> : null}
                  {list.length ? (
                    <span className="dot-row" aria-hidden="true">
                      {list.slice(0, 4).map((event) => <i key={`${event.id}-dot-${event.date}`} className={`dot c-${event.color}`} />)}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
          <div className="row g16 wrap" style={{ padding: "14px 4px 0" }} aria-label="Legenda de cores">
            {COLORS.map((color) => <span key={color.id} className={`row g6 xs b c-${color.id}`}><i className="dot" />{color.category}</span>)}
          </div>
        </section>

        <aside className="col g16 cal-side" aria-label="Meses vizinhos e resumo do dia">
          <div className="row g12 cal-neighbours">
            {[prevMonth, nextMonth].map((other) => (
              <Link key={other} href={`/calendario/mes/${other}`} className="card mini-sm" style={{ flex: 1, minWidth: 0, padding: "12px 10px 8px" }}>
                <div className="row jb" style={{ padding: "0 4px 4px" }}><span className="eyebrow">{MONTHS[parseDay(`${other}-01`).m - 1]}</span></div>
                <MiniMonth month={other} today={today} marked={marked} initials={WEEKDAYS_INITIAL} />
              </Link>
            ))}
          </div>

          <section key={selected} className="card lg enter" aria-label={`Resumo de ${formatDayMonth(selected)}`} style={{ boxShadow: "var(--sh2)" }}>
            <div className="row jb as">
              <div className="col">
                <span className="eyebrow">{WEEKDAYS[dayOfWeek(selected)]}</span>
                <h2 className="ser" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15 }}>{formatDayMonth(selected)}</h2>
              </div>
              {selected === today ? <span className="tag" style={{ background: "var(--coral)", color: "var(--on-coral)" }}>hoje</span> : null}
            </div>
            <p className="sm t2 b" style={{ margin: "6px 0 12px" }}>
              {selectedEvents.length} compromisso{selectedEvents.length === 1 ? "" : "s"} · {pendingTasks} tarefa{pendingTasks === 1 ? "" : "s"} pendente{pendingTasks === 1 ? "" : "s"}
            </p>
            {selectedEvents.length ? (
              <div className="col g8">
                {selectedEvents.slice(0, MAX_SUMMARY).map((event) => (
                  <div key={`${event.id}-${event.date}`} className="row g8">
                    <span className="num b xs t2 ev-time">{event.startTime ?? ""}</span>
                    <OverlayLink className={`ev-card c-${event.color}`} params={{ evento: event.id, data: event.date }}>
                      <b>{event.title}</b>
                      {event.endTime ? <span className="xs t2">até {event.endTime}</span> : null}
                    </OverlayLink>
                  </div>
                ))}
              </div>
            ) : <p className="sm t2">Nenhum compromisso neste dia.</p>}
            {selectedEvents.length > MAX_SUMMARY ? (
              <Link className="btn btn-g" href={`/dia/${selected}`} style={{ margin: "2px 0 0 -8px" }}>+ {selectedEvents.length - MAX_SUMMARY} compromisso{selectedEvents.length - MAX_SUMMARY === 1 ? "" : "s"}</Link>
            ) : null}
            <div className="row g12" style={{ margin: "12px 0 14px", padding: "10px 12px", borderRadius: 14, background: "var(--surf2)" }}>
              <Icon name="tasks" className="cr" />
              <div className="f1">
                <div className="row jb sm b"><span>Tarefas do dia</span><span className="t2">{selectedTasks.done} de {selectedTasks.total}</span></div>
                <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${progress}%` }} /></div>
              </div>
            </div>
            <div className="row g8">
              <OverlayLink className="btn btn-p f1" params={{ novo: "compromisso", data: selected }}><Icon name="plus" size="s" />Adicionar</OverlayLink>
              <Link className="btn btn-s f1" href={`/dia/${selected}`}>Abrir o dia</Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
