import { addDays, type Day } from "./dates";

/** Dias seguidos até hoje. Se hoje ainda não foi feito, a sequência continua valendo até ontem. */
export function currentStreak(done: ReadonlySet<Day>, today: Day): number {
  let day = done.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (done.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

export function lastDays(done: ReadonlySet<Day>, today: Day, length = 7): { day: Day; done: boolean; isToday: boolean }[] {
  return Array.from({ length }, (_, i) => {
    const day = addDays(today, i - length + 1);
    return { day, done: done.has(day), isToday: day === today };
  });
}
