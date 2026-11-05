import { TZDate } from "@date-fns/tz";

// Dias são strings YYYY-MM-DD no fuso do usuário. A aritmética usa UTC internamente
// só para evitar que o fuso do servidor desloque o dia.

export type Day = string;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] as const;
export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
export const WEEKDAYS_INITIAL = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
export const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;
export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

export function parseDay(day: Day): { y: number; m: number; d: number } {
  const match = DAY_RE.exec(day);
  if (!match) throw new Error(`Dia inválido: ${day}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function makeDay(y: number, m: number, d: number): Day {
  return `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
}

export function isValidDay(value: string): boolean {
  const match = DAY_RE.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (y < 1900 || y > 2200) return false;
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

export const isValidTime = (value: string) => TIME_RE.test(value);

const toUtc = (day: Day) => {
  const { y, m, d } = parseDay(day);
  return Date.UTC(y, m - 1, d);
};

const fromUtc = (ms: number): Day => {
  const date = new Date(ms);
  return makeDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

export const addDays = (day: Day, n: number): Day => fromUtc(toUtc(day) + n * 86_400_000);
export const diffDays = (a: Day, b: Day): number => Math.round((toUtc(a) - toUtc(b)) / 86_400_000);
export const dayOfWeek = (day: Day): number => new Date(toUtc(day)).getUTCDay();
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const startOfWeek = (day: Day): Day => addDays(day, -dayOfWeek(day));

export function isoWeek(day: Day): number {
  const date = new Date(toUtc(day));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

export type Month = string; // YYYY-MM

export const monthOf = (day: Day): Month => day.slice(0, 7);
export const isValidMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && isValidDay(`${value}-01`);

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Células de um mês alinhadas ao domingo, sempre em semanas completas. */
export function monthGrid(month: Month): { day: Day; inMonth: boolean }[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = makeDay(y, m, 1);
  const total = daysInMonth(y, m);
  const lead = dayOfWeek(first);
  const count = Math.ceil((lead + total) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(first, i - lead);
    return { day, inMonth: monthOf(day) === month };
  });
}

/* ---------- Fuso ---------- */

export function todayIn(timezone: string, now: Date = new Date()): Day {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}

export function timeIn(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return parts;
}

/** Instante UTC de uma hora local. Trata corretamente horário de verão. */
export function localToUtc(day: Day, time: string, timezone: string): Date {
  const { y, m, d } = parseDay(day);
  const [h, min] = time.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, h, min, 0, timezone).getTime());
}

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/* ---------- Texto ---------- */

export const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

export function formatLongDay(day: Day): string {
  const { m, d } = parseDay(day);
  return `${WEEKDAYS[dayOfWeek(day)]}, ${d} de ${MONTHS[m - 1]}`;
}

export function formatDayMonth(day: Day): string {
  const { m, d } = parseDay(day);
  return `${d} de ${MONTHS[m - 1]}`;
}

export function formatShortDay(day: Day): string {
  const { d } = parseDay(day);
  return `${WEEKDAYS_SHORT[dayOfWeek(day)]} ${d}`;
}

export function formatDayShortMonth(day: Day): string {
  const { y, m, d } = parseDay(day);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function formatMonthYear(month: Month): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const name = MONTHS[m - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

export function formatDuration(start: string, end: string): string {
  const minutes = minutesOf(end) - minutesOf(start);
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatSleep(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
}

export const formatNumber = (value: number) => value.toLocaleString("pt-BR");

/** Rótulo relativo curto para etiquetas de prazo: "hoje", "amanhã", "sáb 7". */
export function relativeDay(day: Day, today: Day): string {
  const diff = diffDays(day, today);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return formatShortDay(day);
}
