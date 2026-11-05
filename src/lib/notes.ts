/** Esquema permitido no corpo das notas. Tudo o que não está aqui é descartado no servidor. */
const NODES = new Set(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "taskList", "taskItem", "hardBreak"]);
const MARKS = new Set(["bold", "italic", "highlight"]);

export type DocNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: DocNode[];
};

const MAX_DEPTH = 12;

function cleanNode(value: unknown, depth: number): DocNode | null {
  if (depth > MAX_DEPTH || typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.type !== "string" || !NODES.has(raw.type)) return null;

  const node: DocNode = { type: raw.type };
  if (raw.type === "text") {
    if (typeof raw.text !== "string" || !raw.text) return null;
    node.text = raw.text;
    if (Array.isArray(raw.marks)) {
      const marks = raw.marks
        .map((m) => (m as { type?: unknown })?.type)
        .filter((t): t is string => typeof t === "string" && MARKS.has(t))
        .map((type) => ({ type }));
      if (marks.length) node.marks = marks;
    }
  }
  if (raw.type === "taskItem") node.attrs = { checked: (raw.attrs as { checked?: unknown })?.checked === true };
  if (raw.type === "heading") node.attrs = { level: 3 };
  if (Array.isArray(raw.content)) {
    const content = raw.content.map((c) => cleanNode(c, depth + 1)).filter((c): c is DocNode => c !== null);
    if (content.length) node.content = content;
  }
  return node;
}

/** Devolve o documento só com o que o editor permite, ou null se não for válido. */
export function sanitizeDoc(value: unknown): DocNode | null {
  const doc = cleanNode(value, 0);
  return doc?.type === "doc" ? doc : null;
}

export function docToText(node: DocNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return " ";
  const inner = (node.content ?? []).map(docToText);
  const blocky = node.type === "doc" || node.type.endsWith("List");
  return inner.join(blocky ? " · " : "").trim();
}

export function bodyToText(kind: "postit" | "note", body: string): string {
  if (kind === "postit") return body;
  try {
    return docToText(JSON.parse(body) as DocNode);
  } catch {
    return "";
  }
}

export function preview(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

/** Sem acentos e em minúsculas, para "reuniao" encontrar "Reunião". */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function matchesQuery(haystack: string, query: string): boolean {
  const target = normalizeSearch(haystack);
  return normalizeSearch(query).split(/\s+/).filter(Boolean).every((token) => target.includes(token));
}
