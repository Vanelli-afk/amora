import { describe, expect, it } from "vitest";
import { billBadge, budgetState, dueInMonth } from "./finance-meta";

describe("estado do orçamento", () => {
  it("avisa a partir do limiar e estoura acima de 100%", () => {
    expect(budgetState(50_00, 100_00, 85)).toMatchObject({ pct: 50, tone: "ok", label: "Dentro do limite" });
    expect(budgetState(85_00, 100_00, 85)).toMatchObject({ pct: 85, tone: "warn" });
    expect(budgetState(100_00, 100_00, 85)).toMatchObject({ pct: 100, tone: "warn" });
    expect(budgetState(101_00, 100_00, 85)).toMatchObject({ tone: "bad", label: "Limite estourado" });
  });

  it("sem limite não avisa nada", () => {
    expect(budgetState(500_00, 0, 85)).toMatchObject({ pct: 0, tone: "ok" });
  });
});

describe("selo da conta a pagar", () => {
  const today = "2026-11-10";
  it("marca atrasadas, hoje e a contagem de dias", () => {
    expect(billBadge("2026-11-08", today, false)).toEqual({ label: "Atrasada", tone: "bad" });
    expect(billBadge("2026-11-10", today, false)).toEqual({ label: "Vence hoje", tone: "warn" });
    expect(billBadge("2026-11-11", today, false)).toEqual({ label: "Amanhã", tone: "warn" });
    expect(billBadge("2026-11-12", today, false)).toEqual({ label: "Em 2 dias", tone: "warn" });
    expect(billBadge("2026-11-14", today, false)).toEqual({ label: "Em 4 dias", tone: "info" });
    expect(billBadge("2026-11-17", today, false)).toEqual({ label: "Em 7 dias", tone: "" });
  });

  it("conta paga ganha o selo de paga", () => {
    expect(billBadge("2026-01-01", today, true)).toEqual({ label: "Paga", tone: "ok" });
  });
});

describe("vencimento num mês curto", () => {
  it("dia 31 cai no último dia do mês", () => {
    expect(dueInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(dueInMonth("2028-02", 30)).toBe("2028-02-29");
    expect(dueInMonth("2026-04", 31)).toBe("2026-04-30");
    expect(dueInMonth("2026-11", 5)).toBe("2026-11-05");
  });
});
