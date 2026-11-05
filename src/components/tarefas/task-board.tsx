"use client";

import {
  closestCenter, type CollisionDetection, DndContext, type DragEndEvent, type DragOverEvent, type DragStartEvent, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { startTransition, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { clearDoneTasks, moveTasks, quickAddTask, toggleTask } from "@/actions/tasks";
import { Icon } from "@/components/ui/icon";
import { OverlayLink } from "@/components/ui/links";
import { useToast } from "@/components/ui/toast";
import type { Task } from "@/data/tasks";
import { addDays, formatShortDay, relativeDay } from "@/lib/dates";
import { TaskRow } from "./task-row";

type GroupId = "hoje" | "proximos" | "sem";

const GROUPS: { id: GroupId; title: string }[] = [
  { id: "hoje", title: "Hoje" },
  { id: "proximos", title: "Próximos dias" },
  { id: "sem", title: "Sem data" },
];

type Board = Record<GroupId, Task[]>;

function buildBoard(tasks: Task[], today: string): Board {
  const board: Board = { hoje: [], proximos: [], sem: [] };
  for (const task of tasks) {
    if (!task.date) board.sem.push(task);
    else if (task.date <= today) board.hoje.push(task);
    else board.proximos.push(task);
  }
  return board;
}

const findGroup = (board: Board, id: string): GroupId | null => {
  if (id === "hoje" || id === "proximos" || id === "sem") return id;
  return (Object.keys(board) as GroupId[]).find((g) => board[g].some((t) => t.id === id)) ?? null;
};

function SortableTask({ task, today, onToggle, label }: { task: Task; today: string; onToggle: (t: Task) => void; label: string | null }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <TaskRow
      task={task}
      today={today}
      onToggle={onToggle}
      innerRef={setNodeRef}
      label={label}
      className={isDragging ? "dragging" : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      grip={(
        <button type="button" ref={setActivatorNodeRef} className="grip" aria-label={`Arrastar ${task.title}`} {...attributes} {...listeners}>
          <Icon name="grip" size="s" />
        </button>
      )}
    />
  );
}

function GroupCard({ id, title, tasks, today, onToggle, hidden }: { id: GroupId; title: string; tasks: Task[]; today: string; onToggle: (t: Task) => void; hidden: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  if (hidden) return null;
  const count = id === "hoje" ? `${tasks.length} pendente${tasks.length === 1 ? "" : "s"}` : `${tasks.length} tarefa${tasks.length === 1 ? "" : "s"}`;
  return (
    <section ref={setNodeRef} className={`card group-drop${isOver ? " over" : ""}`} style={{ padding: "12px 18px 6px" }}>
      <div className="row jb" style={{ minHeight: 44 }}><h2 className="h2">{title}</h2><span className="due">{count}</span></div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.length ? (
          <ul>
            {tasks.map((task) => (
              <SortableTask
                key={task.id}
                task={task}
                today={today}
                onToggle={onToggle}
                label={task.dueTime ?? (task.date && (id !== "hoje" || task.date !== today) ? relativeDay(task.date, today) : null)}
              />
            ))}
          </ul>
        ) : <p className="tasks-empty">Solte uma tarefa aqui.</p>}
      </SortableContext>
    </section>
  );
}

export function TaskBoard({ open, done, today, doneToday }: { open: Task[]; done: Task[]; today: string; doneToday: number }) {
  const toast = useToast();
  const [board, setBoard] = useState<Board>(() => buildBoard(open, today));
  const [doneList, setDoneList] = useState(done);
  const [filter, setFilter] = useState("todos");
  const [title, setTitle] = useState("");
  const startGroup = useRef<GroupId | null>(null);
  const tempId = useRef(0);

  // O servidor é a fonte da verdade depois de cada ação.
  useEffect(() => setBoard(buildBoard(open, today)), [open, today]);
  useEffect(() => setDoneList(done), [done]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // O grupo só conta como alvo quando está vazio; senão a seta do teclado pula itens.
  const collision: CollisionDetection = (args) => closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => {
      const id = String(c.id);
      return !(id === "hoje" || id === "proximos" || id === "sem") || board[id].length === 0;
    }),
  });

  const chips = useMemo(() => [
    { id: "todos", label: "Todos" },
    { id: today, label: `Hoje · ${formatShortDay(today)}` },
    ...[1, 2, 3].map((n) => ({ id: addDays(today, n), label: formatShortDay(addDays(today, n)) })),
    { id: "sem", label: "Sem data" },
  ], [today]);

  const visible = (tasks: Task[]) => {
    if (filter === "todos") return tasks;
    if (filter === "sem") return tasks.filter((t) => !t.date);
    if (filter === today) return tasks.filter((t) => t.date && t.date <= today);
    return tasks.filter((t) => t.date === filter);
  };

  const pendingToday = board.hoje.length;
  const totalOpen = board.hoje.length + board.proximos.length + board.sem.length;
  const totalToday = pendingToday + doneToday;
  const percent = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

  function toggle(task: Task) {
    const group = findGroup(board, task.id);
    if (group) {
      setBoard((b) => ({ ...b, [group]: b[group].filter((t) => t.id !== task.id) }));
      setDoneList((list) => [{ ...task, done: true }, ...list]);
    } else {
      setDoneList((list) => list.filter((t) => t.id !== task.id));
      setBoard((b) => buildBoard([...b.hoje, ...b.proximos, ...b.sem, { ...task, done: false }], today));
    }
    startTransition(async () => {
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

  function onDragStart(event: DragStartEvent) {
    startGroup.current = findGroup(board, String(event.active.id));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findGroup(board, String(active.id));
    const to = findGroup(board, String(over.id));
    if (!from || !to || from === to) return;
    setBoard((b) => {
      const task = b[from].find((t) => t.id === active.id);
      if (!task) return b;
      const overIndex = b[to].findIndex((t) => t.id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : b[to].length;
      const target = [...b[to]];
      target.splice(insertAt, 0, task);
      return { ...b, [from]: b[from].filter((t) => t.id !== active.id), [to]: target };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const group = findGroup(board, String(active.id));
    if (!over || !group) return;
    const list = board[group];
    const oldIndex = list.findIndex((t) => t.id === active.id);
    const newIndex = list.findIndex((t) => t.id === over.id);
    const ordered = newIndex >= 0 && oldIndex !== newIndex ? arrayMove(list, oldIndex, newIndex) : list;

    const moved = startGroup.current !== group;
    const task = ordered.find((t) => t.id === active.id);
    let date: string | null = task?.date ?? null;
    if (moved) {
      if (group === "hoje") date = today;
      else if (group === "sem") date = null;
      else date = task?.date && task.date > today ? task.date : addDays(today, 1);
    }
    const next = ordered.map((t) => (t.id === active.id ? { ...t, date } : t));
    setBoard((b) => ({ ...b, [group]: next }));
    if (!moved && oldIndex === newIndex) return;

    startTransition(async () => {
      const result = await moveTasks({
        orderedIds: next.map((t) => t.id),
        ...(moved ? { moved: { id: String(active.id), date } } : {}),
      });
      if (!result.ok) toast(result.error, { tone: "error" });
    });
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setTitle("");
    const date = filter === "sem" ? null : filter === "todos" ? today : filter;
    tempId.current += 1;
    const temp: Task = { id: `temp-${tempId.current}`, title: clean, date, dueTime: null, done: false, doneAt: null, highlight: false };
    setBoard((b) => buildBoard([...b.hoje, ...b.proximos, ...b.sem, temp], today));
    startTransition(async () => {
      const result = await quickAddTask({ title: clean, date });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        setTitle(clean);
      }
    });
  }

  function clearAll() {
    const before = doneList;
    setDoneList([]);
    startTransition(async () => {
      const result = await clearDoneTasks({});
      if (!result.ok) {
        setDoneList(before);
        toast(result.error, { tone: "error" });
      }
    });
  }

  return (
    <>
      <div className="dtop">
        <div className="col">
          <h1 className="page-title">Tarefas</h1>
          <span className="sm t2 b">{pendingToday} para hoje · {totalOpen} no total</span>
        </div>
        <OverlayLink className="btn btn-p only-desktop" params={{ novo: "tarefa" }}><Icon name="plus" size="s" />Nova tarefa</OverlayLink>
      </div>

      <div className="row g8 wrap chips-scroll" role="group" aria-label="Filtrar por dia">
        {chips.map((chip) => (
          <button key={chip.id} type="button" className={`chip${filter === chip.id ? " on" : ""}`} aria-pressed={filter === chip.id} onClick={() => setFilter(chip.id)}>{chip.label}</button>
        ))}
      </div>

      <div className="row wrap g20" style={{ alignItems: "flex-start" }}>
        <div className="col g16" style={{ flex: "1.5 1 460px", minWidth: 0 }}>
          <form className="inw" onSubmit={add}>
            <Icon name="plus" />
            <input className="inp" type="text" placeholder="Adicionar tarefa… (Enter para salvar)" aria-label="Nova tarefa" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} enterKeyHint="done" />
          </form>
          <DndContext id="tarefas" sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
            {GROUPS.map((group) => {
              const tasks = visible(board[group.id]);
              return <GroupCard key={group.id} id={group.id} title={group.title} tasks={tasks} today={today} onToggle={toggle} hidden={filter !== "todos" && !tasks.length} />;
            })}
          </DndContext>
          {filter !== "todos" && !GROUPS.some((g) => visible(board[g.id]).length) ? (
            <div className="empty"><h2 className="h3">Nada para este dia</h2><p>Aproveite, ou adicione uma tarefa acima.</p></div>
          ) : null}
        </div>

        <div className="col g16" style={{ flex: "1 1 320px", minWidth: 0 }}>
          <section className="card" style={{ padding: "12px 18px 6px" }}>
            <div className="row jb" style={{ minHeight: 44 }}><h2 className="h2">Concluídas</h2><span className="due">{doneList.length}</span></div>
            {doneList.length ? (
              <>
                <ul>
                  {doneList.map((task) => (
                    <TaskRow key={task.id} task={task} today={today} onToggle={toggle} showEdit={false} label={task.date ? relativeDay(task.date, today) : null} />
                  ))}
                </ul>
                <button type="button" className="btn btn-g" style={{ margin: "4px 0 6px -8px" }} onClick={clearAll}>Limpar concluídas</button>
              </>
            ) : <p className="tasks-empty">As tarefas feitas aparecem aqui.</p>}
          </section>
          <section className="card" style={{ padding: 18 }}>
            <span className="eyebrow">Progresso de hoje</span>
            <div className="row jb ae" style={{ marginTop: 6 }}>
              <span className="ser num" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.1 }}>{doneToday} <span className="t3" style={{ fontSize: 20 }}>/ {totalToday}</span></span>
              <span className="ser cr" style={{ fontSize: 26, fontWeight: 700 }}>{percent}%</span>
            </div>
            <div className="bar" style={{ marginTop: 10, height: 10 }}><i style={{ width: `${percent}%` }} /></div>
          </section>
          <div className="pit y" style={{ transform: "rotate(1.5deg)", marginTop: 6 }}>
            <span className="tape" />Dica: arraste pelos pontinhos para reordenar, ou solte em outro grupo.
          </div>
        </div>
      </div>
    </>
  );
}
