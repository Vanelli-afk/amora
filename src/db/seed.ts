// Conta de demonstração com os dados das pranchas do design, para comparar tela a tela.
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { addQuote, createBook, setProgress, updateBook } from "@/data/books";
import { saveDayEntry } from "@/data/day";
import { createEvent, type EventInput } from "@/data/events";
import { createHabit, setHabitDone } from "@/data/habits";
import { createNote } from "@/data/notes";
import { createTask, setTaskDone } from "@/data/tasks";
import { addDays } from "@/lib/dates";
import { closeDb, db, schema } from "./index";

if (process.env.NODE_ENV === "production") throw new Error("O seed não roda em produção.");

const EMAIL = "demo@amora.local";
const PASSWORD = process.env.SEED_PASSWORD ?? "amora-demo-2026";
const TODAY = "2026-11-04";
const d = (day: number) => `2026-11-${String(day).padStart(2, "0")}`;

const evt = (date: string, startTime: string | null, endTime: string | null, title: string, color: EventInput["color"], extra: Partial<EventInput> = {}): EventInput => ({
  title, date, startTime, endTime, color, location: null, notes: null, recurrence: null, reminderMinutes: null, ...extra,
});

const EVENTS: EventInput[] = [
  evt(d(3), "18:30", "19:30", "Yoga", "sage"),
  evt(d(4), "08:30", "09:00", "Ligar para a vovó", "rose"),
  evt(d(4), "09:30", "10:30", "Reunião de alinhamento", "sky", {
    location: "videochamada", recurrence: { freq: "weekly" }, reminderMinutes: 15,
    notes: "Pauta: metas do trimestre, bloqueios do time e quem apresenta o quê. Levar o rascunho do relatório.",
  }),
  evt(d(4), "10:30", "12:00", "Foco: escrever o relatório", "lav", { location: "sem notificações" }),
  evt(d(4), "12:30", "13:30", "Almoço com a Bia", "peach", { location: "Cantina da Praça" }),
  evt(d(4), "15:00", "16:00", "Revisão da semana", "sage"),
  evt(d(4), "21:30", "22:30", "Noite sem telas", "sand"),
  evt(d(5), "09:00", "09:45", "Dentista", "rose"),
  evt(d(5), "14:00", "15:30", "Foco profundo", "lav"),
  evt(d(6), "08:00", "10:00", "Feira", "sage"),
  evt(d(6), "19:00", "21:00", "Jantar com amigos", "peach"),
  evt(d(7), "10:00", "12:00", "Preparar a festa", "sand"),
  evt(d(7), "19:00", "22:00", "Aniversário da Bia", "peach"),
  evt(d(9), null, null, "Entrega do relatório", "sky"),
  evt(d(10), "18:00", "19:00", "Terapia", "lav"),
  evt(d(12), "20:00", "22:00", "Cinema", "rose"),
  evt(d(14), null, null, "Viagem à serra", "sand"),
  evt(d(16), "15:00", "16:00", "Revisão mensal", "sage"),
  evt(d(19), "19:30", "20:00", "Ligação com a Dani", "lav"),
  evt(d(21), "16:00", "20:00", "Casamento da Clara", "rose"),
  evt(d(24), "10:00", "11:00", "Reunião de equipe", "sky"),
  evt(d(26), "09:00", "11:00", "Foco profundo", "lav"),
  evt(d(28), "10:00", "11:00", "Mercado", "sand"),
  evt(d(30), "17:00", "18:00", "Planejar dezembro", "sage"),
];

const TASKS: { title: string; date: string | null; done?: boolean; highlight?: boolean; dueTime?: string }[] = [
  { title: "Enviar relatório semanal", date: TODAY, highlight: true, dueTime: "17:00" },
  { title: "Pagar a conta de luz", date: TODAY, done: true },
  { title: "Marcar dentista", date: TODAY, highlight: true },
  { title: "Comprar presente da Bia", date: TODAY },
  { title: "Regar as plantas", date: TODAY, done: true },
  { title: "Ler 20 páginas", date: TODAY },
  { title: "Preparar a pauta de amanhã", date: TODAY },
  { title: "Levar o carro para revisão", date: d(5) },
  { title: "Fazer a lista do mercado", date: d(6) },
  { title: "Embrulhar o presente", date: d(7), highlight: true },
  { title: "Ligar para o Teo", date: d(8) },
  { title: "Organizar as fotos do verão", date: null },
  { title: "Trocar o vaso da samambaia", date: null },
  { title: "Pesquisar cursos de cerâmica", date: null },
  { title: "Responder e-mails do trabalho", date: d(3), done: true },
  { title: "Comprar café", date: d(3), done: true },
  { title: "Agendar a revisão da semana", date: d(2), done: true },
];

const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const item = (text: string, checked = false, highlight = false) => ({
  type: "taskItem",
  attrs: { checked },
  content: [{ type: "paragraph", content: [{ type: "text", text, ...(highlight ? { marks: [{ type: "highlight" }] } : {}) }] }],
});

const RECIPE = JSON.stringify({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Ingredientes" }] },
    { type: "taskList", content: [
      item("3 ovos", true), item("1 laranja inteira, com a casca", false, true),
      item("2 xícaras de farinha"), item("1 xícara de açúcar"), item("½ xícara de óleo"),
    ] },
    { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Modo de fazer" }] },
    para("Bater no liquidificador os ovos, a laranja, o óleo e o açúcar. Misturar a farinha e o fermento. Assar a 180 °C por uns 40 minutos."),
  ],
});

async function main() {
  await db.delete(schema.user).where(eq(schema.user.email, EMAIL));

  const userId = randomUUID();
  await db.insert(schema.user).values({
    id: userId, name: "Marina Alves", email: EMAIL, emailVerified: true, termsAcceptedAt: new Date(),
  });
  await db.insert(schema.account).values({
    id: randomUUID(), accountId: userId, providerId: "credential", userId, password: await hashPassword(PASSWORD),
  });
  await db.insert(schema.userSettings).values({ userId, booksGoal: 20, theme: "light" });

  for (const event of EVENTS) await createEvent(userId, event);

  for (const task of TASKS) {
    const created = await createTask(userId, { title: task.title, date: task.date, dueTime: task.dueTime ?? null, highlight: task.highlight ?? false });
    if (task.done) await setTaskDone(userId, created.id, true);
  }

  await saveDayEntry(userId, TODAY, {
    mood: 4, waterMl: 1250, steps: 6842, sleepMinutes: 440,
    gratitude: "o café quentinho da manhã e a conversa com a Bia no almoço.",
  });
  await saveDayEntry(userId, d(7), { sticker: "star" });
  await saveDayEntry(userId, d(14), { sticker: "rainbow" });
  await saveDayEntry(userId, d(28), { sticker: "moon" });

  const postit = (body: string, color: "y" | "p" | "m" | "b" | "l", date: string | null, tags: string[] = []) =>
    createNote(userId, { kind: "postit", color, date, title: null, body, tags });
  await postit("Ideia: caderno de receitas da vovó", "b", TODAY, ["Ideias"]);
  await postit("Bolo de laranja: lembrar de raspar a casca!", "m", TODAY, ["Receitas"]);
  await postit("Ligar pro Teo sobre o sábado", "p", TODAY);
  await postit("Comprar semente de manjericão e um vasinho novo", "y", TODAY, ["Listas"]);
  await postit("Respirar fundo antes da reunião", "m", d(1), ["Pensamentos"]);
  await postit("Livros para pedir de presente: Cartas para a Lua", "l", null, ["Listas"]);
  await postit("Pedir a receita certa pra vovó", "y", null, ["Receitas"]);
  await createNote(userId, { kind: "note", color: "paper", date: null, title: "Lista do mercado", body: JSON.stringify({ type: "doc", content: [para("banana · aveia · café · flores · pão · tomate · manjericão")] }), tags: ["Listas"] });
  await createNote(userId, { kind: "note", color: "paper", date: null, title: "Pensamentos de domingo", body: JSON.stringify({ type: "doc", content: [para("Quero um mês com menos pressa e mais caminhadas.")] }), tags: ["Pensamentos"] });
  await createNote(userId, { kind: "note", color: "paper", date: null, title: "Bolo de laranja da vovó", body: RECIPE, tags: ["Receitas", "Família"] });

  const reading = await createHabit(userId, "Ler 20 páginas");
  for (let i = 1; i <= 12; i += 1) await setHabitDone(userId, reading, addDays(TODAY, -i), true);
  const stretch = await createHabit(userId, "Alongar");
  for (let i = 0; i < 5; i += 1) await setHabitDone(userId, stretch, addDays(TODAY, -i), true);

  type Seed = { title: string; author: string; pages: number; shelf: "reading" | "next" | "finished"; style: number; page?: number; rating?: number };
  const BOOKS: Seed[] = [
    { title: "Onde o Rio Dorme", author: "Lia Marques", pages: 320, shelf: "reading", style: 1, page: 134 },
    { title: "Cartas para a Lua", author: "Teo Brandão", pages: 288, shelf: "reading", style: 2, page: 52 },
    { title: "O Jardim das Marés", author: "Ana Veloso", pages: 300, shelf: "reading", style: 3, page: 228 },
    { title: "Pequenas Tempestades", author: "Rui Castelo", pages: 256, shelf: "next", style: 4 },
    { title: "A Hora Azul", author: "Clara Nogueira", pages: 210, shelf: "next", style: 5 },
    { title: "Mapa dos Dias Leves", author: "Iara Dantas", pages: 176, shelf: "next", style: 6 },
    { title: "Casa de Cedro", author: "Hugo Salles", pages: 344, shelf: "next", style: 7 },
    { title: "Verão em Papel", author: "Bia Montenegro", pages: 240, shelf: "finished", style: 8, rating: 5 },
    { title: "O Último Farol", author: "Davi Ferraz", pages: 312, shelf: "finished", style: 9, rating: 4 },
    { title: "Notas de Outono", author: "Sofia Brandt", pages: 198, shelf: "finished", style: 10, rating: 4 },
  ];
  for (let i = 0; i < 9; i += 1) {
    BOOKS.push({ title: `Leitura do ano ${i + 1}`, author: "Autoria fictícia", pages: 200, shelf: "finished", style: (i % 10) + 1, rating: 4 });
  }

  let first: string | null = null;
  for (const book of BOOKS) {
    const id = await createBook(userId, { title: book.title, author: book.author, pages: book.pages, shelf: book.shelf }, TODAY);
    first ??= id;
    await db.update(schema.books).set({ coverStyle: book.style }).where(eq(schema.books.id, id));
    if (book.page) await setProgress(userId, id, book.page, addDays(TODAY, -1));
    if (book.rating) await updateBook(userId, id, { rating: book.rating }, TODAY);
  }

  if (first) {
    await updateBook(userId, first, {
      rating: 4,
      startedOn: "2026-10-12",
      review: "Uma leitura lenta e gostosa, daquelas para a noite. Gosto de como o rio vira personagem sem pedir licença.",
    }, TODAY);
    await addQuote(userId, first, "O rio só dorme para sonhar o mar.", 87);
    await addQuote(userId, first, "Algumas casas guardam a luz do verão dentro das paredes.", 112);
    await db.insert(schema.readingLogs).values({ bookId: first, userId, date: TODAY, pages: 12 })
      .onConflictDoNothing();
  }

  console.log(`Conta de demonstração pronta: ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
