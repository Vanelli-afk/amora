"use client";

import { startTransition, useOptimistic, useState, type FormEvent } from "react";
import { addHabit, removeHabit, toggleHabit } from "@/actions/day";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { HabitView } from "@/data/habits";

function plural(streak: number) {
  if (streak === 0) return "comece hoje";
  return streak === 1 ? "1 dia seguido" : `${streak} dias seguidos`;
}

export function HabitsCard({ habits, today }: { habits: HabitView[]; today: string }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
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
    const result = await addHabit({ title });
    if (result.ok) {
      form.reset();
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

  return (
    <div className="col g8" style={{ marginTop: 16 }}>
      <div className="row jb">
        <span className="eyebrow">Sequência de hábitos</span>
        <div className="row g4">
          {optimistic.length ? (
            <button type="button" className="btn btn-g" style={{ padding: "0 8px", fontSize: 13 }} onClick={() => setManaging((v) => !v)} aria-pressed={managing}>
              {managing ? "Pronto" : "Editar"}
            </button>
          ) : null}
          <button type="button" className="btn btn-g btn-ic" aria-label="Adicionar hábito" onClick={() => setAdding((v) => !v)}><Icon name="plus" size="s" /></button>
        </div>
      </div>
      {adding ? (
        <form className="row g8" onSubmit={create}>
          <input className="inp f1" name="habito" placeholder="Ex.: Ler 20 páginas" aria-label="Nome do hábito" maxLength={80} autoFocus required />
          <button className="btn btn-p">Adicionar</button>
        </form>
      ) : null}
      {!optimistic.length && !adding ? <p className="sm t2">Crie um hábito para acompanhar a sua sequência.</p> : null}
      {optimistic.map((habit) => {
        const doneCount = habit.week.filter((d) => d.done && !d.isToday).length;
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
              <b className="ell" style={{ display: "block" }}>{habit.title}</b>
              <div className="xs t2">{plural(habit.streak)}</div>
            </div>
            {managing ? (
              <button type="button" className="btn btn-g btn-ic" aria-label={`Remover hábito ${habit.title}`} onClick={() => void archive(habit.id)}><Icon name="trash" size="s" /></button>
            ) : (
              <div className="hd" role="img" aria-label={`Últimos 7 dias: ${doneCount} concluídos, hoje ${habit.doneToday ? "concluído" : "pendente"}`}>
                {habit.week.map((day) => (
                  <i key={day.day} className={day.done ? "on" : day.isToday ? "td" : undefined} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
