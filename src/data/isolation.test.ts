import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { decrypt } from "@/lib/crypto";
import { UserError } from "@/lib/errors";
import { weekdaysMask } from "@/lib/streak";
import { createUser, prepareDb } from "@/test/db";
import { addQuote, createBook, deleteBook, deleteQuote, getBook, listBooks, listQuotes, setProgress, updateBook } from "./books";
import { getDayEntry, saveDayEntry } from "./day";
import { createEvent, deleteEvent, getEvent, listDayWithMonthMarks, listOccurrenceDays, listOccurrences, updateEvent, type EventInput } from "./events";
import { exportUserData } from "./export";
import {
  createAccount, createBill, createCategory, createRecurring, createTransaction, deleteBill, deleteCategory, deleteRecurring, deleteTransaction,
  ensureFinanceDefaults, getTransaction, listAccounts, listBills, listBudgets, listCategories, listRecurring, listTransactions, markBillsPaid,
  removeAccount, reopenBill, setBudget, updateAccount, updateBill, updateCategory, updateRecurring, updateTransaction,
} from "./finance";
import {
  createExpense, createMedicine, createPet, createRoutine, createVaccine, createVisit, deleteExpense, deleteMedicine, deletePet, deleteRoutine,
  deleteVaccine, deleteVisit, getPet, listCareForDay, listExpenses, listPets, markMedicineGiven, setPetAvatar, setRoutineDone, updateExpense,
  updateMedicine, updatePet, updateRoutine, updateVaccine,
} from "./pets";
import { readUserFile, removeFile, saveImage } from "./files";
import { archiveHabit, createHabit, listHabits, setHabitDone, updateHabit } from "./habits";
import { createNote, deleteNote, getNote, listNotes, setNotePinned, updateNote } from "./notes";
import { createStandaloneReminder, deleteStandaloneReminder, listStandaloneReminders } from "./reminders";
import { searchEverything } from "./search";
import { clearDone, createTask, deleteTask, getTask, listOpenTasks, reorderTasks, setTaskDone, updateTask } from "./tasks";

const DAY = "2026-11-04";
const event = (title: string): EventInput => ({
  title, date: DAY, startTime: "09:00", endTime: "10:00", color: "sky", location: "Sala secreta", notes: "Pauta secreta", recurrence: null, reminderMinutes: null,
});

let alice: string;
let bob: string;

beforeAll(async () => {
  await prepareDb();
  alice = await createUser("Alice");
  bob = await createUser("Bob");
});

describe("isolamento: Bob nunca lê, altera nem apaga nada de Alice", () => {
  it("compromissos", async () => {
    const id = await createEvent(alice, event("Terapia"));
    expect(await getEvent(bob, id)).toBeNull();
    expect(await listOccurrences(bob, DAY, DAY)).toEqual([]);
    expect(await updateEvent(bob, id, DAY, "all", event("Invadido"))).toBe(false);
    expect(await deleteEvent(bob, id, DAY, "all")).toBe(false);
    expect((await getEvent(alice, id))?.title).toBe("Terapia");
  });

  it("tarefas", async () => {
    const task = await createTask(alice, { title: "Segredo", date: DAY, dueTime: null, highlight: false });
    expect(await getTask(bob, task.id)).toBeNull();
    expect((await listOpenTasks(bob)).map((t) => t.id)).not.toContain(task.id);
    expect(await setTaskDone(bob, task.id, true)).toBe(false);
    expect(await updateTask(bob, task.id, { title: "Invadido", date: null, dueTime: null, highlight: false })).toBe(false);
    expect(await deleteTask(bob, task.id)).toBe(false);
    await reorderTasks(bob, [task.id], { id: task.id, date: null });
    await clearDone(bob);
    const after = await getTask(alice, task.id);
    expect(after).toMatchObject({ title: "Segredo", date: DAY, done: false });
  });

  it("notas", async () => {
    const id = await createNote(alice, { kind: "postit", color: "y", date: DAY, title: null, body: "íntimo", tags: ["privado"] });
    expect(await getNote(bob, id)).toBeNull();
    expect((await listNotes(bob)).map((n) => n.id)).not.toContain(id);
    expect(await updateNote(bob, id, { color: "p", title: null, body: "invadido", tags: [] })).toBe(false);
    expect(await setNotePinned(bob, id, true)).toBe(false);
    expect(await deleteNote(bob, id)).toBe(false);
    expect((await getNote(alice, id))?.body).toBe("íntimo");
  });

  it("registro do dia", async () => {
    await saveDayEntry(alice, DAY, { mood: 2, reflection: "dia difícil" });
    expect((await getDayEntry(bob, DAY)).reflection).toBe("");
    await saveDayEntry(bob, DAY, { mood: 5 });
    expect(await getDayEntry(alice, DAY)).toMatchObject({ mood: 2, reflection: "dia difícil" });
  });

  it("hábitos", async () => {
    const id = await createHabit(alice, "Meditar");
    expect(await setHabitDone(bob, id, DAY, true)).toBe(false);
    expect(await archiveHabit(bob, id)).toBe(false);
    expect(await listHabits(bob, DAY)).toEqual([]);
    expect((await listHabits(alice, DAY))[0]).toMatchObject({ title: "Meditar", streak: 0 });
  });

  it("editar hábito", async () => {
    const id = await createHabit(alice, "Correr");
    expect(await updateHabit(bob, id, { title: "invadido", weekdays: 1 })).toBe(false);
    expect((await listHabits(alice, DAY)).find((h) => h.id === id)).toMatchObject({ title: "Correr", weekdays: 127 });
  });

  it("livros e citações", async () => {
    const id = await createBook(alice, { title: "Diário íntimo", author: null, pages: 100, shelf: "reading" }, DAY);
    await addQuote(alice, id, "trecho", 3);
    const [quote] = await listQuotes(alice, id);
    expect(await getBook(bob, id)).toBeNull();
    expect((await listBooks(bob)).map((b) => b.id)).not.toContain(id);
    expect(await listQuotes(bob, id)).toEqual([]);
    expect(await updateBook(bob, id, { title: "Invadido" }, DAY)).toBe(false);
    expect(await setProgress(bob, id, 50, DAY)).toBe(false);
    expect(await addQuote(bob, id, "invadido", 1)).toBe(false);
    expect(await deleteQuote(bob, quote?.id as string)).toBe(false);
    expect(await deleteBook(bob, id)).toBe(false);
    expect(await getBook(alice, id)).toMatchObject({ title: "Diário íntimo", currentPage: 0 });
  });

  it("lembretes", async () => {
    await createStandaloneReminder(alice, { title: "Remédio", date: DAY, time: "08:00" });
    const [reminder] = await listStandaloneReminders(alice, DAY);
    expect(await listStandaloneReminders(bob, DAY)).toEqual([]);
    await deleteStandaloneReminder(bob, reminder?.id as string);
    expect(await listStandaloneReminders(alice, DAY)).toHaveLength(1);
  });

  it("busca", async () => {
    await createNote(alice, { kind: "postit", color: "y", date: null, title: null, body: "palavrasecreta", tags: [] });
    expect(await searchEverything(alice, "palavrasecreta")).toHaveLength(1);
    expect(await searchEverything(bob, "palavrasecreta")).toEqual([]);
  });

  it("exportação", async () => {
    const data = JSON.stringify(await exportUserData(bob));
    expect(data).not.toContain("Terapia");
    expect(data).not.toContain("dia difícil");
    expect(JSON.stringify(await exportUserData(alice))).toContain("Terapia");
  });
});

describe("criptografia no banco", () => {
  it("guarda só texto cifrado nos campos sensíveis", async () => {
    const eventId = await createEvent(alice, event("Consulta psiquiátrica"));
    const [row] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
    for (const value of [row?.titleEnc, row?.locationEnc, row?.notesEnc]) {
      expect(value).toMatch(/^v1\./);
    }
    expect(JSON.stringify(row)).not.toMatch(/Consulta|secreta/);

    const task = await createTask(alice, { title: "Comprar remédio", date: DAY, dueTime: null, highlight: false });
    const [taskRow] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
    expect(JSON.stringify(taskRow)).not.toContain("remédio");

    const noteId = await createNote(alice, { kind: "note", color: "paper", date: null, title: "Título íntimo", body: JSON.stringify({ type: "doc", content: [] }), tags: ["etiqueta-íntima"] });
    const [noteRow] = await db.select().from(schema.notes).where(eq(schema.notes.id, noteId));
    expect(JSON.stringify(noteRow)).not.toMatch(/íntim/);

    const [dayRow] = await db.select().from(schema.dayEntries)
      .where(and(eq(schema.dayEntries.userId, alice), eq(schema.dayEntries.date, DAY)));
    expect(JSON.stringify(dayRow)).not.toContain("difícil");
  });

  it("texto cifrado de A copiado para B não decifra", async () => {
    const id = await createEvent(alice, event("Só minha"));
    const [row] = await db.select().from(schema.events).where(eq(schema.events.id, id));
    expect(() => decrypt(row?.titleEnc as string, bob, "event.title")).toThrow();
    const stolen = await createEvent(bob, event("Minha"));
    await db.update(schema.events).set({ titleEnc: row?.titleEnc }).where(eq(schema.events.id, stolen));
    await expect(getEvent(bob, stolen)).rejects.toThrow();
  });
});

describe("arquivos enviados", () => {
  const validPng = () => sharp({ create: { width: 40, height: 60, channels: 3, background: "#BE4B33" } }).png().toBuffer();

  it("só o dono baixa", async () => {
    const id = await saveImage(alice, "cover", await validPng());
    expect((await readUserFile(alice, id))?.mime).toBe("image/webp");
    expect(await readUserFile(bob, id)).toBeNull();
  });

  it("outro usuário não apaga", async () => {
    const id = await saveImage(alice, "cover", await validPng());
    await removeFile(bob, id);
    expect(await readUserFile(alice, id)).not.toBeNull();
  });

  it("recusa HTML disfarçado de imagem", async () => {
    const fake = Buffer.from("<html><script>alert(1)</script></html>");
    await expect(saveImage(alice, "cover", fake)).rejects.toBeInstanceOf(UserError);
  });

  it("recusa SVG, que pode conter script", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="9" height="9"/></svg>');
    await expect(saveImage(alice, "cover", svg)).rejects.toBeInstanceOf(UserError);
  });

  it("recusa arquivo grande demais", async () => {
    await expect(saveImage(alice, "cover", Buffer.alloc(6 * 1024 * 1024))).rejects.toBeInstanceOf(UserError);
  });

  it("remove metadados como localização", async () => {
    const withExif = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#fff" } })
      .withExif({ IFD0: { Copyright: "dado-sensivel" } })
      .jpeg().toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const id = await saveImage(alice, "avatar", withExif);
    const stored = await readUserFile(alice, id);
    expect((await sharp(stored?.body).metadata()).exif).toBeUndefined();
  });

  it("o dono apaga o próprio arquivo", async () => {
    const id = await saveImage(alice, "cover", await validPng());
    await removeFile(alice, id);
    expect(await readUserFile(alice, id)).toBeNull();
  });

  it("exclusão de conta apaga, em cascata, as linhas e os arquivos", async () => {
    const carol = await createUser("Carol");
    await createEvent(carol, event("Da Carol"));
    await createNote(carol, { kind: "postit", color: "y", date: null, title: null, body: "x", tags: [] });
    await saveImage(carol, "avatar", await validPng());

    await db.delete(schema.user).where(eq(schema.user.id, carol));

    expect(await db.select().from(schema.events).where(eq(schema.events.userId, carol))).toEqual([]);
    expect(await db.select().from(schema.notes).where(eq(schema.notes.userId, carol))).toEqual([]);
    expect(await db.select().from(schema.files).where(eq(schema.files.userId, carol))).toEqual([]);
  });
});

describe("hábitos personalizados", () => {
  const WORKDAYS = weekdaysMask([1, 2, 3, 4, 5]);

  it("vale só nos dias escolhidos e a sequência atravessa a folga", async () => {
    const hana = await createUser("Hana");
    const id = await createHabit(hana, "Estudar", WORKDAYS);
    // quinta, sexta e a segunda seguinte: sábado e domingo são folga.
    for (const day of ["2026-11-05", "2026-11-06", "2026-11-09"]) await setHabitDone(hana, id, day, true);
    const [habit] = await listHabits(hana, "2026-11-09");
    expect(habit).toMatchObject({ weekdays: WORKDAYS, streak: 3, best: 3 });
    expect(habit?.week.find((d) => d.day === "2026-11-07")?.scheduled).toBe(false);
    expect(habit?.week.find((d) => d.day === "2026-11-09")?.scheduled).toBe(true);
  });

  it("sem escolher dias, o hábito vale todo dia", async () => {
    const hugo = await createUser("Hugo");
    await createHabit(hugo, "Alongar");
    const [habit] = await listHabits(hugo, "2026-11-09");
    expect(habit?.weekdays).toBe(127);
    expect(habit?.week.every((d) => d.scheduled)).toBe(true);
  });

  it("renomear e trocar os dias mantém o histórico", async () => {
    const ivo = await createUser("Ivo");
    const id = await createHabit(ivo, "Ler");
    await setHabitDone(ivo, id, "2026-11-08", true);
    expect(await updateHabit(ivo, id, { title: "Ler 20 páginas", weekdays: WORKDAYS })).toBe(true);
    const [habit] = await listHabits(ivo, "2026-11-09");
    expect(habit).toMatchObject({ title: "Ler 20 páginas", weekdays: WORKDAYS });
    expect(habit?.week.find((d) => d.day === "2026-11-08")?.done).toBe(true);
  });
});

describe("recorrência no banco", () => {
  it("editar só um dia separa do resto da série", async () => {
    const dave = await createUser("Dave");
    const id = await createEvent(dave, { ...event("Reunião"), recurrence: { freq: "weekly" } });
    expect(await updateEvent(dave, id, "2026-11-11", "this", { ...event("Reunião movida"), date: "2026-11-12" })).toBe(true);
    const list = await listOccurrences(dave, "2026-11-01", "2026-11-30");
    expect(list.map((e) => [e.date, e.title])).toEqual([
      ["2026-11-04", "Reunião"],
      ["2026-11-12", "Reunião movida"],
      ["2026-11-18", "Reunião"],
      ["2026-11-25", "Reunião"],
    ]);
  });

  it("excluir só um dia mantém os demais", async () => {
    const erin = await createUser("Erin");
    const id = await createEvent(erin, { ...event("Yoga"), recurrence: { freq: "weekly" } });
    await deleteEvent(erin, id, "2026-11-11", "this");
    const list = await listOccurrences(erin, "2026-11-01", "2026-11-20");
    expect(list.map((e) => e.date)).toEqual(["2026-11-04", "2026-11-18"]);
  });

  it("o dia e os marcadores do mês saem de uma busca só, iguais às buscas separadas", async () => {
    const fran = await createUser("Fran");
    const series = await createEvent(fran, { ...event("Aula"), recurrence: { freq: "weekly" } });
    await createEvent(fran, { ...event("Dentista"), date: "2026-11-12" });
    await deleteEvent(fran, series, "2026-11-18", "this");

    for (const day of ["2026-11-04", "2026-11-12", "2026-11-18", "2026-11-25"]) {
      const { occurrences, marked } = await listDayWithMonthMarks(fran, day, "2026-11-01", "2026-11-30");
      expect(occurrences).toEqual(await listOccurrences(fran, day, day));
      expect(marked).toEqual(await listOccurrenceDays(fran, "2026-11-01", "2026-11-30"));
    }

    const gus = await createUser("Gus");
    const other = await listDayWithMonthMarks(gus, "2026-11-04", "2026-11-01", "2026-11-30");
    expect(other.occurrences).toEqual([]);
    expect(other.marked.size).toBe(0);
  });
});

describe("isolamento: finanças e pets", () => {
  it("Bob não lê, altera nem apaga as finanças de Alice", async () => {
    const owner = await createUser("Dona das contas");
    const intruder = await createUser("Intruso");
    await ensureFinanceDefaults(owner);
    await ensureFinanceDefaults(intruder);
    const [account] = await listAccounts(owner);
    const [myAccount] = await listAccounts(intruder);
    const category = (await listCategories(owner)).find((c) => c.name === "Moradia" && !c.parentId)?.id as string;
    const accountId = account?.id as string;
    const input = { type: "expense" as const, amountCents: 12_300, date: "2026-11-05", accountId, categoryId: category, payMethod: "pix" as const, description: "Aluguel secreto", note: "nota secreta" };

    const txId = await createTransaction(owner, input);
    const billId = await createBill(owner, { name: "Conta secreta", amountCents: 5_000, dueDate: "2026-11-20", categoryId: null });
    const recId = await createRecurring(owner, {
      type: "expense", kind: "fixed", name: "Fixa secreta", amountCents: 9_000, dayOfMonth: 5, categoryId: null, accountId, payMethod: "pix",
      startsOn: "2026-01-01", endsOn: null, active: true,
    }, "2026-11-10");
    await setBudget(owner, category, 100_000);

    expect(await getTransaction(intruder, txId)).toBeNull();
    expect((await listTransactions(intruder, {})).rows).toEqual([]);
    expect(await updateTransaction(intruder, txId, { ...input, accountId: myAccount?.id as string, categoryId: null, description: "Invadido" })).toBe(false);
    expect(await deleteTransaction(intruder, txId)).toBe(false);
    expect(await updateAccount(intruder, accountId, { name: "Invadida", kind: "wallet", openingCents: 1 })).toBe(false);
    expect(await removeAccount(intruder, accountId)).toBe(false);
    expect(await updateCategory(intruder, category, { name: "Invadida", color: "rose", icon: "star" })).toBe(false);
    expect(await deleteCategory(intruder, category)).toBe(false);
    await expect(setBudget(intruder, category, 1)).rejects.toBeInstanceOf(UserError);
    expect((await listBudgets(intruder)).size).toBe(0);
    expect(await updateRecurring(intruder, recId, {
      type: "expense", kind: "fixed", name: "Invadida", amountCents: 1, dayOfMonth: 1, categoryId: null, accountId: null, payMethod: "pix", startsOn: "2026-01-01", endsOn: null, active: true,
    }, "2026-11-10")).toBe(false);
    expect(await deleteRecurring(intruder, recId)).toBe(false);
    expect((await listRecurring(intruder)).length).toBe(0);
    expect(await updateBill(intruder, billId, { name: "Invadida", amountCents: 1, dueDate: "2026-11-21", categoryId: null })).toBe(false);
    expect(await deleteBill(intruder, billId)).toBe(false);
    expect(await markBillsPaid(intruder, [billId], "2026-11-10")).toBe(0);
    expect(await reopenBill(intruder, billId)).toBe(false);
    expect(await listBills(intruder, { paid: false })).toEqual([]);

    expect(await getTransaction(owner, txId)).toMatchObject({ description: "Aluguel secreto", note: "nota secreta", amountCents: 12_300 });
    expect((await listBills(owner, { paid: false })).map((b) => b.name)).toContain("Conta secreta");
    expect((await listBudgets(owner)).get(category)).toBe(100_000);

    const exported = JSON.stringify(await exportUserData(intruder));
    expect(exported).not.toContain("Aluguel secreto");
    expect(exported).not.toContain("Conta secreta");
  });

  it("Bob não lê, altera nem apaga os pets de Alice", async () => {
    const owner = await createUser("Tutora");
    const intruder = await createUser("Intruso 2");
    const petId = await createPet(owner, {
      name: "Mel", species: "dog", color: "peach", breed: "SRD secreta", birthDate: "2022-03-14", weightGrams: 12_000, neuteredOn: null,
      microchip: "chip-secreto", allergies: null, vet: null, notes: "nota do pet",
    });
    const vaccine = await createVaccine(owner, petId, { name: "V10 secreta", doneOn: null, nextOn: "2026-12-01" });
    const medicine = await createMedicine(owner, petId, { name: "Remédio secreto", intervalDays: 30, lastOn: "2026-11-01", nextOn: null });
    const visit = await createVisit(owner, petId, { date: "2026-10-01", title: "Consulta secreta", note: null });
    const routine = await createRoutine(owner, petId, { name: "Rotina secreta", icon: "paw", times: ["08:00"], weekdays: 127, active: true });
    const expense = await createExpense(owner, petId, { category: "food", amountCents: 9_900, date: "2026-11-02", title: "Gasto secreto" });

    expect(await getPet(intruder, petId)).toBeNull();
    expect(await listPets(intruder)).toEqual([]);
    const input = { name: "Invadido", species: "cat" as const, color: "rose" as const, breed: null, birthDate: null, weightGrams: null, neuteredOn: null, microchip: null, allergies: null, vet: null, notes: null };
    expect(await updatePet(intruder, petId, input)).toBe(false);
    expect(await setPetAvatar(intruder, petId, null)).toBe(false);
    expect(await updateVaccine(intruder, vaccine, { name: "X", doneOn: null, nextOn: null })).toBe(false);
    expect(await deleteVaccine(intruder, vaccine)).toBe(false);
    expect(await updateMedicine(intruder, medicine, { name: "X", intervalDays: null, lastOn: null, nextOn: null })).toBe(false);
    expect(await markMedicineGiven(intruder, medicine, "2026-11-10")).toBe(false);
    expect(await deleteMedicine(intruder, medicine)).toBe(false);
    expect(await deleteVisit(intruder, visit)).toBe(false);
    expect(await updateRoutine(intruder, routine, { name: "X", icon: "paw", times: [], weekdays: 127, active: true })).toBe(false);
    expect(await setRoutineDone(intruder, routine, "2026-11-10", "08:00", true)).toBe(false);
    expect(await deleteRoutine(intruder, routine)).toBe(false);
    await expect(updateExpense(intruder, expense, petId, { category: "other", amountCents: 1, date: "2026-11-02", title: "X" })).rejects.toBeInstanceOf(UserError);
    expect(await deleteExpense(intruder, expense)).toBe(false);
    expect(await deletePet(intruder, petId)).toBe(false);
    expect(await listExpenses(intruder)).toEqual([]);
    expect(await listCareForDay(intruder, "2026-11-10")).toEqual([]);

    expect(await getPet(owner, petId)).toMatchObject({ name: "Mel", microchip: "chip-secreto" });
    expect((await listCareForDay(owner, "2026-11-10")).map((c) => [c.name, c.done])).toEqual([["Rotina secreta", false]]);
    expect((await listExpenses(owner)).map((e) => e.title)).toEqual(["Gasto secreto"]);

    const exported = JSON.stringify(await exportUserData(intruder));
    expect(exported).not.toContain("chip-secreto");
    expect(exported).not.toContain("Gasto secreto");
    expect(JSON.stringify(await exportUserData(owner))).toContain("Remédio secreto");
  });

  it("exclusão de conta apaga, em cascata, finanças e pets", async () => {
    const dora = await createUser("Dora");
    await ensureFinanceDefaults(dora);
    const [account] = await listAccounts(dora);
    await createTransaction(dora, { type: "expense", amountCents: 100, date: "2026-11-05", accountId: account?.id as string, categoryId: null, payMethod: "pix", description: "x", note: null });
    await createBill(dora, { name: "b", amountCents: 100, dueDate: "2026-11-20", categoryId: null });
    const petId = await createPet(dora, { name: "Rex", species: "dog", color: "sky", breed: null, birthDate: null, weightGrams: null, neuteredOn: null, microchip: null, allergies: null, vet: null, notes: null });
    await createVaccine(dora, petId, { name: "V", doneOn: null, nextOn: "2026-12-01" });
    await createExpense(dora, petId, { category: "food", amountCents: 100, date: "2026-11-02", title: "x" });
    await createAccount(dora, { name: "Extra", kind: "wallet", openingCents: 0 });
    await createCategory(dora, { name: "Nova", color: "sky", icon: "star", type: "expense", parentId: null });

    await db.delete(schema.user).where(eq(schema.user.id, dora));

    for (const table of [schema.finAccounts, schema.finCategories, schema.finTransactions, schema.finBills, schema.pets, schema.petVaccines, schema.petExpenses, schema.events]) {
      expect(await db.select().from(table).where(eq(table.userId, dora))).toEqual([]);
    }
  });
});
