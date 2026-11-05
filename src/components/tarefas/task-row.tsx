"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { OverlayLink } from "@/components/ui/links";
import type { Task } from "@/data/tasks";
import { relativeDay } from "@/lib/dates";

export function dueLabel(task: Pick<Task, "date" | "dueTime">, today: string, contextDay?: string | null): string | null {
  if (task.dueTime) return task.dueTime;
  if (task.date && task.date !== contextDay) return relativeDay(task.date, today);
  return null;
}

export function TaskRow({ task, today, contextDay, onToggle, grip, className, innerRef, style, showEdit = true, label }: {
  task: Task;
  today: string;
  contextDay?: string | null;
  onToggle: (task: Task) => void;
  grip?: ReactNode;
  className?: string;
  innerRef?: (node: HTMLLIElement | null) => void;
  style?: CSSProperties;
  showEdit?: boolean;
  label?: string | null;
}) {
  const text = label === undefined ? dueLabel(task, today, contextDay) : label;
  return (
    <li ref={innerRef} style={style} className={`task${task.done ? " done" : ""}${className ? ` ${className}` : ""}`}>
      {grip}
      <label>
        <input className="ck" type="checkbox" checked={task.done} disabled={task.id.startsWith("temp-")} onChange={() => onToggle(task)} />
        <span className="tt">{task.highlight && !task.done ? <span className="hl">{task.title}</span> : task.title}</span>
      </label>
      {text ? <span className="due">{text}</span> : null}
      {showEdit ? (
        <OverlayLink className="btn btn-g btn-ic task-del" params={{ novo: "tarefa", editar: task.id }} aria-label={`Editar ${task.title}`}>
          <Icon name="edit" size="s" />
        </OverlayLink>
      ) : null}
    </li>
  );
}
