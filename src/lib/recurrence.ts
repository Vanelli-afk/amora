import { addDays, dayOfWeek, daysInMonth, type Day, parseDay } from "./dates";

export type Freq = "daily" | "weekly" | "monthly" | "yearly";
export type Rule = { freq: Freq; until?: string };

function matches(start: Day, rule: Rule, day: Day): boolean {
  if (day < start) return false;
  if (rule.until && day > rule.until) return false;
  const a = parseDay(start);
  const b = parseDay(day);
  switch (rule.freq) {
    case "daily":
      return true;
    case "weekly":
      return dayOfWeek(start) === dayOfWeek(day);
    case "monthly":
      // Um evento no dia 31 não acontece em meses mais curtos, em vez de pular de dia.
      return a.d === b.d;
    case "yearly":
      return a.m === b.m && a.d === b.d && a.d <= daysInMonth(b.y, b.m);
  }
}

/** Dias em que a série acontece dentro de [from, to], já sem as exceções. */
export function occurrences(start: Day, rule: Rule | null | undefined, from: Day, to: Day, skipped: ReadonlySet<Day> = new Set()): Day[] {
  if (!rule) return start >= from && start <= to && !skipped.has(start) ? [start] : [];
  const result: Day[] = [];
  let day = start > from ? start : from;
  while (day <= to) {
    if (matches(start, rule, day) && !skipped.has(day)) result.push(day);
    day = addDays(day, 1);
  }
  return result;
}

// Um evento anual em 29/02 pode levar 8 anos para repetir.
const MAX_LOOKAHEAD_DAYS = 366 * 9;

/** Próxima ocorrência em `after` ou depois dele. */
export function nextOccurrence(start: Day, rule: Rule | null | undefined, after: Day, skipped: ReadonlySet<Day> = new Set()): Day | null {
  if (!rule) return start >= after && !skipped.has(start) ? start : null;
  let day = start > after ? start : after;
  for (let i = 0; i < MAX_LOOKAHEAD_DAYS; i += 1) {
    if (rule.until && day > rule.until) return null;
    if (matches(start, rule, day) && !skipped.has(day)) return day;
    day = addDays(day, 1);
  }
  return null;
}

export function describeRule(start: Day, rule: Rule | null | undefined): string {
  if (!rule) return "Não repete";
  const weekdays = ["Todo domingo", "Toda segunda-feira", "Toda terça-feira", "Toda quarta-feira", "Toda quinta-feira", "Toda sexta-feira", "Todo sábado"];
  switch (rule.freq) {
    case "daily":
      return "Todos os dias";
    case "weekly":
      return weekdays[dayOfWeek(start)] ?? "Toda semana";
    case "monthly":
      return `Todo dia ${parseDay(start).d}`;
    case "yearly":
      return "Todo ano";
  }
}
