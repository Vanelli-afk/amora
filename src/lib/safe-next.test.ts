import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("redirecionamento depois do login", () => {
  it("mantém caminhos internos", () => {
    expect(safeNext("/tarefas?x=1#a")).toBe("/tarefas?x=1#a");
    expect(safeNext("/dia/2026-11-04")).toBe("/dia/2026-11-04");
  });

  it.each([
    "//mal.exemplo", "https://mal.exemplo", "javascript:alert(1)", "mal.exemplo",
    "/\t/mal.exemplo", "/\n/mal.exemplo", "/\\mal.exemplo", "/.//mal.exemplo", "/..//mal.exemplo",
    "/a/..//mal.exemplo", "/%2e//mal.exemplo",
  ])("recusa %j", (value) => {
    expect(safeNext(value)).toBe("/hoje");
  });

  it("usa o padrão sem valor", () => {
    expect(safeNext(null)).toBe("/hoje");
    expect(safeNext("")).toBe("/hoje");
  });
});
