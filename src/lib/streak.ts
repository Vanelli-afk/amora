import { addDays, dayOfWeek, type Day } from "./dates";

/** Todos os dias da semana. Bit 0 é domingo, bit 6 é sábado. */
export const ALL_WEEKDAYS = 0b1111111;

/** Junta dias da semana (0 = domingo … 6 = sábado) numa máscara. */
export const weekdaysMask = (list: readonly number[]) => list.reduce((mask, weekday) => mask | (1 << weekday), 0);

/** O dia vale para o hábito? Fora dos dias escolhidos, não fazer não quebra a sequência. */
export const isScheduled = (weekdays: number, day: Day) => ((weekdays >> dayOfWeek(day)) & 1) === 1;

/**
 * Dias seguidos até hoje. Se hoje ainda não foi feito, a sequência continua valendo até ontem.
 * Com `weekdays`, só faltar num dia que valia quebra; fazer num dia de folga conta a mais.
 */
export function currentStreak(done: ReadonlySet<Day>, today: Day, weekdays: number = ALL_WEEKDAYS): number {
  // Máscara vazia nunca terminaria o laço: sem dia escolhido, vale todos.
  const mask = weekdays & ALL_WEEKDAYS || ALL_WEEKDAYS;
  let count = 0;
  let day = today;
  for (;;) {
    if (done.has(day)) count += 1;
    else if (day !== today && isScheduled(mask, day)) return count;
    day = addDays(day, -1);
  }
}

/** A maior sequência já feita, olhando os registros que existem. */
export function bestStreak(done: ReadonlySet<Day>, today: Day, weekdays: number = ALL_WEEKDAYS): number {
  const first = [...done].sort()[0];
  if (!first) return 0;
  const mask = weekdays & ALL_WEEKDAYS || ALL_WEEKDAYS;
  let best = 0;
  let run = 0;
  for (let day: Day = first; day <= today; day = addDays(day, 1)) {
    if (done.has(day)) {
      run += 1;
      best = Math.max(best, run);
    } else if (day !== today && isScheduled(mask, day)) {
      run = 0;
    }
  }
  return best;
}

export function lastDays(done: ReadonlySet<Day>, today: Day, length = 7): { day: Day; done: boolean; isToday: boolean }[] {
  return Array.from({ length }, (_, i) => {
    const day = addDays(today, i - length + 1);
    return { day, done: done.has(day), isToday: day === today };
  });
}
