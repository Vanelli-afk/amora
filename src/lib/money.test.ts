import { describe, expect, it } from "vitest";
import { formatBRL, formatCents, formatSigned, parseBRL } from "./money";

describe("formatação", () => {
  it("usa ponto de milhar e vírgula decimal", () => {
    expect(formatCents(428690)).toBe("4.286,90");
    expect(formatCents(5)).toBe("0,05");
    expect(formatCents(100000000)).toBe("1.000.000,00");
  });

  it("marca negativos e sinais", () => {
    expect(formatBRL(21240)).toBe("R$ 212,40");
    expect(formatBRL(-21240)).toBe("−R$ 212,40");
    expect(formatSigned(21240, "expense")).toBe("− R$ 212,40");
    expect(formatSigned(135000, "income")).toBe("+ R$ 1.350,00");
  });
});

describe("leitura do que foi digitado", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["R$ 12", 1200],
    ["12,5", 1250],
    ["12.5", 1250],
    ["12.50", 1250],
    ["1.234", 123400],
    ["1.234.567", 123456700],
    ["0,05", 5],
    ["  89,90 ", 8990],
  ])("%s → %i centavos", (input, cents) => {
    expect(parseBRL(input)).toBe(cents);
  });

  it.each(["", "abc", "-5", "1,2,3", "12,345", "1.23.4", "1,234.5", "99999999999999"])("recusa %j", (input) => {
    expect(parseBRL(input)).toBeNull();
  });
});
