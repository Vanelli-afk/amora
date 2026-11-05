import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarTop } from "@/components/calendario/calendar-top";
import { ScrollToToday } from "@/components/calendario/scroll-to-today";
import { OverlayLink } from "@/components/ui/links";
import { listOccurrences, type EventOccurrence } from "@/data/events";
import { getSettings } from "@/data/settings";
import {
  addDays, dayOfWeek, isoWeek, isValidDay, MONTHS, minutesOf, monthOf, parseDay, startOfWeek, timeIn, todayIn, WEEKDAYS_SHORT,
} from "@/lib/dates";
import { holidayOn } from "@/lib/holidays";
import { requireUser } from "@/lib/session";
import { assignColumns } from "@/lib/timeline";

export const metadata: Metadata = { title: "Semana" };

const HOUR_PX = 48;
const MIN_ITEM_PX = 26;

function rangeTitle(start: string, end: string) {
  const a = parseDay(start);
  const b = parseDay(end);
  const left = a.m === b.m ? `${a.d}` : `${a.d} de ${MONTHS[a.m - 1]}`;
  return { text: `${left} – ${b.d} de ${MONTHS[b.m - 1]}`, year: b.y };
}

export default async function SemanaPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDay(date)) notFound();

  const user = await requireUser();
  const { timezone } = await getSettings(user.id);
  const today = todayIn(timezone);
  const now = timeIn(timezone);
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  const events = await listOccurrences(user.id, start, end);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const timed = events.filter((e) => e.startTime);
  const firstHour = Math.min(8, ...timed.map((e) => Math.floor(minutesOf(e.startTime as string) / 60)));
  const lastHour = Math.max(23, ...timed.map((e) => Math.ceil(minutesOf(e.endTime ?? (e.startTime as string)) / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const height = hours.length * HOUR_PX;
  const yOf = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR_PX;

  const byDay = new Map<string, EventOccurrence[]>(days.map((d) => [d, []]));
  for (const event of timed) byDay.get(event.date)?.push(event);
  const { text, year } = rangeTitle(start, end);

  return (
    <>
      <CalendarTop
        title={<>{text} <span className="cr">{year}</span></>}
        subtitle={`Semana ${isoWeek(addDays(start, 1))} do ano`}
        prevHref={`/calendario/semana/${addDays(start, -7)}`}
        nextHref={`/calendario/semana/${addDays(start, 7)}`}
        prevLabel="Semana anterior"
        nextLabel="Próxima semana"
        view="semana"
        monthHref={`/calendario/mes/${monthOf(date)}?dia=${date}`}
        weekHref={`/calendario/semana/${date}`}
        date={date}
      />

      <section className="card" style={{ padding: 0, overflow: "hidden" }} aria-label="Agenda da semana">
        <div className="week-scroll">
          <ScrollToToday />
          <div className="week-inner">
            <div className="week-head">
              <div className="week-gutter" />
              {days.map((day) => {
                const allDay = events.filter((e) => e.date === day && !e.startTime);
                const holiday = holidayOn(day);
                return (
                  <div key={day} className="week-day">
                    <span className="xs b t2" style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>{WEEKDAYS_SHORT[dayOfWeek(day)]}</span>
                    <Link href={`/dia/${day}`} className={`dn${day === today ? " t" : ""}`} aria-label={`Abrir o dia ${parseDay(day).d}`}>{parseDay(day).d}</Link>
                    <span className="xs b week-holiday">{holiday ?? ""}</span>
                    {allDay.map((event) => (
                      <OverlayLink key={event.id} className={`lb xs c-${event.color}`} style={{ width: "100%" }} params={{ evento: event.id, data: event.date }}>{event.title}</OverlayLink>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="week-body">
              <div className="week-gutter week-hours">
                {hours.map((hour) => <div key={hour} className="xs b t3 num week-hour">{String(hour).padStart(2, "0")}:00</div>)}
              </div>
              {days.map((day) => {
                const list = byDay.get(day) ?? [];
                const spans = list.map((e) => {
                  const startMin = minutesOf(e.startTime as string);
                  return { id: e.id, start: startMin, end: Math.max(e.endTime ? minutesOf(e.endTime) : startMin + 30, startMin + 1) };
                }).sort((a, b) => a.start - b.start || b.end - a.end);
                const columns = assignColumns(spans);
                const showNow = day === today && minutesOf(now) >= firstHour * 60 && minutesOf(now) < lastHour * 60;
                return (
                  <div key={day} className={`week-col${day === today ? " today" : ""}`} style={{ height }}>
                    {list.map((event) => {
                      const startMin = minutesOf(event.startTime as string);
                      const endMin = event.endTime ? minutesOf(event.endTime) : startMin + 30;
                      const place = columns.get(event.id) ?? { column: 0, columns: 1 };
                      const widthPct = 100 / place.columns;
                      return (
                        <OverlayLink
                          key={`${event.id}-${event.date}`}
                          className={`ev c-${event.color}`}
                          params={{ evento: event.id, data: event.date }}
                          style={{
                            top: yOf(startMin),
                            height: Math.max(MIN_ITEM_PX, ((endMin - startMin) / 60) * HOUR_PX - 2),
                            left: `calc(${place.column * widthPct}% + 4px)`,
                            right: "auto",
                            width: `calc(${widthPct}% - 8px)`,
                          }}
                        >
                          <b className="ell">{event.title}</b>
                          {endMin - startMin >= 60 ? <span className="ell">{event.startTime}{event.endTime ? ` – ${event.endTime}` : ""}</span> : null}
                        </OverlayLink>
                      );
                    })}
                    {showNow ? <div className="week-now" style={{ top: yOf(minutesOf(now)) }}><span className="now">{now}</span></div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
