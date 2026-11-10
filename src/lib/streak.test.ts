import { describe, expect, it } from "vitest";
import { ALL_WEEKDAYS, bestStreak, currentStreak, isScheduled, lastDays, weekdaysMask } from "./streak";

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

// 2026-11-09 é segunda-feira; 11-06 é sexta; 11-07 e 11-08 são sábado e domingo.
const days = (...list: string[]) => new Set(list);
const WORKDAYS = weekdaysMask([1, 2, 3, 4, 5]);

describe("sequência com dias da semana escolhidos", () => {
  it("sem escolher dias, é igual ao hábito diário", () => {
    expect(currentStreak(days("2026-11-09", "2026-11-08", "2026-11-07"), "2026-11-09", ALL_WEEKDAYS)).toBe(3);
    expect(currentStreak(days("2026-11-09", "2026-11-07"), "2026-11-09", ALL_WEEKDAYS)).toBe(1);
  });

  it("o fim de semana não quebra um hábito de dias úteis", () => {
    expect(currentStreak(days("2026-11-09", "2026-11-06", "2026-11-05"), "2026-11-09", WORKDAYS)).toBe(3);
  });

  it("faltar um dia que valia quebra", () => {
    expect(currentStreak(days("2026-11-09", "2026-11-05"), "2026-11-09", WORKDAYS)).toBe(1);
  });

  it("hoje pendente em dia que vale ainda não quebra", () => {
    expect(currentStreak(days("2026-11-06", "2026-11-05"), "2026-11-09", WORKDAYS)).toBe(2);
  });

  it("feito num dia de folga conta a mais, sem ser obrigatório", () => {
    expect(currentStreak(days("2026-11-09", "2026-11-08", "2026-11-06"), "2026-11-09", WORKDAYS)).toBe(3);
  });

  it("hoje é folga e não foi feito: a sequência segue", () => {
    expect(currentStreak(days("2026-11-06", "2026-11-05"), "2026-11-08", WORKDAYS)).toBe(2);
  });
});

describe("melhor sequência", () => {
  it("acha a maior, mesmo que não seja a atual", () => {
    const done = days("2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-08", "2026-11-09");
    expect(bestStreak(done, "2026-11-09")).toBe(4);
  });

  it("respeita os dias da semana", () => {
    expect(bestStreak(days("2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09"), "2026-11-09", WORKDAYS)).toBe(4);
    expect(bestStreak(days("2026-11-02", "2026-11-03", "2026-11-06", "2026-11-09"), "2026-11-09", WORKDAYS)).toBe(2);
  });

  it("sem registros é zero", () => {
    expect(bestStreak(days(), "2026-11-09")).toBe(0);
  });
});

describe("máscara de dias da semana", () => {
  it("junta os dias escolhidos, com o domingo no bit 0", () => {
    expect(weekdaysMask([0, 6])).toBe(0b1000001);
    expect(weekdaysMask([])).toBe(0);
    expect(ALL_WEEKDAYS).toBe(127);
  });

  it("diz se um dia vale para o hábito", () => {
    expect(isScheduled(WORKDAYS, "2026-11-09")).toBe(true);
    expect(isScheduled(WORKDAYS, "2026-11-07")).toBe(false);
    expect(isScheduled(ALL_WEEKDAYS, "2026-11-07")).toBe(true);
  });
});
