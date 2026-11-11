import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { UserError } from "@/lib/errors";
import { weekdaysMask } from "@/lib/streak";
import { createUser, prepareDb } from "@/test/db";
import { listOccurrences } from "./events";
import {
  createAppointment, createExpense, createMedicine, createPet, createRoutine, createVaccine, deleteMedicine, deletePet, deleteVaccine, expenseSummary,
  listCareForDay, listMedicines, listPetOccurrences, listVaccines, loadPetsOverview, markMedicineGiven, setRoutineDone, updateVaccine, type PetInput,
} from "./pets";

let alice: string;
let bob: string;

const pet = (name: string, over: Partial<PetInput> = {}): PetInput => ({
  name, species: "dog", color: "peach", breed: "SRD", birthDate: "2022-03-14", weightGrams: 12_400, neuteredOn: null,
  microchip: null, allergies: null, vet: null, notes: null, ...over,
});

beforeAll(async () => {
  await prepareDb();
  alice = await createUser("Alice");
  bob = await createUser("Bob");
});

describe("vacinas e remédios no calendário", () => {
  it("a próxima data vira um compromisso do pet e acompanha as edições", async () => {
    const mel = await createPet(alice, pet("Mel"));
    const id = await createVaccine(alice, mel, { name: "V10", doneOn: "2025-11-20", nextOn: "2026-11-20" });
    let agenda = await listPetOccurrences(alice, "2026-11-01", "2026-11-30", mel);
    expect(agenda.map((o) => [o.date, o.title, o.petId])).toEqual([["2026-11-20", "Vacina V10 · Mel", mel]]);

    await updateVaccine(alice, id, { name: "V10", doneOn: "2026-11-20", nextOn: "2027-11-20" });
    expect(await listPetOccurrences(alice, "2026-11-01", "2026-11-30", mel)).toHaveLength(0);
    agenda = await listPetOccurrences(alice, "2027-11-01", "2027-11-30", mel);
    expect(agenda).toHaveLength(1);

    await deleteVaccine(alice, id);
    expect(await listPetOccurrences(alice, "2027-11-01", "2027-11-30", mel)).toHaveLength(0);
    expect(await listVaccines(alice, mel)).toHaveLength(0);
  });

  it("o remédio calcula a próxima dose e avança ao ser dado", async () => {
    const tom = await createPet(alice, pet("Tom", { species: "cat" }));
    const id = await createMedicine(alice, tom, { name: "Antipulgas", intervalDays: 30, lastOn: "2026-10-13", nextOn: null });
    expect((await listMedicines(alice, tom))[0]?.nextOn).toBe("2026-11-12");
    await markMedicineGiven(alice, id, "2026-11-12");
    expect((await listMedicines(alice, tom))[0]).toMatchObject({ lastOn: "2026-11-12", nextOn: "2026-12-12" });
    await deleteMedicine(alice, id);
    expect(await listPetOccurrences(alice, "2026-12-01", "2026-12-31", tom)).toHaveLength(0);
  });
});

describe("compromissos", () => {
  it("usam a cor do pet e ficam no calendário geral", async () => {
    const pipoca = await createPet(alice, pet("Pipoca", { species: "rabbit", color: "lav" }));
    await createAppointment(alice, pipoca, { title: "Banho", date: "2026-12-05", startTime: "10:00", endTime: null, location: null, notes: null, reminderMinutes: 30, recurrence: null });
    const all = await listOccurrences(alice, "2026-12-05", "2026-12-05");
    expect(all[0]).toMatchObject({ title: "Banho", color: "lav", petId: pipoca });
    const reminders = await db.select().from(schema.reminders).where(and(eq(schema.reminders.userId, alice), eq(schema.reminders.source, "event")));
    expect(reminders.some((r) => r.date === "2026-12-05" && r.leadMinutes === 30)).toBe(true);
  });

  it("apagar o pet leva os compromissos junto", async () => {
    const rex = await createPet(alice, pet("Rex"));
    await createAppointment(alice, rex, { title: "Vet", date: "2026-12-20", startTime: null, endTime: null, location: null, notes: null, reminderMinutes: null, recurrence: null });
    expect(await deletePet(alice, rex)).toBe(true);
    expect((await listOccurrences(alice, "2026-12-20", "2026-12-20")).filter((o) => o.title === "Vet")).toHaveLength(0);
  });
});

describe("rotina", () => {
  it("lista só o que vale no dia e guarda o que foi feito", async () => {
    const luna = await createPet(alice, pet("Luna"));
    // 2026-11-10 é terça (3); a escova vale seg/qua/sex.
    const food = await createRoutine(alice, luna, { name: "Ração", icon: "bowl", times: ["19:00", "07:00"], weekdays: 127, active: true });
    await createRoutine(alice, luna, { name: "Escovar", icon: "paw", times: [], weekdays: weekdaysMask([1, 3, 5]), active: true });
    await createRoutine(alice, luna, { name: "Pausada", icon: "paw", times: ["08:00"], weekdays: 127, active: false });

    let care = (await listCareForDay(alice, "2026-11-10")).filter((c) => c.petId === luna);
    expect(care.map((c) => [c.name, c.time, c.done])).toEqual([["Ração", "07:00", false], ["Ração", "19:00", false]]);

    await setRoutineDone(alice, food, "2026-11-10", "07:00", true);
    await setRoutineDone(alice, food, "2026-11-10", "07:00", true);
    care = (await listCareForDay(alice, "2026-11-10")).filter((c) => c.petId === luna);
    expect(care.map((c) => c.done)).toEqual([true, false]);

    const wednesday = (await listCareForDay(alice, "2026-11-11")).filter((c) => c.petId === luna);
    expect(wednesday.map((c) => c.name)).toContain("Escovar");
    await setRoutineDone(alice, food, "2026-11-10", "07:00", false);
    expect((await listCareForDay(alice, "2026-11-10")).filter((c) => c.done)).toHaveLength(0);
  });
});

describe("gastos", () => {
  it("soma por categoria e por pet e compara com o mês anterior", async () => {
    const dog = await createPet(bob, pet("Bolt"));
    await createExpense(bob, dog, { category: "food", amountCents: 18_900, date: "2026-11-08", title: "Ração" });
    await createExpense(bob, dog, { category: "vet", amountCents: 18_000, date: "2026-11-03", title: "Retorno" });
    await createExpense(bob, dog, { category: "food", amountCents: 20_000, date: "2026-10-20", title: "Ração" });
    const summary = await expenseSummary(bob, "2026-11");
    expect(summary.totalCents).toBe(36_900);
    expect(summary.prevTotalCents).toBe(20_000);
    expect(summary.categories[0]).toEqual({ category: "food", totalCents: 18_900 });
    expect(summary.perPet.get(dog)).toBe(36_900);
  });
});

describe("visão geral", () => {
  it("alerta vacinas próximas sem duplicar o compromisso criado por elas", async () => {
    const mel = await createPet(bob, pet("Mel"));
    await createVaccine(bob, mel, { name: "V10", doneOn: "2025-11-20", nextOn: "2026-11-20" });
    await createVaccine(bob, mel, { name: "Raiva", doneOn: "2026-03-12", nextOn: "2027-03-12" });
    await createAppointment(bob, mel, { title: "Banho e tosa", date: "2026-11-12", startTime: "18:00", endTime: null, location: null, notes: null, reminderMinutes: null, recurrence: null });
    const overview = await loadPetsOverview(bob, "2026-11-10");
    expect(overview.alerts.map((a) => [a.kind, a.title])).toEqual([["compromisso", "Banho e tosa"], ["vacina", "Reforço: V10"]]);
    expect(overview.pendingVaccines).toHaveLength(1);
    expect(overview.upcoming.map((o) => o.title)).toContain("Vacina V10 · Mel");
  });
});

describe("isolamento", () => {
  it("não cria nada em pet de outra pessoa", async () => {
    const bobPet = (await loadPetsOverview(bob, "2026-11-10")).pets[0]?.id as string;
    await expect(createVaccine(alice, bobPet, { name: "X", doneOn: null, nextOn: null })).rejects.toBeInstanceOf(UserError);
    await expect(createExpense(alice, bobPet, { category: "food", amountCents: 100, date: "2026-11-01", title: "X" })).rejects.toBeInstanceOf(UserError);
    await expect(createRoutine(alice, bobPet, { name: "X", icon: "paw", times: [], weekdays: 127, active: true })).rejects.toBeInstanceOf(UserError);
    await expect(createAppointment(alice, bobPet, { title: "X", date: "2026-11-01", startTime: null, endTime: null, location: null, notes: null, reminderMinutes: null, recurrence: null })).rejects.toBeInstanceOf(UserError);
  });
});
