import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { decrypt } from "@/lib/crypto";
import { UserError } from "@/lib/errors";
import { createUser, prepareDb } from "@/test/db";
import { addQuote, createBook, deleteBook, deleteQuote, getBook, listBooks, listQuotes, setProgress, updateBook } from "./books";
import { getDayEntry, saveDayEntry } from "./day";
import { createEvent, deleteEvent, getEvent, listOccurrences, updateEvent, type EventInput } from "./events";
import { exportUserData } from "./export";
import { readUserFile, removeFile, saveImage } from "./files";
import { archiveHabit, createHabit, listHabits, setHabitDone } from "./habits";
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
});
