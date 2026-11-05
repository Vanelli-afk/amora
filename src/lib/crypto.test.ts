import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, decryptOpt, encrypt, encryptOpt } from "./crypto";

beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("criptografia por campo", () => {
  it("devolve o texto original, inclusive acentos e emoji", () => {
    const text = "Reflexão: café ☕ com a vovó";
    expect(decrypt(encrypt(text, "u1", "note.body"), "u1", "note.body")).toBe(text);
  });

  it("nunca repete o texto cifrado nem expõe o original", () => {
    const a = encrypt("segredo", "u1", "f");
    const b = encrypt("segredo", "u1", "f");
    expect(a).not.toBe(b);
    expect(a).not.toContain("segredo");
  });

  it("falha ao decifrar com outro usuário", () => {
    const payload = encrypt("segredo", "u1", "f");
    expect(() => decrypt(payload, "u2", "f")).toThrow();
  });

  it("falha ao decifrar em outro campo", () => {
    const payload = encrypt("segredo", "u1", "note.body");
    expect(() => decrypt(payload, "u1", "note.title")).toThrow();
  });

  it("detecta adulteração", () => {
    const payload = encrypt("segredo", "u1", "f");
    const tampered = `${payload.slice(0, -2)}${payload.endsWith("A") ? "BB" : "AA"}`;
    expect(() => decrypt(tampered, "u1", "f")).toThrow();
  });

  it("recusa formato desconhecido", () => {
    expect(() => decrypt("v9.a.b", "u1", "f")).toThrow();
    expect(() => decrypt("texto puro", "u1", "f")).toThrow();
  });

  it("mantém nulos e vazios como nulos", () => {
    expect(encryptOpt(null, "u1", "f")).toBeNull();
    expect(encryptOpt("", "u1", "f")).toBeNull();
    expect(decryptOpt(null, "u1", "f")).toBeNull();
  });
});
