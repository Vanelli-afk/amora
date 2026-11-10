import Link from "next/link";
import { OpenSearchField } from "@/components/shell/open-search";
import { Agenda } from "@/components/dia/agenda";
import { DaySwiper } from "@/components/dia/day-swiper";
import { HabitsCard } from "@/components/dia/habits-card";
import { Journal } from "@/components/dia/journal";
import { Metrics } from "@/components/dia/metrics";
import { DayTasks } from "@/components/tarefas/day-tasks";
import { Icon, RainbowArt, SparkleArt } from "@/components/ui/icon";
import { OverlayLink } from "@/components/ui/links";
import { getDayEntry } from "@/data/day";
import { listDayWithMonthMarks } from "@/data/events";
import { listHabits } from "@/data/habits";
import { listDayNotes } from "@/data/notes";
import { listStandaloneReminders } from "@/data/reminders";
import type { Settings } from "@/data/settings";
import { listTasksForDay } from "@/data/tasks";
import {
  addDays, addMonths, dayOfWeek, formatDayMonth, formatMonthYear, isoWeek, MONTHS, monthOf, parseDay, timeIn, todayIn, WEEKDAYS, WEEKDAYS_INITIAL,
} from "@/lib/dates";
import { holidayOn } from "@/lib/holidays";
import { quoteFor, vibeFor } from "@/lib/phrases";
import { MiniMonth } from "@/components/calendario/mini-month";

const ROTATIONS = [-1.6, 1.4, 1, -1.2, 1.3, -1];

export async function DayView({ userId, date, settings }: { userId: string; date: string; settings: Settings }) {
  const today = todayIn(settings.timezone);
  const isToday = date === today;
  const month = monthOf(date);
  const firstOfMonth = `${month}-01`;
  const lastOfMonth = addDays(`${addMonths(month, 1)}-01`, -1);

  const [entry, { occurrences: events, marked }, tasks, notes, habits, reminders] = await Promise.all([
    getDayEntry(userId, date),
    listDayWithMonthMarks(userId, date, firstOfMonth, lastOfMonth),
    listTasksForDay(userId, date, today),
    listDayNotes(userId, date),
    listHabits(userId, today),
    listStandaloneReminders(userId, date),
  ]);

  const { d } = parseDay(date);
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const holiday = holidayOn(date);

  return (
    <>
      <div className="dtop">
        <div className="row g12">
          <div className="row g4">
            <Link className="btn btn-s btn-ic" href={`/dia/${prev}`} aria-label="Dia anterior" prefetch><Icon name="left" /></Link>
            <Link className="btn btn-s" href="/hoje">Hoje</Link>
            <Link className="btn btn-s btn-ic" href={`/dia/${next}`} aria-label="Próximo dia" prefetch><Icon name="right" /></Link>
          </div>
          <div className="col only-desktop">
            <h2 className="h2">{formatMonthYear(month)}</h2>
            <span className="xs t2 b">Semana {isoWeek(date)} do ano</span>
          </div>
        </div>
        <div className="row g8 only-desktop">
          <OpenSearchField />
          <OverlayLink className="btn btn-p" params={{ novo: "compromisso", data: date }}><Icon name="plus" size="s" />Novo item</OverlayLink>
        </div>
      </div>

      <DaySwiper key={date} prevHref={`/dia/${prev}`} nextHref={`/dia/${next}`}>
        <section className="row wrap g24 jb day-head">
          <div className="row g24 day-title">
            <div className="day day-num">{d}</div>
            <div className="col g4 day-meta">
              <span className="eyebrow">{WEEKDAYS[dayOfWeek(date)]}</span>
              <h1 className="ser day-date">{formatDayMonth(date)}</h1>
              {holiday ? <span className="tag c-rose" style={{ alignSelf: "flex-start" }}>{holiday}</span> : null}
              <span className="hand row g4 day-vibe">{vibeFor(date)} <SparkleArt /></span>
            </div>
          </div>
          <Link href={`/calendario/mes/${month}`} className="mini-card only-desktop">
            <div className="row jb" style={{ marginBottom: 6, padding: "0 2px" }}>
              <span className="eyebrow">{MONTHS[parseDay(date).m - 1]}</span>
              <span className="xs t3 b">{parseDay(date).y}</span>
            </div>
            <span className="sr">Abrir o calendário</span>
            <MiniMonth month={month} today={today} marked={marked} initials={WEEKDAYS_INITIAL} />
          </Link>
        </section>

        <Metrics
          key={`metrics-${date}`}
          date={date}
          mood={entry.mood}
          waterMl={entry.waterMl}
          waterGoal={settings.waterGoal}
          steps={entry.steps}
          sleepMinutes={entry.sleepMinutes}
          sticker={entry.sticker}
          stepGoal={settings.stepGoal}
        />

        <div className="row wrap g20 two-col">
          <Agenda date={date} events={events} reminders={reminders} now={isToday ? timeIn(settings.timezone) : null} />
          <div className="col g20">
            <DayTasks tasks={tasks} date={date} today={today}>
              <HabitsCard habits={habits} today={today} />
            </DayTasks>
            <section className="card card-tight">
              <div className="cardhd">
                <h2 className="h2">Notas e pensamentos</h2>
                <div className="row g4">
                  <OverlayLink className="btn btn-g btn-ic" params={{ novo: "nota", data: date }} aria-label="Novo post-it"><Icon name="plus" /></OverlayLink>
                  <Link className="btn btn-g" href="/notas">Ver todas</Link>
                </div>
              </div>
              {notes.length ? (
                <div className="grid2 pit-grid">
                  {notes.map((note, index) => (
                    note.kind === "postit" ? (
                      <Link key={note.id} href={`/notas/${note.id}`} className={`pit pit-link pit-in ${note.color === "paper" ? "y" : note.color}`} style={{ transform: `rotate(${ROTATIONS[index % ROTATIONS.length]}deg)` }}>
                        <span className={`tape${index % 3 === 1 ? " sky" : index % 3 === 2 ? " sage" : ""}`} />
                        {note.preview}
                      </Link>
                    ) : (
                      <Link key={note.id} href={`/notas/${note.id}`} className="nt note-tile">
                        <b>{note.title ?? "Sem título"}</b>
                        <span className="sm t2">{note.preview}</span>
                      </Link>
                    )
                  ))}
                </div>
              ) : <p className="tasks-empty">Um pensamento solto? Cole um post-it.</p>}
            </section>
          </div>
        </div>

        <section className="row wrap g20 day-foot">
          <div className="card row g16" style={{ flex: "1 1 260px", minWidth: 0 }}>
            <RainbowArt />
            <div className="col">
              <span className="eyebrow">Frase do dia</span>
              <span className="hand quote-line">{quoteFor(date)}</span>
            </div>
          </div>
          <Journal key={`journal-${date}`} date={date} gratitude={entry.gratitude} reflection={entry.reflection} />
        </section>
      </DaySwiper>
    </>
  );
}
