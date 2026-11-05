"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { addNote, pinNote, refreshNotes, removeNote, saveNote } from "@/actions/notes";
import { Icon } from "@/components/ui/icon";
import { NoteColorPicker, type NoteColorId } from "@/components/ui/pickers";
import { useToast } from "@/components/ui/toast";
import { useAutosave } from "@/components/ui/use-autosave";
import type { Note } from "@/data/notes";

// O editor é a parte mais pesada do app; só baixa quando uma nota é aberta.
const RichEditor = dynamic(() => import("./rich-editor").then((m) => m.RichEditor), {
  ssr: false,
  loading: () => <div className="skl" style={{ height: 220 }} />,
});

const TAG_COLORS = ["peach", "sand", "sky", "lav", "sage", "rose"];
export function tagColor(tag: string) {
  let hash = 0;
  for (const char of tag) hash = (hash + (char.codePointAt(0) ?? 0)) % TAG_COLORS.length;
  return `c-${TAG_COLORS[hash]}`;
}

type Draft = { title: string; body: string; tags: string[]; color: NoteColorId };

export function NoteEditor({ note, editedLabel }: { note: Note; editedLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState(note.title ?? "");
  const [text, setText] = useState(note.kind === "postit" ? note.body : "");
  const [tags, setTags] = useState(note.tags);
  const [color, setColor] = useState<NoteColorId>(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [tagInput, setTagInput] = useState("");
  const [pending, start] = useTransition();
  const draft = useRef<Draft>({ title: note.title ?? "", body: note.body, tags: note.tags, color: note.color });
  const deleted = useRef(false);

  const { schedule, flush, status } = useAutosave<Draft>(async (value) => {
    if (deleted.current) return true;
    const result = await saveNote({ id: note.id, kind: note.kind, color: value.color, title: value.title || null, body: value.body, tags: value.tags });
    return result.ok;
  });

  function update(patch: Partial<Draft>) {
    draft.current = { ...draft.current, ...patch };
    schedule(draft.current);
  }

  function addTag(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    const clean = tagInput.trim().slice(0, 30);
    if (!clean || tags.includes(clean) || tags.length >= 12) return;
    const next = [...tags, clean];
    setTags(next);
    setTagInput("");
    update({ tags: next });
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    update({ tags: next });
  }

  function togglePin() {
    const next = !pinned;
    setPinned(next);
    start(async () => {
      const result = await pinNote({ id: note.id, pinned: next });
      if (!result.ok) {
        setPinned(!next);
        toast(result.error, { tone: "error" });
      }
    });
  }

  function finish() {
    start(async () => {
      await flush();
      await refreshNotes({});
      router.push("/notas", { scroll: false });
    });
  }

  function destroy() {
    deleted.current = true;
    const snapshot = { kind: note.kind, color: draft.current.color, date: note.date, title: draft.current.title || null, body: draft.current.body, tags: draft.current.tags };
    start(async () => {
      const result = await removeNote({ id: note.id });
      if (!result.ok) {
        deleted.current = false;
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Nota excluída", { action: { label: "Desfazer", run: () => void addNote(snapshot) } });
      router.push("/notas", { scroll: false });
    });
  }

  const statusText = status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : status === "error" ? "Não foi possível salvar" : editedLabel;

  return (
    <section className="card lg note-open enter" aria-label="Nota aberta">
      <div className="row jb" style={{ marginBottom: 8 }}>
        <span className="xs t2 b" aria-live="polite">{statusText}</span>
        <div className="row g4">
          <button type="button" className={`btn btn-g btn-ic tb-btn${pinned ? " on" : ""}`} aria-label={pinned ? "Desafixar nota" : "Fixar nota"} aria-pressed={pinned} onClick={togglePin}><Icon name="pin" /></button>
          <button type="button" className="btn btn-g btn-ic" aria-label="Excluir nota" onClick={destroy} disabled={pending}><Icon name="trash" /></button>
        </div>
      </div>

      {note.kind === "note" ? (
        <>
          <label className="eyebrow" htmlFor="nota-titulo" style={{ display: "block" }}>Título</label>
          <input id="nota-titulo" className="note-title-input" type="text" value={title} maxLength={200} onChange={(e) => { setTitle(e.target.value); update({ title: e.target.value }); }} placeholder="Sem título" />
        </>
      ) : null}

      <div className="row g8 wrap" style={{ margin: "6px 0 14px" }}>
        {tags.map((tag) => (
          <span key={tag} className={`tag ${tagColor(tag)}`}>
            {tag}
            <button type="button" className="tag-rm" aria-label={`Remover etiqueta ${tag}`} onClick={() => removeTag(tag)}>×</button>
          </span>
        ))}
        <input className="tag-input" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="+ etiqueta" aria-label="Adicionar etiqueta (Enter)" maxLength={30} />
      </div>

      {note.kind === "note" ? (
        <RichEditor body={note.body} onChange={(body) => update({ body })} />
      ) : (
        <>
          <label className="sr" htmlFor="nota-texto">Texto do post-it</label>
          <textarea id="nota-texto" className="inp ruled inp-hand" style={{ minHeight: 160 }} value={text} maxLength={2000} onChange={(e) => { setText(e.target.value); update({ body: e.target.value }); }} />
        </>
      )}

      <div className="row jb g8 wrap" style={{ marginTop: 12 }}>
        <NoteColorPicker value={color} withPaper={note.kind === "note"} onChange={(next) => { setColor(next); update({ color: next }); }} />
        <button type="button" className="btn btn-p" onClick={finish} disabled={pending}>Pronto</button>
      </div>
    </section>
  );
}
