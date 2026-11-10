"use client";

import { startTransition, useOptimistic, useState, type FormEvent } from "react";
import { addHabit, editHabit, removeHabit, toggleHabit } from "@/actions/day";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { HabitView } from "@/data/habits";
import { WEEKDAYS, WEEKDAYS_INITIAL, WEEKDAYS_SHORT } from "@/lib/dates";
import { ALL_WEEKDAYS, weekdaysMask } from "@/lib/streak";

function plural(streak: number) {
  if (streak === 0) return "comece hoje";
  return streak === 1 ? "1 dia seguido" : `${streak} dias seguidos`;
}

/** Texto curto dos dias em que o hábito vale; nada quando é todo dia. */
function describeDays(mask: number): string | null {
  if (mask === ALL_WEEKDAYS) return null;
  if (mask === weekdaysMask([1, 2, 3, 4, 5])) return "dias úteis";
  if (mask === weekdaysMask([0, 6])) return "fins de semana";
  return WEEKDAYS_SHORT.filter((_, index) => (mask >> index) & 1).join(", ");
}

function DayPicker({ mask, onChange, label }: { mask: number; onChange: (mask: number) => void; label: string }) {
  return (
    <div className="wd" role="group" aria-label={label}>
      {WEEKDAYS_INITIAL.map((initial, index) => {
        const on = ((mask >> index) & 1) === 1;
        return (
          <button key={WEEKDAYS[index]} type="button" aria-pressed={on} aria-label={WEEKDAYS[index]} onClick={() => onChange(mask ^ (1 << index))}>
            {initial}
          </button>
        );
      })}
    </div>
  );
}

type Edit = { title?: string; weekdays?: number };

export function HabitsCard({ habits, today }: { habits: HabitView[]; today: string }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [newDays, setNewDays] = useState(ALL_WEEKDAYS);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [optimistic, apply] = useOptimistic(habits.filter((h) => !removed.includes(h.id)), (state, id: string) =>
    state.map((h) => {
      if (h.id !== id) return h;
      const doneToday = !h.doneToday;
      return {
        ...h,
        doneToday,
        streak: Math.max(0, h.streak + (doneToday ? 1 : -1)),
        week: h.week.map((d) => (d.isToday ? { ...d, done: doneToday } : d)),
      };
    }));
  const list = optimistic.map((habit) => ({ ...habit, ...edits[habit.id] }));

  function toggle(habit: HabitView) {
    startTransition(async () => {
      apply(habit.id);
      const result = await toggleHabit({ id: habit.id, date: today, done: !habit.doneToday });
      if (!result.ok) toast(result.error, { tone: "error" });
    });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get("habito")).trim();
    if (!title) return;
    const result = await addHabit({ title, ...(newDays !== ALL_WEEKDAYS ? { weekdays: newDays } : {}) });
    if (result.ok) {
      form.reset();
      setNewDays(ALL_WEEKDAYS);
      setAdding(false);
    } else {
      toast(result.error, { tone: "error" });
    }
  }

  async function archive(id: string) {
    setRemoved((list) => [...list, id]);
    const result = await removeHabit({ id });
    if (!result.ok) {
      setRemoved((list) => list.filter((h) => h !== id));
      toast(result.error, { tone: "error" });
    }
  }

  async function change(habit: HabitView, patch: Edit) {
    setEdits((current) => ({ ...current, [habit.id]: { ...current[habit.id], ...patch } }));
    const result = await editHabit({ id: habit.id, ...patch });
    if (!result.ok) {
      setEdits((current) => {
        const next = { ...current };
        delete next[habit.id];
        return next;
      });
      toast(result.error, { tone: "error" });
    }
  }

  return (
    <div className="col g8" style={{ marginTop: 16 }}>
      <div className="row jb">
        <span className="eyebrow">Sequência de hábitos</span>
        <div className="row g4">
          {list.length ? (
            <button type="button" className="btn btn-g" style={{ padding: "0 8px", fontSize: 13 }} onClick={() => setManaging((v) => !v)} aria-pressed={managing}>
              {managing ? "Pronto" : "Editar"}
            </button>
          ) : null}
          <button type="button" className="btn btn-g btn-ic" aria-label="Adicionar hábito" onClick={() => setAdding((v) => !v)}><Icon name="plus" size="s" /></button>
        </div>
      </div>
      {adding ? (
        <form className="col g8" onSubmit={create}>
          <div className="row g8">
            <input className="inp f1" name="habito" placeholder="Ex.: Ler 20 páginas" aria-label="Nome do hábito" maxLength={80} autoFocus required />
            <button className="btn btn-p">Adicionar</button>
          </div>
          <DayPicker mask={newDays} label="Dias da semana do novo hábito" onChange={(mask) => { if (mask) setNewDays(mask); }} />
        </form>
      ) : null}
      {!list.length && !adding ? <p className="sm t2">Crie um hábito para acompanhar a sua sequência.</p> : null}
      {list.map((habit) => {
        const doneCount = habit.week.filter((d) => d.done && !d.isToday).length;
        const days = describeDays(habit.weekdays);
        return (
          <div className="habit" key={habit.id}>
            <button
              type="button"
              className="habit-check"
              role="checkbox"
              aria-checked={habit.doneToday}
              aria-label={`${habit.title}: marcar hoje`}
              onClick={() => toggle(habit)}
            >
              <Icon name={habit.doneToday ? "check" : "flame"} className="cr" />
            </button>
            <div className="f1" style={{ minWidth: 0 }}>
              {managing ? (
                <div className="col g8">
                  <input
                    className="inp"
                    defaultValue={habit.title}
                    maxLength={80}
                    aria-label={`Nome do hábito ${habit.title}`}
                    onBlur={(e) => {
                      const title = e.target.value.trim();
                      if (title && title !== habit.title) void change(habit, { title });
                      else e.target.value = habit.title;
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  />
                  <DayPicker mask={habit.weekdays} label={`Dias de ${habit.title}`} onChange={(mask) => { if (mask) void change(habit, { weekdays: mask }); }} />
                </div>
              ) : (
                <>
                  <b className="ell" style={{ display: "block" }}>{habit.title}</b>
                  <div className="xs t2">
                    {plural(habit.streak)}
                    {habit.best > habit.streak ? ` · recorde ${habit.best}` : ""}
                    {days ? ` · ${days}` : ""}
                  </div>
                </>
              )}
            </div>
            {managing ? (
              <button type="button" className="btn btn-g btn-ic" aria-label={`Remover hábito ${habit.title}`} onClick={() => void archive(habit.id)}><Icon name="trash" size="s" /></button>
            ) : (
              <div className="hd" role="img" aria-label={`Últimos 7 dias: ${doneCount} concluídos, hoje ${habit.doneToday ? "concluído" : "pendente"}`}>
                {habit.week.map((day) => (
                  <i key={day.day} className={[day.done ? "on" : day.isToday ? "td" : "", !day.scheduled && !day.done ? "off" : ""].join(" ").trim() || undefined} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
