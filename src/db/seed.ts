// Conta de demonstração com os dados das pranchas do design, para comparar tela a tela.
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { addQuote, createBook, setProgress, updateBook } from "@/data/books";
import { saveDayEntry } from "@/data/day";
import { createEvent, type EventInput } from "@/data/events";
import {
  createAccount, createBill, createRecurring, createTransaction, ensureFinanceDefaults, listAccounts, listCategories, setBudget,
} from "@/data/finance";
import { createHabit, setHabitDone } from "@/data/habits";
import {
  createAppointment, createExpense, createMedicine, createPet, createRoutine, createVaccine, createVisit,
} from "@/data/pets";
import { weekdaysMask } from "@/lib/streak";
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

  await seedFinance(userId);
  await seedPets(userId);

  console.log(`Conta de demonstração pronta: ${EMAIL} / ${PASSWORD}`);
}

/** Finanças com os números das pranchas: novembro de 2026, seis categorias com limite e as recorrentes. */
async function seedFinance(userId: string) {
  const DAY = "2026-11-10";
  await ensureFinanceDefaults(userId);
  const [main] = await listAccounts(userId);
  if (!main) return;
  const savings = await createAccount(userId, { name: "Poupança", kind: "savings", openingCents: 3_200_00 });
  const wallet = await createAccount(userId, { name: "Carteira", kind: "wallet", openingCents: 422_00 });
  const cats = await listCategories(userId);
  const cat = (name: string) => cats.find((c) => c.name === name)?.id ?? null;

  const tx = (date: string, type: "expense" | "income", cents: number, description: string, category: string, payMethod: "pix" | "debit" | "credit" | "boleto" | "transfer" | "cash" | "auto_debit", accountId = main.id) =>
    createTransaction(userId, { type, amountCents: cents, date, accountId, categoryId: cat(category), payMethod, description, note: null });
  await tx("2026-11-10", "expense", 212_40, "Mercado do bairro", "Supermercado", "credit");
  await tx("2026-11-10", "expense", 94_50, "Farmácia da esquina", "Farmácia", "pix");
  await tx("2026-11-09", "expense", 68_90, "Jantar com a Bia", "Restaurantes e delivery", "debit");
  await tx("2026-11-08", "expense", 180_00, "Combustível", "Combustível", "debit");
  await tx("2026-11-07", "income", 1_350_00, "Freela: identidade visual", "Trabalho extra", "pix");
  await tx("2026-11-07", "expense", 119_90, "Internet", "Contas da casa", "auto_debit");
  await tx("2026-11-05", "income", 6_500_00, "Salário", "Salário", "transfer");
  await tx("2026-11-05", "expense", 1_850_00, "Aluguel", "Aluguel", "transfer");
  await tx("2026-11-03", "expense", 389_00, "Plano de saúde", "Plano de saúde", "boleto");
  await tx("2026-11-02", "expense", 159_00, "Curso de inglês", "Curso", "credit");
  await tx("2026-11-02", "expense", 57_30, "Cinema", "Cinema", "cash", wallet);
  await tx("2026-11-01", "expense", 80_00, "Livraria", "Livraria", "debit");
  await tx("2026-10-05", "income", 6_500_00, "Salário", "Salário", "transfer");
  await tx("2026-10-05", "expense", 1_850_00, "Aluguel", "Aluguel", "transfer");
  await tx("2026-10-18", "expense", 2_100_00, "Compras do mês", "Supermercado", "credit");
  await tx("2026-09-05", "income", 6_500_00, "Salário", "Salário", "transfer");
  await tx("2026-09-12", "expense", 1_600_00, "Compras do mês", "Supermercado", "credit");
  await tx("2026-11-04", "income", 200_00, "Rendimento da poupança", "Trabalho extra", "transfer", savings);

  for (const [name, cents] of [["Moradia", 2_400_00], ["Saúde", 600_00], ["Transporte", 500_00], ["Educação", 200_00], ["Alimentação", 1_200_00], ["Lazer", 300_00]] as const) {
    const id = cat(name);
    if (id) await setBudget(userId, id, cents);
  }

  const rec = (name: string, cents: number, day: number, category: string | null, kind: "fixed" | "tuition" | "subscription", type: "expense" | "income" = "expense") =>
    createRecurring(userId, {
      type, kind, name, amountCents: cents, dayOfMonth: day, categoryId: category ? cat(category) : null, accountId: main.id,
      // Começa hoje: os dias que já passaram neste mês têm lançamento próprio e não viram conta atrasada.
      payMethod: type === "income" ? "transfer" : "auto_debit", startsOn: DAY, endsOn: null, active: true,
    }, DAY);
  await rec("Salário", 6_500_00, 5, "Salário", "fixed", "income");
  await rec("Aluguel", 1_850_00, 5, "Aluguel", "fixed");
  await rec("Plano de saúde", 389_00, 3, "Plano de saúde", "fixed");
  await rec("Internet", 119_90, 7, "Contas da casa", "fixed");
  await rec("Condomínio", 420_00, 14, "Contas da casa", "fixed");
  await rec("Seguro do carro", 214_00, 20, "Transporte", "fixed");
  await rec("Curso de inglês", 159_00, 2, "Curso", "tuition");
  await rec("Streaming de vídeo", 39_90, 12, "Assinaturas", "subscription");
  await rec("Streaming de música", 21_90, 18, "Assinaturas", "subscription");
  await rec("Armazenamento em nuvem", 14_90, 25, "Assinaturas", "subscription");

  await createBill(userId, { name: "IPTU · parcela 6 de 10", amountCents: 148_00, dueDate: "2026-11-08", categoryId: cat("Moradia") });
  await createBill(userId, { name: "Energia elétrica", amountCents: 187_45, dueDate: "2026-11-12", categoryId: cat("Contas da casa") });
  await createBill(userId, { name: "Água e esgoto", amountCents: 96_30, dueDate: "2026-11-17", categoryId: cat("Contas da casa") });
}

/** Mel, Tom e Pipoca, como nas pranchas de Pets. */
async function seedPets(userId: string) {
  const base = { weightGrams: null, neuteredOn: null, microchip: null, allergies: null, vet: null, notes: null, breed: null, birthDate: null };
  const mel = await createPet(userId, {
    ...base, name: "Mel", species: "dog", color: "peach", breed: "SRD caramelo", birthDate: "2022-03-14", weightGrams: 12_400, neuteredOn: "2023-06-10",
    microchip: "985 112 004 567 890", allergies: "Frango (alimentar)", vet: "Dra. Helena Costa",
    notes: "Tem medo de trovões e fogos. Adora petisco de maçã. Não pode comer ração com frango.",
  });
  const tom = await createPet(userId, { ...base, name: "Tom", species: "cat", color: "lav", breed: "Cinza", birthDate: "2024-08-02", weightGrams: 4_300 });
  const pipoca = await createPet(userId, { ...base, name: "Pipoca", species: "rabbit", color: "sage", breed: "Branca", birthDate: "2025-10-05", weightGrams: 1_900 });

  await createVaccine(userId, mel, { name: "Antirrábica", doneOn: "2026-03-12", nextOn: "2027-03-12" });
  await createVaccine(userId, mel, { name: "V10 (múltipla)", doneOn: "2025-11-20", nextOn: "2026-11-20" });
  await createVaccine(userId, mel, { name: "Gripe canina", doneOn: "2026-05-05", nextOn: "2027-05-05" });
  await createMedicine(userId, mel, { name: "Antipulgas", intervalDays: 30, lastOn: "2026-10-13", nextOn: null });
  await createMedicine(userId, mel, { name: "Vermífugo", intervalDays: 90, lastOn: "2026-09-03", nextOn: null });
  await createVisit(userId, mel, { date: "2026-09-15", title: "Check-up anual", note: "Peso 12,2 kg. Tudo certo." });
  await createVisit(userId, mel, { date: "2026-03-02", title: "Alergia na pele", note: "Orientada troca de ração." });

  const all = 127;
  await createRoutine(userId, mel, { name: "Alimentação", icon: "bowl", times: ["07:00", "19:00"], weekdays: all, active: true });
  await createRoutine(userId, mel, { name: "Passeios", icon: "paw", times: ["07:30", "18:00"], weekdays: all, active: true });
  await createRoutine(userId, mel, { name: "Escovar os pelos", icon: "star", times: [], weekdays: weekdaysMask([1, 3, 5]), active: false });
  await createRoutine(userId, tom, { name: "Trocar areia", icon: "bath", times: ["08:00"], weekdays: all, active: true });
  await createRoutine(userId, pipoca, { name: "Feno fresco", icon: "bowl", times: ["09:00"], weekdays: all, active: true });

  const none = { endTime: null, location: null, notes: null, reminderMinutes: null, recurrence: null };
  await createAppointment(userId, mel, { ...none, title: "Banho e tosa", date: "2026-11-12", startTime: "18:00", location: "Pet shop Cheiro Bom", reminderMinutes: 60 });
  await createAppointment(userId, tom, { ...none, title: "Retorno veterinário", date: "2026-11-23", startTime: "15:00", location: "Dra. Helena Costa", reminderMinutes: 1440 });

  await createExpense(userId, mel, { category: "food", amountCents: 189_00, date: "2026-11-08", title: "Ração premium 10 kg" });
  await createExpense(userId, mel, { category: "hygiene", amountCents: 75_00, date: "2026-11-05", title: "Banho e tosa" });
  await createExpense(userId, tom, { category: "vet", amountCents: 180_00, date: "2026-11-03", title: "Consulta de retorno" });
  await createExpense(userId, mel, { category: "medicine", amountCents: 64_90, date: "2026-11-02", title: "Antipulgas" });
  await createExpense(userId, pipoca, { category: "food", amountCents: 72_00, date: "2026-11-01", title: "Feno e ração de coelho" });
  await createExpense(userId, tom, { category: "accessories", amountCents: 48_00, date: "2026-11-01", title: "Coleira nova" });
  await createExpense(userId, mel, { category: "food", amountCents: 200_00, date: "2026-10-20", title: "Ração e petiscos" });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
