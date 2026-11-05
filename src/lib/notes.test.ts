import { describe, expect, it } from "vitest";
import { bodyToText, docToText, matchesQuery, preview, sanitizeDoc } from "./notes";

describe("documento das notas", () => {
  it("mantém o que o editor produz", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "oi", marks: [{ type: "bold" }, { type: "highlight" }] }] },
        { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "3 ovos" }] }] }] },
      ],
    };
    expect(sanitizeDoc(doc)).toEqual(doc);
  });

  it("remove nós, marcas e atributos fora do esquema", () => {
    const doc = sanitizeDoc({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { onclick: "alert(1)" }, content: [
          { type: "text", text: "clique", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "bold" }] },
        ] },
        { type: "iframe", attrs: { src: "https://mal.exemplo" } },
        { type: "image", attrs: { src: "x" } },
      ],
    });
    expect(doc).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "clique", marks: [{ type: "bold" }] }] }] });
    expect(JSON.stringify(doc)).not.toContain("javascript");
  });

  it("recusa o que não é documento", () => {
    expect(sanitizeDoc({ type: "paragraph" })).toBeNull();
    expect(sanitizeDoc("<script>alert(1)</script>")).toBeNull();
    expect(sanitizeDoc(null)).toBeNull();
  });

  it("não estoura com aninhamento absurdo", () => {
    let node: Record<string, unknown> = { type: "text", text: "fundo" };
    for (let i = 0; i < 5000; i += 1) node = { type: "bulletList", content: [node] };
    expect(() => sanitizeDoc({ type: "doc", content: [node] })).not.toThrow();
  });

  it("extrai texto puro", () => {
    expect(docToText({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "banana" }] },
        { type: "paragraph", content: [{ type: "text", text: "aveia" }] },
      ],
    })).toBe("banana · aveia");
    expect(bodyToText("postit", "lembrar")).toBe("lembrar");
    expect(bodyToText("note", "não é json")).toBe("");
  });

  it("corta a prévia", () => {
    expect(preview("a".repeat(10), 5)).toBe("aaaaa…");
    expect(preview("curto")).toBe("curto");
  });
});

describe("busca", () => {
  it("ignora acentos e maiúsculas", () => {
    expect(matchesQuery("Reunião de alinhamento", "reuniao")).toBe(true);
    expect(matchesQuery("Reunião de alinhamento", "ALINHAMENTO reu")).toBe(true);
    expect(matchesQuery("Bolo da vovó", "vovo bolo")).toBe(true);
    expect(matchesQuery("Bolo da vovó", "torta")).toBe(false);
  });
});
