"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveImage } from "@/data/files";
import {
  createAppointment, createExpense, createMedicine, createPet, createRoutine, createVaccine, createVisit, deleteExpense, deleteMedicine, deletePet,
  deleteRoutine, deleteVaccine, deleteVisit, listPets, markMedicineGiven, setPetAvatar, setRoutineDone, updateExpense, updateMedicine, updatePet,
  updateRoutine, updateVaccine,
} from "@/data/pets";
import { getSettings } from "@/data/settings";
import { defineAction, UserError } from "@/lib/action";
import { todayIn } from "@/lib/dates";
import { MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE } from "@/lib/upload-limit";
import { zColor, zDay, zId, zText, zTime } from "@/lib/validation";

const MAX_CENTS = 2_000_000_000;

const species = z.enum(["dog", "cat", "rabbit", "other"]);
const name = (message: string) => z.string().trim().min(1, message).max(120, "Nome longo demais.");

const petInput = z.object({
  name: name("Dê um nome ao pet."),
  species,
  color: zColor,
  breed: zText(120),
  birthDate: zDay.nullable(),
  weightGrams: z.number().int().min(1).max(250_000).nullable(),
  neuteredOn: zDay.nullable(),
  microchip: zText(60),
  allergies: zText(300),
  vet: zText(120),
  notes: zText(1000),
});

const vaccineInput = z.object({ name: name("Qual vacina?"), doneOn: zDay.nullable(), nextOn: zDay.nullable() });
const medicineInput = z.object({
  name: name("Qual medicamento?"),
  intervalDays: z.number().int().min(1, "Intervalo inválido.").max(3650, "Intervalo inválido.").nullable(),
  lastOn: zDay.nullable(),
  nextOn: zDay.nullable(),
});
const visitInput = z.object({ date: zDay, title: name("Dê um título à consulta."), note: zText(500) });
const routineInput = z.object({
  name: name("Dê um nome à tarefa."),
  icon: z.string().max(16),
  times: z.array(zTime).max(8, "Muitos horários."),
  weekdays: z.number().int().min(1, "Escolha pelo menos um dia.").max(127),
  active: z.boolean(),
});
const expenseInput = z.object({
  category: z.enum(["food", "vet", "hygiene", "medicine", "accessories", "other"]),
  amountCents: z.number().int().min(1, "Informe um valor maior que zero.").max(MAX_CENTS, "Valor alto demais."),
  date: zDay,
  title: name("Descreva o gasto."),
});
const appointmentInput = z.object({
  title: name("Dê um título ao compromisso."),
  date: zDay,
  startTime: zTime.nullable(),
  endTime: zTime.nullable(),
  location: zText(200),
  notes: zText(1000),
  reminderMinutes: z.number().int().min(0).max(10_080).nullable(),
  recurrence: z.object({ freq: z.enum(["daily", "weekly", "monthly", "yearly"]) }).nullable(),
});

const LIMIT = { limit: { max: 120, windowSeconds: 60 } };
const refresh = () => revalidatePath("/", "layout");
function missing(): never {
  throw new UserError("Não encontrado.");
}

/** Pets para os formulários que abrem sobre qualquer tela. */
export const petOptions = defineAction("pet.options", z.object({}), async (_, { userId }) => {
  return (await listPets(userId)).map((p) => ({ id: p.id, name: p.name, color: p.color }));
});

export const savePet = defineAction("pet.save", z.object({ id: zId.nullable(), input: petInput }), async ({ id, input }, { userId }) => {
  if (id) {
    if (!(await updatePet(userId, id, input))) missing();
    refresh();
    return id;
  }
  const created = await createPet(userId, input);
  refresh();
  return created;
}, LIMIT);

export const removePet = defineAction("pet.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deletePet(userId, id))) missing();
  refresh();
}, LIMIT);

export const changePetAvatar = defineAction("pet.avatar", z.instanceof(FormData), async (form, { userId }) => {
  const id = zId.parse(form.get("id"));
  const file = form.get("foto");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Escolha uma imagem.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UserError(UPLOAD_TOO_LARGE);
  const fileId = await saveImage(userId, "avatar", Buffer.from(await file.arrayBuffer()));
  if (!(await setPetAvatar(userId, id, fileId))) missing();
  refresh();
}, { limit: { max: 20, windowSeconds: 60 } });

export const clearPetAvatar = defineAction("pet.avatar.clear", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await setPetAvatar(userId, id, null))) missing();
  refresh();
}, LIMIT);

export const saveVaccine = defineAction("pet.vaccine.save", z.object({ id: zId.nullable(), petId: zId, input: vaccineInput }), async ({ id, petId, input }, { userId }) => {
  if (id) {
    if (!(await updateVaccine(userId, id, input))) missing();
  } else {
    await createVaccine(userId, petId, input);
  }
  refresh();
}, LIMIT);

export const removeVaccine = defineAction("pet.vaccine.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deleteVaccine(userId, id))) missing();
  refresh();
}, LIMIT);

export const saveMedicine = defineAction("pet.medicine.save", z.object({ id: zId.nullable(), petId: zId, input: medicineInput }), async ({ id, petId, input }, { userId }) => {
  if (id) {
    if (!(await updateMedicine(userId, id, input))) missing();
  } else {
    await createMedicine(userId, petId, input);
  }
  refresh();
}, LIMIT);

export const giveMedicine = defineAction("pet.medicine.give", z.object({ id: zId }), async ({ id }, { userId }) => {
  const today = todayIn((await getSettings(userId)).timezone);
  if (!(await markMedicineGiven(userId, id, today))) missing();
  refresh();
}, LIMIT);

export const removeMedicine = defineAction("pet.medicine.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deleteMedicine(userId, id))) missing();
  refresh();
}, LIMIT);

export const addVisit = defineAction("pet.visit.add", z.object({ petId: zId, input: visitInput }), async ({ petId, input }, { userId }) => {
  await createVisit(userId, petId, input);
  refresh();
}, LIMIT);

export const removeVisit = defineAction("pet.visit.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deleteVisit(userId, id))) missing();
  refresh();
}, LIMIT);

export const saveRoutine = defineAction("pet.routine.save", z.object({ id: zId.nullable(), petId: zId, input: routineInput }), async ({ id, petId, input }, { userId }) => {
  if (id) {
    if (!(await updateRoutine(userId, id, input))) missing();
  } else {
    await createRoutine(userId, petId, input);
  }
  refresh();
}, LIMIT);

export const removeRoutine = defineAction("pet.routine.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deleteRoutine(userId, id))) missing();
  refresh();
}, LIMIT);

export const toggleCare = defineAction("pet.care.toggle", z.object({ routineId: zId, day: zDay, time: z.union([zTime, z.literal("")]), done: z.boolean() }), async ({ routineId, day, time, done }, { userId }) => {
  if (!(await setRoutineDone(userId, routineId, day, time, done))) missing();
  refresh();
}, { limit: { max: 300, windowSeconds: 60 } });

export const saveExpense = defineAction("pet.expense.save", z.object({ id: zId.nullable(), petId: zId, input: expenseInput }), async ({ id, petId, input }, { userId }) => {
  if (id) {
    if (!(await updateExpense(userId, id, petId, input))) missing();
  } else {
    await createExpense(userId, petId, input);
  }
  refresh();
}, LIMIT);

export const removeExpense = defineAction("pet.expense.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deleteExpense(userId, id))) missing();
  refresh();
}, LIMIT);

export const addAppointment = defineAction("pet.appointment.add", z.object({ petId: zId, input: appointmentInput }), async ({ petId, input }, { userId }) => {
  await createAppointment(userId, petId, input);
  refresh();
}, LIMIT);
