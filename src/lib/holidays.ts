import { addDays, type Day, makeDay, parseDay } from "./dates";

const FIXED: [number, number, string][] = [
  [1, 1, "Confraternização Universal"],
  [4, 21, "Tiradentes"],
  [5, 1, "Dia do Trabalho"],
  [9, 7, "Independência"],
  [10, 12, "Nossa Senhora Aparecida"],
  [11, 2, "Finados"],
  [11, 15, "Proclamação da República"],
  [11, 20, "Consciência Negra"],
  [12, 25, "Natal"],
];

/** Domingo de Páscoa pelo algoritmo anônimo gregoriano. */
export function easter(year: number): Day {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return makeDay(year, month, day);
}

const cache = new Map<number, Map<Day, string>>();

function holidaysOf(year: number): Map<Day, string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const map = new Map<Day, string>();
  for (const [m, d, name] of FIXED) map.set(makeDay(year, m, d), name);
  const pascoa = easter(year);
  map.set(addDays(pascoa, -47), "Carnaval");
  map.set(addDays(pascoa, -2), "Sexta-feira Santa");
  map.set(addDays(pascoa, 60), "Corpus Christi");
  cache.set(year, map);
  return map;
}

export function holidayOn(day: Day): string | null {
  return holidaysOf(parseDay(day).y).get(day) ?? null;
}
