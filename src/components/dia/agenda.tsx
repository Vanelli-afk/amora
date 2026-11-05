import { removeReminder } from "@/actions/misc";
import { Icon } from "@/components/ui/icon";
import { OverlayLink } from "@/components/ui/links";
import type { EventOccurrence } from "@/data/events";
import type { StandaloneReminder } from "@/data/reminders";
import { buildTimeline } from "@/lib/timeline";

const pad = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const GUTTER = 56;

export function Agenda({ date, events, reminders, now }: { date: string; events: EventOccurrence[]; reminders: StandaloneReminder[]; now: string | null }) {
  const timed = events.filter((e) => e.startTime);
  const allDay = events.filter((e) => !e.startTime);
  const timeline = buildTimeline(timed.map((e) => ({ id: e.id, start: e.startTime as string, end: e.endTime })), now);
  const byId = new Map(timed.map((e) => [e.id, e]));

  return (
    <section className="card card-tight">
      <div className="cardhd">
        <h2 className="h2">Agenda</h2>
        <OverlayLink className="btn btn-s" params={{ novo: "compromisso", data: date }}><Icon name="plus" size="s" />Compromisso</OverlayLink>
      </div>

      {allDay.length ? (
        <div className="allday">
          {allDay.map((event) => (
            <OverlayLink key={event.id} className={`tag c-${event.color}`} params={{ evento: event.id, data: event.date }}>{event.title}</OverlayLink>
          ))}
        </div>
      ) : null}

      {reminders.length ? (
        <div className="col g6" style={{ marginBottom: 10 }}>
          {reminders.map((reminder) => (
            <form key={reminder.id} className="reminder-row" action={async () => { "use server"; await removeReminder({ id: reminder.id }); }}>
              <Icon name="bell" size="s" className="cr" />
              <span className="num">{reminder.time}</span>
              <span className="f1 ell">{reminder.title}</span>
              <button className="btn btn-g btn-ic" style={{ minHeight: 28, width: 28 }} aria-label={`Remover lembrete ${reminder.title}`}><Icon name="close" size="s" /></button>
            </form>
          ))}
        </div>
      ) : null}

      <div className="tl" style={{ height: timeline.height }}>
        {timeline.hours.map((hour) => (
          <div key={hour.hour} className="hr" style={{ top: hour.top }}><b>{pad(hour.hour)}</b></div>
        ))}
        {timeline.items.map((item) => {
          const event = byId.get(item.id);
          if (!event) return null;
          const span = event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime;
          const width = `calc((100% - ${GUTTER}px) / ${item.columns})`;
          const split = item.columns > 1
            ? { left: `calc(${GUTTER}px + ${width} * ${item.column})`, width: `calc(${width} - 3px)`, right: "auto" }
            : {};
          return (
            <OverlayLink
              key={item.id}
              className={`ev c-${event.color}${item.compact ? " s" : ""}`}
              params={{ evento: event.id, data: event.date }}
              style={{ top: item.top, height: item.height, ...split }}
            >
              <b className="ell">{event.title}</b>
              <span className="ell">{item.compact ? event.startTime : `${span}${event.location ? ` · ${event.location}` : ""}`}</span>
            </OverlayLink>
          );
        })}
        {timeline.gaps.map((gap) => (
          <div key={gap.fromHour} className="gap" style={{ top: gap.top, height: gap.height }}>
            {gap.nowInside ? <span className="now">agora · {now}</span> : null}
            <span>{gap.toHour >= 24 ? "livre até o fim do dia" : `livre até as ${pad(gap.toHour)}`}</span>
          </div>
        ))}
        {timeline.nowTop !== null ? <div className="now-line" style={{ top: timeline.nowTop }} aria-label={`Agora, ${now}`} /> : null}
      </div>
      {!events.length ? <p className="sm t2 tc" style={{ marginTop: 4 }}>Nenhum compromisso. Dia livre!</p> : null}
    </section>
  );
}
