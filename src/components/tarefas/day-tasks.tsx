"use client";

import Link from "next/link";
import { startTransition, useOptimistic, useRef, useState, type FormEvent } from "react";
import { quickAddTask, toggleTask } from "@/actions/tasks";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { Task } from "@/data/tasks";
import { TaskRow } from "./task-row";

type Change = { type: "toggle"; id: string } | { type: "add"; task: Task };

export function reduceTasks(state: Task[], change: Change): Task[] {
  if (change.type === "add") return [...state, change.task];
  return state.map((t) => (t.id === change.id ? { ...t, done: !t.done } : t));
}

export function DayTasks({ tasks, date, today, children }: { tasks: Task[]; date: string; today: string; children?: React.ReactNode }) {
  const toast = useToast();
  const [optimistic, apply] = useOptimistic(tasks, reduceTasks);
  const [title, setTitle] = useState("");
  const counter = useRef(0);

  const done = optimistic.filter((t) => t.done).length;

  function toggle(task: Task) {
    startTransition(async () => {
      apply({ type: "toggle", id: task.id });
      const result = await toggleTask({ id: task.id, done: !task.done });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      if (!task.done) {
        toast("Tarefa concluída", {
          action: { label: "Desfazer", run: () => startTransition(async () => { await toggleTask({ id: task.id, done: false }); }) },
        });
      }
    });
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setTitle("");
    counter.current += 1;
    startTransition(async () => {
      apply({
        type: "add",
        task: { id: `temp-${counter.current}`, title: clean, date, dueTime: null, done: false, doneAt: null, highlight: false },
      });
      const result = await quickAddTask({ title: clean, date });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        setTitle(clean);
      }
    });
  }

  return (
    <section className="card card-tight">
      <div className="cardhd">
        <h2 className="h2">Tarefas</h2>
        <div className="row g8">
          <span className="due">{done} de {optimistic.length} feitas</span>
          <Link className="btn btn-g" href="/tarefas">Ver todas</Link>
        </div>
      </div>
      {optimistic.length ? (
        <ul>
          {optimistic.map((task) => (
            <TaskRow key={task.id} task={task} today={today} contextDay={date} onToggle={toggle} showEdit={!task.id.startsWith("temp-")} />
          ))}
        </ul>
      ) : <p className="tasks-empty">Nada por aqui ainda. Que tal a primeira tarefa?</p>}
      <form className="inw" style={{ marginTop: 10 }} onSubmit={add}>
        <Icon name="plus" />
        <input className="inp" type="text" placeholder="Adicionar tarefa rápida… (Enter para salvar)" aria-label="Adicionar tarefa rápida" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} enterKeyHint="done" />
      </form>
      {children}
    </section>
  );
}
