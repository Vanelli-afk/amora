import { describe, expect, it } from "vitest";
import {
  addDays, addMonths, dayOfWeek, diffDays, formatDuration, formatLongDay, formatMonthYear, formatSleep,
  isValidDay, isValidMonth, isValidTime, isValidTimezone, isoWeek, localToUtc, monthGrid, relativeDay, startOfWeek,
  timeIn, todayIn,
} from "./dates";

describe("aritmética de dias", () => {
  it("atravessa virada de mês e de ano", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("calcula diferença e dia da semana", () => {
    expect(diffDays("2026-11-07", "2026-11-04")).toBe(3);
    expect(dayOfWeek("2026-11-04")).toBe(3);
    expect(startOfWeek("2026-11-04")).toBe("2026-11-01");
  });

  it("valida datas reais", () => {
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(isValidDay("abc")).toBe(false);
    expect(isValidDay("0001-01-01")).toBe(false);
    expect(isValidMonth("2026-11")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
  });

  it("valida horários", () => {
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:00")).toBe(false);
  });

  it("calcula a semana ISO do design", () => {
    expect(isoWeek("2026-11-04")).toBe(45);
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2026-01-01")).toBe(1);
  });

  it("soma meses e monta a grade em semanas completas", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    const grid = monthGrid("2026-11");
    expect(grid).toHaveLength(35);
    expect(grid[0]).toEqual({ day: "2026-11-01", inMonth: true });
    expect(grid[34]).toEqual({ day: "2026-12-05", inMonth: false });
  });
});

describe("fuso do usuário", () => {
  it("às 23h30 em São Paulo ainda é o dia local, embora em UTC já seja amanhã", () => {
    const instant = new Date("2026-11-05T02:30:00Z");
    expect(todayIn("America/Sao_Paulo", instant)).toBe("2026-11-04");
    expect(timeIn("America/Sao_Paulo", instant)).toBe("23:30");
    expect(todayIn("UTC", instant)).toBe("2026-11-05");
  });

  it("converte hora local em UTC", () => {
    expect(localToUtc("2026-11-04", "09:30", "America/Sao_Paulo").toISOString()).toBe("2026-11-04T12:30:00.000Z");
  });

  it("respeita o horário de verão", () => {
    expect(localToUtc("2026-07-01", "12:00", "America/New_York").toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(localToUtc("2026-12-01", "12:00", "America/New_York").toISOString()).toBe("2026-12-01T17:00:00.000Z");
  });

  it("recusa fuso inexistente", () => {
    expect(isValidTimezone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimezone("Lua/Crateras")).toBe(false);
  });
});

describe("textos em português", () => {
  it("formata como no design", () => {
    expect(formatLongDay("2026-11-04")).toBe("quarta-feira, 4 de novembro");
    expect(formatMonthYear("2026-11")).toBe("Novembro de 2026");
    expect(formatSleep(440)).toBe("7h 20min");
    expect(formatDuration("09:30", "10:30")).toBe("1 h");
    expect(formatDuration("10:30", "12:00")).toBe("1 h 30 min");
    expect(relativeDay("2026-11-07", "2026-11-04")).toBe("sáb 7");
    expect(relativeDay("2026-11-04", "2026-11-04")).toBe("hoje");
  });
});
