import { describe, expect, it } from "vitest";
import { currentStreak, lastDays } from "./streak";

const TODAY = "2026-11-04";

describe("sequência de hábitos", () => {
  it("conta incluindo hoje quando já foi feito", () => {
    expect(currentStreak(new Set(["2026-11-04", "2026-11-03", "2026-11-02"]), TODAY)).toBe(3);
  });

  it("mantém a sequência se hoje ainda está pendente", () => {
    expect(currentStreak(new Set(["2026-11-03", "2026-11-02"]), TODAY)).toBe(2);
  });

  it("zera se ontem falhou", () => {
    expect(currentStreak(new Set(["2026-11-02", "2026-11-01"]), TODAY)).toBe(0);
    expect(currentStreak(new Set(), TODAY)).toBe(0);
  });

  it("para no primeiro buraco", () => {
    expect(currentStreak(new Set(["2026-11-04", "2026-11-02"]), TODAY)).toBe(1);
  });

  it("atravessa a virada do mês", () => {
    expect(currentStreak(new Set(["2026-11-01", "2026-10-31"]), "2026-11-02")).toBe(2);
  });

  it("lista os últimos 7 dias terminando hoje", () => {
    const days = lastDays(new Set(["2026-11-03"]), TODAY);
    expect(days).toHaveLength(7);
    expect(days[0]?.day).toBe("2026-10-29");
    expect(days[5]).toEqual({ day: "2026-11-03", done: true, isToday: false });
    expect(days[6]).toEqual({ day: TODAY, done: false, isToday: true });
  });
});
