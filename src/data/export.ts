import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, decryptOpt } from "@/lib/crypto";
import { listBooks } from "./books";
import { exportFinance } from "./finance";
import { exportPets } from "./pets";
import { listNotes } from "./notes";

/** Tudo o que o usuário escreveu, decifrado, para a portabilidade prevista na LGPD. */
export async function exportUserData(userId: string) {
  const [user] = await db.select({
    name: schema.user.name, email: schema.user.email, createdAt: schema.user.createdAt,
  }).from(schema.user).where(eq(schema.user.id, userId));

  const [settings, days, events, tasks, habits, habitLogs, quotes, readingLogs, reminders] = await Promise.all([
    db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)),
    db.select().from(schema.dayEntries).where(eq(schema.dayEntries.userId, userId)),
    db.select().from(schema.events).where(eq(schema.events.userId, userId)),
    db.select().from(schema.tasks).where(eq(schema.tasks.userId, userId)),
    db.select().from(schema.habits).where(eq(schema.habits.userId, userId)),
    db.select().from(schema.habitLogs).where(eq(schema.habitLogs.userId, userId)),
    db.select().from(schema.bookQuotes).where(eq(schema.bookQuotes.userId, userId)),
    db.select().from(schema.readingLogs).where(eq(schema.readingLogs.userId, userId)),
    db.select().from(schema.reminders).where(eq(schema.reminders.userId, userId)),
  ]);

  const [notes, books] = await Promise.all([listNotes(userId, 100_000), listBooks(userId)]);
  const prefs = settings[0];

  return {
    exportadoEm: new Date().toISOString(),
    conta: user ?? null,
    preferencias: prefs ? {
      tema: prefs.theme, fuso: prefs.timezone, metaPassos: prefs.stepGoal, metaAguaMl: prefs.waterGoal, copoMl: prefs.waterStepMl, metaSonoMinutos: prefs.sleepGoalMinutes, metaPaginas: prefs.pagesGoal, metaLivros: prefs.booksGoal,
    } : null,
    dias: days.map((d) => ({
      data: d.date, humor: d.mood, aguaMl: d.waterMl, passos: d.steps, sonoMinutos: d.sleepMinutes, adesivo: d.sticker,
      gratidao: decryptOpt(d.gratitudeEnc, userId, "day.gratitude"),
      reflexao: decryptOpt(d.reflectionEnc, userId, "day.reflection"),
    })),
    compromissos: events.map((e) => ({
      data: e.date, inicio: e.startTime, fim: e.endTime, cor: e.color, repeticao: e.recurrence, lembreteMinutos: e.reminderMinutes,
      titulo: decrypt(e.titleEnc, userId, "event.title"),
      local: decryptOpt(e.locationEnc, userId, "event.location"),
      notas: decryptOpt(e.notesEnc, userId, "event.notes"),
    })),
    tarefas: tasks.map((t) => ({
      data: t.date, hora: t.dueTime, feita: t.done, destaque: t.highlight,
      titulo: decrypt(t.titleEnc, userId, "task.title"),
    })),
    notas: notes.map((n) => ({
      tipo: n.kind, cor: n.color, fixada: n.pinned, data: n.date, titulo: n.title, texto: n.text, etiquetas: n.tags, atualizadaEm: n.updatedAt,
    })),
    habitos: habits.map((h) => ({
      titulo: decrypt(h.titleEnc, userId, "habit.title"),
      diasDaSemana: h.weekdays,
      dias: habitLogs.filter((l) => l.habitId === h.id).map((l) => l.date),
    })),
    livros: books.map((b) => ({
      titulo: b.title, autor: b.author, paginas: b.pages, paginaAtual: b.currentPage, prateleira: b.shelf,
      inicio: b.startedOn, fim: b.finishedOn, nota: b.rating, resenha: b.review,
      citacoes: quotes.filter((q) => q.bookId === b.id).map((q) => ({ texto: decrypt(q.textEnc, userId, "book.quote"), pagina: q.page })),
      leitura: readingLogs.filter((l) => l.bookId === b.id).map((l) => ({ data: l.date, paginas: l.pages })),
    })),
    financas: await exportFinance(userId),
    pets: await exportPets(userId),
    lembretes: reminders.filter((r) => r.source === "standalone").map((r) => ({
      data: r.date, hora: r.time,
      titulo: r.titleEnc ? decrypt(r.titleEnc, userId, "reminder.title") : null,
    })),
  };
}
