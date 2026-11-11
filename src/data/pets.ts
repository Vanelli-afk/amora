import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, decryptOpt, encrypt, encryptOpt } from "@/lib/crypto";
import { addDays, isValidDay, type Day, type Month } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import type { ColorId } from "@/lib/palette";
import { ALERT_WINDOW_DAYS, type PetExpenseCategory, type Species } from "@/lib/pet-meta";
import { isScheduled } from "@/lib/streak";
import type { Rule } from "@/lib/recurrence";
import { createEvent, deleteEvent, listOccurrences, type EventOccurrence } from "./events";
import { removeFile } from "./files";

const { pets, petVaccines, petMedicines, petVisits, petRoutines, petRoutineLogs, petExpenses } = schema;

const monthEnd = (month: Month): Day => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
const prevMonth = (month: Month): Month => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

/* ---------- Pets ---------- */

export type Pet = {
  id: string; name: string; species: Species; color: ColorId; breed: string | null; birthDate: Day | null; weightGrams: number | null;
  neuteredOn: Day | null; microchip: string | null; allergies: string | null; vet: string | null; notes: string | null; avatarFileId: string | null;
};
export type PetInput = Omit<Pet, "id" | "avatarFileId">;

const toPet = (userId: string, row: typeof pets.$inferSelect): Pet => ({
  id: row.id, species: row.species, color: row.color, birthDate: row.birthDate, weightGrams: row.weightGrams, neuteredOn: row.neuteredOn,
  avatarFileId: row.avatarFileId,
  name: decrypt(row.nameEnc, userId, "pet.name"),
  breed: decryptOpt(row.breedEnc, userId, "pet.breed"),
  microchip: decryptOpt(row.microchipEnc, userId, "pet.microchip"),
  allergies: decryptOpt(row.allergiesEnc, userId, "pet.allergies"),
  vet: decryptOpt(row.vetEnc, userId, "pet.vet"),
  notes: decryptOpt(row.notesEnc, userId, "pet.notes"),
});

const petFields = (userId: string, input: PetInput) => ({
  species: input.species, color: input.color, birthDate: input.birthDate, weightGrams: input.weightGrams, neuteredOn: input.neuteredOn,
  nameEnc: encrypt(input.name, userId, "pet.name"),
  breedEnc: encryptOpt(input.breed, userId, "pet.breed"),
  microchipEnc: encryptOpt(input.microchip, userId, "pet.microchip"),
  allergiesEnc: encryptOpt(input.allergies, userId, "pet.allergies"),
  vetEnc: encryptOpt(input.vet, userId, "pet.vet"),
  notesEnc: encryptOpt(input.notes, userId, "pet.notes"),
});

export async function listPets(userId: string): Promise<Pet[]> {
  const rows = await db.select().from(pets).where(eq(pets.userId, userId)).orderBy(asc(pets.createdAt));
  return rows.map((r) => toPet(userId, r));
}

export async function getPet(userId: string, id: string): Promise<Pet | null> {
  const [row] = await db.select().from(pets).where(and(eq(pets.id, id), eq(pets.userId, userId)));
  return row ? toPet(userId, row) : null;
}

async function ownedPet(userId: string, id: string): Promise<Pet> {
  const pet = await getPet(userId, id);
  if (!pet) throw new UserError("Pet não encontrado.");
  return pet;
}

export async function createPet(userId: string, input: PetInput): Promise<string> {
  const [row] = await db.insert(pets).values({ userId, ...petFields(userId, input) }).returning({ id: pets.id });
  if (!row) throw new Error("Falha ao cadastrar o pet.");
  return row.id;
}

export async function updatePet(userId: string, id: string, input: PetInput): Promise<boolean> {
  const rows = await db.update(pets).set(petFields(userId, input)).where(and(eq(pets.id, id), eq(pets.userId, userId))).returning({ id: pets.id });
  if (!rows.length) return false;
  // A cor do pet também colore os compromissos dele no calendário.
  await db.update(schema.events).set({ color: input.color }).where(and(eq(schema.events.userId, userId), eq(schema.events.petId, id)));
  return true;
}

export async function setPetAvatar(userId: string, id: string, fileId: string | null): Promise<boolean> {
  const pet = await getPet(userId, id);
  if (!pet) return false;
  await db.update(pets).set({ avatarFileId: fileId }).where(and(eq(pets.id, id), eq(pets.userId, userId)));
  if (pet.avatarFileId) await removeFile(userId, pet.avatarFileId);
  return true;
}

/** Apaga o pet com tudo dele: saúde, rotina, gastos e compromissos (as chaves estrangeiras em cascata). */
export async function deletePet(userId: string, id: string): Promise<boolean> {
  const pet = await getPet(userId, id);
  if (!pet) return false;
  await db.delete(pets).where(and(eq(pets.id, id), eq(pets.userId, userId)));
  if (pet.avatarFileId) await removeFile(userId, pet.avatarFileId);
  return true;
}

/* ---------- Eventos ligados a vacinas e remédios ---------- */

/** Mantém um compromisso no calendário para a próxima data de um cuidado; sem data, remove. */
async function syncCareEvent(userId: string, pet: Pet, existing: string | null, title: string, day: Day | null): Promise<string | null> {
  if (existing) await deleteEvent(userId, existing, "", "all");
  if (!day) return null;
  return createEvent(userId, {
    title: `${title} · ${pet.name}`, date: day, startTime: "09:00", endTime: "09:30", color: pet.color,
    location: null, notes: null, recurrence: null, reminderMinutes: 0, petId: pet.id,
  });
}

/* ---------- Vacinas ---------- */

export type Vaccine = { id: string; petId: string; name: string; doneOn: Day | null; nextOn: Day | null };
export type VaccineInput = { name: string; doneOn: Day | null; nextOn: Day | null };

const toVaccine = (userId: string, r: typeof petVaccines.$inferSelect): Vaccine => ({
  id: r.id, petId: r.petId, doneOn: r.doneOn, nextOn: r.nextOn, name: decrypt(r.nameEnc, userId, "pet.vaccine.name"),
});

export async function listVaccines(userId: string, petId?: string): Promise<Vaccine[]> {
  const rows = await db.select().from(petVaccines)
    .where(and(eq(petVaccines.userId, userId), petId ? eq(petVaccines.petId, petId) : undefined))
    .orderBy(asc(petVaccines.nextOn), desc(petVaccines.doneOn));
  return rows.map((r) => toVaccine(userId, r));
}

export async function createVaccine(userId: string, petId: string, input: VaccineInput): Promise<string> {
  const pet = await ownedPet(userId, petId);
  const eventId = await syncCareEvent(userId, pet, null, `Vacina ${input.name}`, input.nextOn);
  const [row] = await db.insert(petVaccines).values({
    userId, petId, doneOn: input.doneOn, nextOn: input.nextOn, eventId, nameEnc: encrypt(input.name, userId, "pet.vaccine.name"),
  }).returning({ id: petVaccines.id });
  if (!row) throw new Error("Falha ao registrar a vacina.");
  return row.id;
}

export async function updateVaccine(userId: string, id: string, input: VaccineInput): Promise<boolean> {
  const [row] = await db.select().from(petVaccines).where(and(eq(petVaccines.id, id), eq(petVaccines.userId, userId)));
  if (!row) return false;
  const pet = await ownedPet(userId, row.petId);
  const eventId = await syncCareEvent(userId, pet, row.eventId, `Vacina ${input.name}`, input.nextOn);
  await db.update(petVaccines).set({ doneOn: input.doneOn, nextOn: input.nextOn, eventId, nameEnc: encrypt(input.name, userId, "pet.vaccine.name") })
    .where(and(eq(petVaccines.id, id), eq(petVaccines.userId, userId)));
  return true;
}

export async function deleteVaccine(userId: string, id: string): Promise<boolean> {
  const [row] = await db.select().from(petVaccines).where(and(eq(petVaccines.id, id), eq(petVaccines.userId, userId)));
  if (!row) return false;
  if (row.eventId) await deleteEvent(userId, row.eventId, "", "all");
  await db.delete(petVaccines).where(and(eq(petVaccines.id, id), eq(petVaccines.userId, userId)));
  return true;
}

/* ---------- Medicamentos ---------- */

export type Medicine = { id: string; petId: string; name: string; intervalDays: number | null; lastOn: Day | null; nextOn: Day | null };
export type MedicineInput = { name: string; intervalDays: number | null; lastOn: Day | null; nextOn: Day | null };

const toMedicine = (userId: string, r: typeof petMedicines.$inferSelect): Medicine => ({
  id: r.id, petId: r.petId, intervalDays: r.intervalDays, lastOn: r.lastOn, nextOn: r.nextOn, name: decrypt(r.nameEnc, userId, "pet.medicine.name"),
});

/** Sem data próxima informada, ela vem da última dose mais o intervalo. */
export const nextDose = (input: MedicineInput): Day | null =>
  input.nextOn ?? (input.lastOn && input.intervalDays ? addDays(input.lastOn, input.intervalDays) : null);

export async function listMedicines(userId: string, petId?: string): Promise<Medicine[]> {
  const rows = await db.select().from(petMedicines)
    .where(and(eq(petMedicines.userId, userId), petId ? eq(petMedicines.petId, petId) : undefined))
    .orderBy(asc(petMedicines.nextOn));
  return rows.map((r) => toMedicine(userId, r));
}

export async function createMedicine(userId: string, petId: string, input: MedicineInput): Promise<string> {
  const pet = await ownedPet(userId, petId);
  const nextOn = nextDose(input);
  const eventId = await syncCareEvent(userId, pet, null, input.name, nextOn);
  const [row] = await db.insert(petMedicines).values({
    userId, petId, intervalDays: input.intervalDays, lastOn: input.lastOn, nextOn, eventId, nameEnc: encrypt(input.name, userId, "pet.medicine.name"),
  }).returning({ id: petMedicines.id });
  if (!row) throw new Error("Falha ao registrar o medicamento.");
  return row.id;
}

export async function updateMedicine(userId: string, id: string, input: MedicineInput): Promise<boolean> {
  const [row] = await db.select().from(petMedicines).where(and(eq(petMedicines.id, id), eq(petMedicines.userId, userId)));
  if (!row) return false;
  const pet = await ownedPet(userId, row.petId);
  const nextOn = nextDose(input);
  const eventId = await syncCareEvent(userId, pet, row.eventId, input.name, nextOn);
  await db.update(petMedicines).set({ intervalDays: input.intervalDays, lastOn: input.lastOn, nextOn, eventId, nameEnc: encrypt(input.name, userId, "pet.medicine.name") })
    .where(and(eq(petMedicines.id, id), eq(petMedicines.userId, userId)));
  return true;
}

/** Deu o remédio hoje: registra a dose e empurra a próxima pelo intervalo. */
export async function markMedicineGiven(userId: string, id: string, day: Day): Promise<boolean> {
  const [row] = await db.select().from(petMedicines).where(and(eq(petMedicines.id, id), eq(petMedicines.userId, userId)));
  if (!row) return false;
  const medicine = toMedicine(userId, row);
  return updateMedicine(userId, id, { name: medicine.name, intervalDays: medicine.intervalDays, lastOn: day, nextOn: medicine.intervalDays ? addDays(day, medicine.intervalDays) : null });
}

export async function deleteMedicine(userId: string, id: string): Promise<boolean> {
  const [row] = await db.select().from(petMedicines).where(and(eq(petMedicines.id, id), eq(petMedicines.userId, userId)));
  if (!row) return false;
  if (row.eventId) await deleteEvent(userId, row.eventId, "", "all");
  await db.delete(petMedicines).where(and(eq(petMedicines.id, id), eq(petMedicines.userId, userId)));
  return true;
}

/* ---------- Consultas passadas ---------- */

export type Visit = { id: string; petId: string; date: Day; title: string; note: string | null };

export async function listVisits(userId: string, petId: string): Promise<Visit[]> {
  const rows = await db.select().from(petVisits).where(and(eq(petVisits.userId, userId), eq(petVisits.petId, petId))).orderBy(desc(petVisits.date)).limit(100);
  return rows.map((r) => ({ id: r.id, petId: r.petId, date: r.date, title: decrypt(r.titleEnc, userId, "pet.visit.title"), note: decryptOpt(r.noteEnc, userId, "pet.visit.note") }));
}

export async function createVisit(userId: string, petId: string, input: { date: Day; title: string; note: string | null }): Promise<string> {
  await ownedPet(userId, petId);
  const [row] = await db.insert(petVisits).values({
    userId, petId, date: input.date, titleEnc: encrypt(input.title, userId, "pet.visit.title"), noteEnc: encryptOpt(input.note, userId, "pet.visit.note"),
  }).returning({ id: petVisits.id });
  if (!row) throw new Error("Falha ao registrar a consulta.");
  return row.id;
}

export async function deleteVisit(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(petVisits).where(and(eq(petVisits.id, id), eq(petVisits.userId, userId))).returning({ id: petVisits.id });
  return rows.length > 0;
}

/* ---------- Rotina ---------- */

export type Routine = { id: string; petId: string; name: string; icon: string; times: string[]; weekdays: number; active: boolean };
export type RoutineInput = { name: string; icon: string; times: string[]; weekdays: number; active: boolean };

const toRoutine = (userId: string, r: typeof petRoutines.$inferSelect): Routine => ({
  id: r.id, petId: r.petId, icon: r.icon, times: r.times, weekdays: r.weekdays, active: r.active, name: decrypt(r.nameEnc, userId, "pet.routine.name"),
});

export async function listRoutines(userId: string, petId?: string): Promise<Routine[]> {
  const rows = await db.select().from(petRoutines)
    .where(and(eq(petRoutines.userId, userId), petId ? eq(petRoutines.petId, petId) : undefined)).orderBy(asc(petRoutines.createdAt));
  return rows.map((r) => toRoutine(userId, r));
}

export async function createRoutine(userId: string, petId: string, input: RoutineInput): Promise<string> {
  await ownedPet(userId, petId);
  const [row] = await db.insert(petRoutines).values({
    userId, petId, icon: input.icon, times: [...input.times].sort(), weekdays: input.weekdays, active: input.active,
    nameEnc: encrypt(input.name, userId, "pet.routine.name"),
  }).returning({ id: petRoutines.id });
  if (!row) throw new Error("Falha ao criar a rotina.");
  return row.id;
}

export async function updateRoutine(userId: string, id: string, input: RoutineInput): Promise<boolean> {
  const rows = await db.update(petRoutines).set({
    icon: input.icon, times: [...input.times].sort(), weekdays: input.weekdays, active: input.active, nameEnc: encrypt(input.name, userId, "pet.routine.name"),
  }).where(and(eq(petRoutines.id, id), eq(petRoutines.userId, userId))).returning({ id: petRoutines.id });
  return rows.length > 0;
}

export async function deleteRoutine(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(petRoutines).where(and(eq(petRoutines.id, id), eq(petRoutines.userId, userId))).returning({ id: petRoutines.id });
  return rows.length > 0;
}

export async function setRoutineDone(userId: string, routineId: string, day: Day, time: string, done: boolean): Promise<boolean> {
  const [routine] = await db.select({ id: petRoutines.id }).from(petRoutines).where(and(eq(petRoutines.id, routineId), eq(petRoutines.userId, userId)));
  if (!routine) return false;
  if (done) await db.insert(petRoutineLogs).values({ routineId, userId, date: day, time }).onConflictDoNothing();
  else await db.delete(petRoutineLogs).where(and(eq(petRoutineLogs.routineId, routineId), eq(petRoutineLogs.userId, userId), eq(petRoutineLogs.date, day), eq(petRoutineLogs.time, time)));
  return true;
}

export type CareItem = { key: string; routineId: string; petId: string; petName: string; petColor: ColorId; name: string; icon: string; time: string; done: boolean };

/** Cada horário de cada rotina ativa que vale hoje, com o que já foi feito. */
export async function listCareForDay(userId: string, day: Day): Promise<CareItem[]> {
  const [routines, petList, logs] = await Promise.all([
    listRoutines(userId),
    listPets(userId),
    db.select().from(petRoutineLogs).where(and(eq(petRoutineLogs.userId, userId), eq(petRoutineLogs.date, day))),
  ]);
  const petById = new Map(petList.map((p) => [p.id, p]));
  const done = new Set(logs.map((l) => `${l.routineId}|${l.time}`));
  return routines
    .filter((r) => r.active && isScheduled(r.weekdays, day) && petById.has(r.petId))
    .flatMap((r) => (r.times.length ? r.times : [""]).map((time) => {
      const pet = petById.get(r.petId) as Pet;
      return { key: `${r.id}|${time}`, routineId: r.id, petId: pet.id, petName: pet.name, petColor: pet.color, name: r.name, icon: r.icon, time, done: done.has(`${r.id}|${time}`) };
    }))
    .sort((a, b) => a.time.localeCompare(b.time) || a.petName.localeCompare(b.petName));
}

/* ---------- Gastos ---------- */

export type PetExpense = { id: string; petId: string; category: PetExpenseCategory; amountCents: number; date: Day; title: string };
export type PetExpenseInput = { category: PetExpenseCategory; amountCents: number; date: Day; title: string };

const toExpense = (userId: string, r: typeof petExpenses.$inferSelect): PetExpense => ({
  id: r.id, petId: r.petId, category: r.category, amountCents: r.amountCents, date: r.date, title: decrypt(r.titleEnc, userId, "pet.expense.title"),
});

export async function listExpenses(userId: string, opts: { from?: Day; to?: Day; petId?: string } = {}, limit = 200): Promise<PetExpense[]> {
  const rows = await db.select().from(petExpenses).where(and(
    eq(petExpenses.userId, userId),
    opts.petId ? eq(petExpenses.petId, opts.petId) : undefined,
    opts.from ? gte(petExpenses.date, opts.from) : undefined,
    opts.to ? lte(petExpenses.date, opts.to) : undefined,
  )).orderBy(desc(petExpenses.date), desc(petExpenses.createdAt)).limit(limit);
  return rows.map((r) => toExpense(userId, r));
}

export async function createExpense(userId: string, petId: string, input: PetExpenseInput): Promise<string> {
  await ownedPet(userId, petId);
  const [row] = await db.insert(petExpenses).values({
    userId, petId, category: input.category, amountCents: input.amountCents, date: input.date, titleEnc: encrypt(input.title, userId, "pet.expense.title"),
  }).returning({ id: petExpenses.id });
  if (!row) throw new Error("Falha ao registrar o gasto.");
  return row.id;
}

export async function updateExpense(userId: string, id: string, petId: string, input: PetExpenseInput): Promise<boolean> {
  await ownedPet(userId, petId);
  const rows = await db.update(petExpenses).set({
    petId, category: input.category, amountCents: input.amountCents, date: input.date, titleEnc: encrypt(input.title, userId, "pet.expense.title"),
  }).where(and(eq(petExpenses.id, id), eq(petExpenses.userId, userId))).returning({ id: petExpenses.id });
  return rows.length > 0;
}

export async function deleteExpense(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(petExpenses).where(and(eq(petExpenses.id, id), eq(petExpenses.userId, userId))).returning({ id: petExpenses.id });
  return rows.length > 0;
}

export async function expenseSummary(userId: string, month: Month) {
  const range = (m: Month) => and(eq(petExpenses.userId, userId), gte(petExpenses.date, `${m}-01`), lte(petExpenses.date, monthEnd(m)));
  const [byCategory, byPet, prev] = await Promise.all([
    db.select({ key: petExpenses.category, total: sql<number>`sum(${petExpenses.amountCents})::float8` }).from(petExpenses).where(range(month)).groupBy(petExpenses.category),
    db.select({ key: petExpenses.petId, total: sql<number>`sum(${petExpenses.amountCents})::float8` }).from(petExpenses).where(range(month)).groupBy(petExpenses.petId),
    db.select({ total: sql<number>`coalesce(sum(${petExpenses.amountCents}), 0)::float8` }).from(petExpenses).where(range(prevMonth(month))),
  ]);
  const categories = byCategory.map((r) => ({ category: r.key, totalCents: Number(r.total) })).sort((a, b) => b.totalCents - a.totalCents);
  return {
    totalCents: categories.reduce((s, c) => s + c.totalCents, 0),
    prevTotalCents: Number(prev[0]?.total ?? 0),
    categories,
    perPet: new Map(byPet.map((r) => [r.key, Number(r.total)])),
  };
}

/* ---------- Agenda ---------- */

export type PetOccurrence = EventOccurrence & { petId: string };

export async function listPetOccurrences(userId: string, from: Day, to: Day, petId?: string): Promise<PetOccurrence[]> {
  const all = await listOccurrences(userId, from, to);
  return all.filter((o): o is PetOccurrence => o.petId !== null && (!petId || o.petId === petId));
}

export type AppointmentInput = {
  title: string; date: Day; startTime: string | null; endTime: string | null; location: string | null; notes: string | null;
  reminderMinutes: number | null; recurrence: Rule | null;
};

export async function createAppointment(userId: string, petId: string, input: AppointmentInput): Promise<string> {
  const pet = await ownedPet(userId, petId);
  if (!isValidDay(input.date)) throw new UserError("Data inválida.");
  return createEvent(userId, { ...input, color: pet.color, reminderMinutes: input.startTime ? input.reminderMinutes : null, petId });
}

/* ---------- Visão geral ---------- */

export type Alert = { key: string; kind: "vacina" | "remédio" | "compromisso"; title: string; sub: string; petId: string; date: Day };

export async function loadPetsOverview(userId: string, today: Day) {
  const horizon = addDays(today, ALERT_WINDOW_DAYS);
  const [petList, vaccines, medicines, upcoming, care, summary] = await Promise.all([
    listPets(userId),
    listVaccines(userId),
    listMedicines(userId),
    listPetOccurrences(userId, today, addDays(today, 60)),
    listCareForDay(userId, today),
    expenseSummary(userId, today.slice(0, 7)),
  ]);
  const byId = new Map(petList.map((p) => [p.id, p]));
  // Os compromissos criados por vacinas e remédios já aparecem como alerta próprio.
  const linked = new Set(
    [...(await db.select({ id: petVaccines.eventId }).from(petVaccines).where(eq(petVaccines.userId, userId))),
      ...(await db.select({ id: petMedicines.eventId }).from(petMedicines).where(eq(petMedicines.userId, userId)))]
      .flatMap((r) => (r.id ? [r.id] : [])),
  );

  const alerts: Alert[] = [
    ...vaccines.filter((v) => v.nextOn && v.nextOn <= horizon && byId.has(v.petId)).map((v) => ({
      key: `v-${v.id}`, kind: "vacina" as const, title: `Reforço: ${v.name}`, sub: byId.get(v.petId)?.name ?? "", petId: v.petId, date: v.nextOn as Day,
    })),
    ...medicines.filter((m) => m.nextOn && m.nextOn <= horizon && byId.has(m.petId)).map((m) => ({
      key: `m-${m.id}`, kind: "remédio" as const, title: m.name, sub: byId.get(m.petId)?.name ?? "", petId: m.petId, date: m.nextOn as Day,
    })),
    ...upcoming.filter((o) => !linked.has(o.id) && o.date <= addDays(today, 7)).map((o) => ({
      key: `e-${o.id}-${o.date}`, kind: "compromisso" as const, title: o.title, sub: byId.get(o.petId)?.name ?? "", petId: o.petId, date: o.date,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    pets: petList, byId, alerts, upcoming: upcoming.slice(0, 6), appointmentsCount: upcoming.filter((o) => o.date <= addDays(today, 30)).length,
    pendingVaccines: vaccines.filter((v) => v.nextOn && v.nextOn <= horizon && byId.has(v.petId)),
    care, summary,
  };
}

export type PetsOverview = Awaited<ReturnType<typeof loadPetsOverview>>;

/** Tudo de Pets, decifrado, para a exportação de dados da conta. */
export async function exportPets(userId: string) {
  const [petList, vaccines, medicines, routines, expenses, visits] = await Promise.all([
    listPets(userId),
    listVaccines(userId),
    listMedicines(userId),
    listRoutines(userId),
    listExpenses(userId, {}, 100_000),
    db.select().from(petVisits).where(eq(petVisits.userId, userId)).orderBy(desc(petVisits.date)),
  ]);
  return petList.map((p) => ({
    nome: p.name, especie: p.species, raca: p.breed, nascimento: p.birthDate, pesoGramas: p.weightGrams, castracao: p.neuteredOn,
    microchip: p.microchip, alergias: p.allergies, veterinario: p.vet, observacoes: p.notes,
    vacinas: vaccines.filter((v) => v.petId === p.id).map((v) => ({ nome: v.name, aplicadaEm: v.doneOn, proxima: v.nextOn })),
    medicamentos: medicines.filter((m) => m.petId === p.id).map((m) => ({ nome: m.name, intervaloDias: m.intervalDays, ultima: m.lastOn, proxima: m.nextOn })),
    consultas: visits.filter((v) => v.petId === p.id).map((v) => ({ data: v.date, titulo: decrypt(v.titleEnc, userId, "pet.visit.title"), nota: decryptOpt(v.noteEnc, userId, "pet.visit.note") })),
    rotina: routines.filter((r) => r.petId === p.id).map((r) => ({ nome: r.name, horarios: r.times, diasDaSemana: r.weekdays, ativa: r.active })),
    gastos: expenses.filter((e) => e.petId === p.id).map((e) => ({ data: e.date, titulo: e.title, categoria: e.category, valorCentavos: e.amountCents })),
  }));
}
