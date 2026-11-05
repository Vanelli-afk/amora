"use client";

import Highlight from "@tiptap/extension-highlight";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Icon } from "@/components/ui/icon";

function parse(body: string) {
  try {
    return JSON.parse(body) as object;
  } catch {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
}

/** Só as extensões que o servidor aceita em sanitizeDoc (src/lib/notes.ts). */
export function RichEditor({ body, onChange }: { body: string; onChange: (json: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    content: parse(body),
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        link: false,
        underline: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        strike: false,
        horizontalRule: false,
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: false }),
    ],
    editorProps: { attributes: { "aria-label": "Conteúdo da nota", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: current }) => onChange(JSON.stringify(current.getJSON())),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      highlight: e?.isActive("highlight") ?? false,
      list: e?.isActive("bulletList") ?? false,
      tasks: e?.isActive("taskList") ?? false,
      heading: e?.isActive("heading") ?? false,
    }),
  });

  const button = (active: boolean | undefined) => `btn btn-g btn-ic tb-btn${active ? " on" : ""}`;

  return (
    <>
      <div className="nt editor"><EditorContent editor={editor} /></div>
      <div className="row g4 wrap" style={{ marginTop: 12 }} role="toolbar" aria-label="Formatação">
        <button type="button" className={`${button(state?.bold)} tb-b`} aria-label="Negrito" aria-pressed={state?.bold} onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
        <button type="button" className={`${button(state?.italic)} tb-i`} aria-label="Itálico" aria-pressed={state?.italic} onClick={() => editor?.chain().focus().toggleItalic().run()}>I</button>
        <button type="button" className={button(state?.highlight)} aria-label="Marca-texto" aria-pressed={state?.highlight} onClick={() => editor?.chain().focus().toggleHighlight().run()}><span className="hl tb-h">Ab</span></button>
        <button type="button" className={`${button(state?.heading)} hand`} style={{ fontSize: 22 }} aria-label="Subtítulo" aria-pressed={state?.heading} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>Aa</button>
        <button type="button" className={button(state?.list)} aria-label="Lista" aria-pressed={state?.list} onClick={() => editor?.chain().focus().toggleBulletList().run()}><Icon name="list" /></button>
        <button type="button" className={button(state?.tasks)} aria-label="Lista de tarefas" aria-pressed={state?.tasks} onClick={() => editor?.chain().focus().toggleTaskList().run()}><Icon name="tasks" /></button>
      </div>
    </>
  );
}
