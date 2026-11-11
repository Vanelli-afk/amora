import { describe, expect, it } from "vitest";
import { careBadge, formatWeight, intervalLabel, parseWeightKg, petAge } from "./pet-meta";

describe("idade do pet", () => {
  it("conta meses completos", () => {
    expect(petAge("2022-03-14", "2026-11-10")).toBe("4 anos e 7 meses");
    expect(petAge("2022-03-14", "2026-11-14")).toBe("4 anos e 8 meses");
    expect(petAge("2025-10-10", "2026-11-10")).toBe("1 ano e 1 mês");
    expect(petAge("2026-08-10", "2026-11-10")).toBe("3 meses");
    expect(petAge("2026-11-01", "2026-11-10")).toBe("Recém-nascido");
  });

  it("sem data ou data futura, nada", () => {
    expect(petAge(null, "2026-11-10")).toBe("");
    expect(petAge("2027-01-01", "2026-11-10")).toBe("");
  });
});

describe("peso", () => {
  it("formata e lê em kg", () => {
    expect(formatWeight(12400)).toBe("12,4 kg");
    expect(formatWeight(null)).toBe("");
    expect(parseWeightKg("12,4")).toBe(12400);
    expect(parseWeightKg("4.25")).toBe(4250);
    expect(parseWeightKg("8")).toBe(8000);
    expect(parseWeightKg("0")).toBeNull();
    expect(parseWeightKg("abc")).toBeNull();
  });
});

describe("selo de cuidado", () => {
  const today = "2026-11-10";
  it("marca atrasado, perto e em dia", () => {
    expect(careBadge("2026-11-09", today)).toEqual({ label: "Atrasado", tone: "bad" });
    expect(careBadge("2026-11-10", today)).toEqual({ label: "Hoje", tone: "warn" });
    expect(careBadge("2026-11-20", today)).toEqual({ label: "Em 10 dias", tone: "warn" });
    expect(careBadge("2026-12-20", today)).toEqual({ label: "Em dia", tone: "ok" });
    expect(careBadge(null, today)).toEqual({ label: "Sem data", tone: "" });
  });
});

describe("intervalo", () => {
  it("dá nome aos comuns", () => {
    expect(intervalLabel(30)).toBe("Mensal");
    expect(intervalLabel(null)).toBe("Avulso");
    expect(intervalLabel(45)).toBe("A cada 45 dias");
  });
});
