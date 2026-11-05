import { describe, expect, it } from "vitest";
import { coverUrl, isAllowedCoverUrl } from "./book-search";

describe("capas de livros (proteção contra SSRF)", () => {
  it("monta a URL só com identificador válido", () => {
    expect(coverUrl("openlibrary", "12345")).toBe("https://covers.openlibrary.org/b/id/12345-L.jpg");
    expect(coverUrl("google", "abc_DEF-1")).toContain("id=abc_DEF-1");
  });

  it("recusa tentativas de injetar endereço", () => {
    expect(coverUrl("openlibrary", "http://169.254.169.254/")).toBeNull();
    expect(coverUrl("openlibrary", "../../etc/passwd")).toBeNull();
    expect(coverUrl("google", "x&url=http://interno")).toBeNull();
    expect(coverUrl("google", "a/b")).toBeNull();
  });

  it("só segue redirecionamentos para hosts permitidos", () => {
    expect(isAllowedCoverUrl("https://covers.openlibrary.org/b/id/1-L.jpg")).toBe(true);
    expect(isAllowedCoverUrl("https://ia800.us.archive.org/view/1.jpg")).toBe(true);
    expect(isAllowedCoverUrl("http://covers.openlibrary.org/x.jpg")).toBe(false);
    expect(isAllowedCoverUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedCoverUrl("https://localhost/admin")).toBe(false);
    expect(isAllowedCoverUrl("https://archive.org.mal.exemplo/x.jpg")).toBe(false);
    expect(isAllowedCoverUrl("https://covers.openlibrary.org@mal.exemplo/x.jpg")).toBe(false);
    expect(isAllowedCoverUrl("nada")).toBe(false);
  });
});
