import { describe, expect, it } from "vitest";
import { isEmailAllowed } from "./allowed-emails";

describe("isEmailAllowed", () => {
  it("sem lista, não restringe: é o caso do desenvolvimento", () => {
    expect(isEmailAllowed("qualquer@exemplo.com", undefined)).toBe(true);
  });

  it("com *, libera todo mundo", () => {
    expect(isEmailAllowed("qualquer@exemplo.com", "*")).toBe(true);
  });

  it("só libera quem está na lista", () => {
    const list = "ana@exemplo.com,bia@exemplo.com";
    expect(isEmailAllowed("bia@exemplo.com", list)).toBe(true);
    expect(isEmailAllowed("carla@exemplo.com", list)).toBe(false);
  });

  it("ignora maiúsculas e espaços", () => {
    expect(isEmailAllowed("  Ana@Exemplo.COM ", " ANA@exemplo.com , bia@exemplo.com ")).toBe(true);
  });

  it("não aceita correspondência parcial", () => {
    expect(isEmailAllowed("ana@exemplo.com.br", "ana@exemplo.com")).toBe(false);
    expect(isEmailAllowed("xana@exemplo.com", "ana@exemplo.com")).toBe(false);
  });

  it("uma lista só com vírgulas não libera ninguém", () => {
    expect(isEmailAllowed("ana@exemplo.com", " , ")).toBe(false);
  });
});
