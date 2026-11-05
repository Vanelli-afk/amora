import { describe, expect, it } from "vitest";
import { describeRule, nextOccurrence, occurrences } from "./recurrence";

describe("recorrência", () => {
  it("evento único só aparece no próprio dia", () => {
    expect(occurrences("2026-11-04", null, "2026-11-01", "2026-11-30")).toEqual(["2026-11-04"]);
    expect(occurrences("2026-11-04", null, "2026-12-01", "2026-12-31")).toEqual([]);
  });

  it("semanal repete no mesmo dia da semana, inclusive na virada do ano", () => {
    expect(occurrences("2026-12-23", { freq: "weekly" }, "2026-12-20", "2027-01-10")).toEqual([
      "2026-12-23", "2026-12-30", "2027-01-06",
    ]);
  });

  it("diária respeita o fim da série", () => {
    expect(occurrences("2026-11-01", { freq: "daily", until: "2026-11-03" }, "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-01", "2026-11-02", "2026-11-03",
    ]);
  });

  it("nunca aparece antes do início", () => {
    expect(occurrences("2026-11-15", { freq: "daily" }, "2026-11-01", "2026-11-16")).toEqual(["2026-11-15", "2026-11-16"]);
  });

  it("mensal no dia 31 pula meses curtos", () => {
    expect(occurrences("2026-01-31", { freq: "monthly" }, "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-03-31"]);
  });

  it("anual em 29/02 só cai em anos bissextos", () => {
    expect(occurrences("2028-02-29", { freq: "yearly" }, "2028-01-01", "2033-01-01")).toEqual(["2028-02-29", "2032-02-29"]);
  });

  it("remove as exceções", () => {
    const skipped = new Set(["2026-11-11"]);
    expect(occurrences("2026-11-04", { freq: "weekly" }, "2026-11-01", "2026-11-20", skipped)).toEqual(["2026-11-04", "2026-11-18"]);
  });

  it("encontra a próxima ocorrência", () => {
    expect(nextOccurrence("2026-11-04", { freq: "weekly" }, "2026-11-05")).toBe("2026-11-11");
    expect(nextOccurrence("2026-11-04", null, "2026-11-05")).toBeNull();
    expect(nextOccurrence("2028-02-29", { freq: "yearly" }, "2028-03-01")).toBe("2032-02-29");
    expect(nextOccurrence("2026-11-04", { freq: "weekly", until: "2026-11-10" }, "2026-11-05")).toBeNull();
  });

  it("descreve a regra como na prancha de detalhe", () => {
    expect(describeRule("2026-11-04", { freq: "weekly" })).toBe("Toda quarta-feira");
    expect(describeRule("2026-11-04", null)).toBe("Não repete");
  });
});
