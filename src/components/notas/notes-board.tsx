"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { addNote } from "@/actions/notes";
import { Icon } from "@/components/ui/icon";
import { TransitionLink } from "@/components/ui/links";
import { useToast } from "@/components/ui/toast";
import type { NoteSummary } from "@/data/notes";
import { relativeDay } from "@/lib/dates";
import { matchesQuery } from "@/lib/notes";

// Sem view-transition-name aqui: dentro de `columns` ele derruba o renderizador do Chromium.
const ROTATIONS = [-1.4, 1.2, -1, 1.4, -1.2, 1];
const TAPES = ["", " sky", "", " sage"];

export function NotesBoard({ notes, openId, today, timezone, children }: {
  notes: NoteSummary[]; openId: string | null; today: string; timezone: string; children?: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();

  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, "pt-BR")), [notes]);
  const visible = notes.filter((n) =>
    (!tag || n.tags.includes(tag)) && (!query.trim() || matchesQuery(`${n.title ?? ""} ${n.text} ${n.tags.join(" ")}`, query)));

  const when = (iso: string) => {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
    return relativeDay(day, today);
  };

  function createNote() {
    start(async () => {
      const result = await addNote({ kind: "note", color: "paper", date: null, title: null, body: "", tags: tag ? [tag] : [] });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      router.push(`/notas/${result.data}`, { scroll: false });
    });
  }

  return (
    <div className={openId ? "note-open-page" : undefined}>
      <div className="dtop">
        <div className="col">
          <h1 className="page-title">Notas</h1>
          <span className="sm t2 b">{notes.length} nota{notes.length === 1 ? "" : "s"} e post-its</span>
        </div>
        <div className="row g8 top-tools">
          <div className="inw" style={{ width: 280 }}>
            <Icon name="search" />
            <input className="inp" type="search" placeholder="Buscar nas notas…" aria-label="Buscar nas notas" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} />
          </div>
          <button type="button" className="btn btn-p" onClick={createNote} disabled={pending}><Icon name="plus" size="s" />Nova nota</button>
        </div>
      </div>

      {tags.length ? (
        <div className="row g8 wrap chips-scroll" role="group" aria-label="Filtrar por etiqueta">
          <button type="button" className={`chip${!tag ? " on" : ""}`} aria-pressed={!tag} onClick={() => setTag(null)}>Todas</button>
          {tags.map((name) => (
            <button key={name} type="button" className={`chip${tag === name ? " on" : ""}`} aria-pressed={tag === name} onClick={() => setTag(name)}>{name}</button>
          ))}
        </div>
      ) : null}

      <div className="row wrap g24 notes-layout">
        {visible.length ? (
          <section className="mural mural-wrap" aria-label="Mural de notas">
            {visible.map((note, index) => <div key={note.id} className="mural-item">{note.kind === "postit" ? (
              <TransitionLink
                href={`/notas/${note.id}`}
                scroll={false}
                className={`pit pit-link ${note.color === "paper" ? "y" : note.color}`}
                style={{ transform: `rotate(${ROTATIONS[index % ROTATIONS.length]}deg)`, boxShadow: note.id === openId ? "0 0 0 2.5px var(--coral)" : undefined }}
                aria-current={note.id === openId ? "true" : undefined}
              >
                <span className={`tape${TAPES[index % TAPES.length]}`} />
                {note.pinned ? <Icon name="pin" size="s" className="pin-mark" /> : null}
                {note.preview}
                <span className="meta">{when(note.updatedAt)}</span>
              </TransitionLink>
            ) : (
              <TransitionLink
                href={`/notas/${note.id}`}
                scroll={false}
                className={`nt note-tile${note.id === openId ? " on" : ""}${note.color !== "paper" ? ` tint-${note.color}` : ""}`}
                aria-current={note.id === openId ? "true" : undefined}
              >
                {note.pinned ? <Icon name="pin" size="s" className="pin-mark" /> : null}
                <b>{note.title ?? "Sem título"}</b>
                <span className="sm t2">{note.preview}</span>
                <span className="xs t3 b note-meta">{when(note.updatedAt)}</span>
              </TransitionLink>
            )}</div>)}
          </section>
        ) : (
          <div className="empty f1">
            <h2 className="h3">{notes.length ? "Nada encontrado" : "O mural está vazio"}</h2>
            <p>{notes.length ? "Tente outra palavra ou etiqueta." : "Comece com uma nota ou cole um post-it."}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
