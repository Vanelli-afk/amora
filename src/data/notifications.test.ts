import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { createUser, prepareDb } from "@/test/db";
import { createEvent } from "./events";
import { cleanup, processDigests, processDueReminders } from "./notifications";
import type { PushPayload } from "./push";
import { createStandaloneReminder, reschedulePending } from "./reminders";
import { updateSettings } from "./settings";
import { createTask, setTaskDone } from "./tasks";

type Sent = { userId: string; payload: PushPayload };

function recorder() {
  const sent: Sent[] = [];
  return { sent, send: async (userId: string, payload: PushPayload) => { sent.push({ userId, payload }); } };
}

const future = "2099-01-01";

beforeAll(prepareDb);

const pending = (userId: string) => db.select().from(schema.reminders).where(eq(schema.reminders.userId, userId));

describe("lembretes", () => {
  it("só dispara na hora e nunca duas vezes, mesmo com dois workers ao mesmo tempo", async () => {
    const user = await createUser();
    await createStandaloneReminder(user, { title: "Tomar remédio", date: "2030-06-01", time: "12:00" });
    const { sent, send } = recorder();

    await processDueReminders(new Date("2030-06-01T14:59:00Z"), send);
    expect(sent.filter((s) => s.userId === user)).toHaveLength(0);

    const at = new Date("2030-06-01T15:00:00Z");
    await Promise.all([processDueReminders(at, send), processDueReminders(at, send), processDueReminders(at, send)]);
    const mine = sent.filter((s) => s.userId === user);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.payload).toMatchObject({ title: "Tomar remédio", url: "/dia/2030-06-01" });

    await processDueReminders(new Date("2030-06-01T16:00:00Z"), send);
    expect(sent.filter((s) => s.userId === user)).toHaveLength(1);
  });

  it("antecipa pelos minutos pedidos e, em série, agenda a próxima ocorrência", async () => {
    const user = await createUser();
    await createEvent(user, {
      title: "Reunião", date: future, startTime: "09:30", endTime: "10:30", color: "sky", location: null, notes: null,
      recurrence: { freq: "weekly" }, reminderMinutes: 15,
    });
    const [first] = await pending(user);
    expect(first).toMatchObject({ date: future, leadMinutes: 15 });
    expect(first?.fireAt.toISOString()).toBe("2099-01-01T12:15:00.000Z");

    const { sent, send } = recorder();
    await processDueReminders(new Date("2099-01-01T12:15:00Z"), send);
    expect(sent.find((s) => s.userId === user)?.payload.body).toBe("Em 15 min · 09:30");

    const open = (await pending(user)).filter((r) => !r.sentAt);
    expect(open).toHaveLength(1);
    expect(open[0]?.date).toBe("2099-01-08");
  });

  it("não avisa sobre tarefa já feita", async () => {
    const user = await createUser();
    const task = await createTask(user, { title: "Enviar", date: "2031-01-01", dueTime: "10:00", highlight: false, reminderMinutes: 0 });
    await setTaskDone(user, task.id, true);
    const { sent, send } = recorder();
    await processDueReminders(new Date("2031-01-01T13:00:00Z"), send);
    expect(sent.filter((s) => s.userId === user)).toHaveLength(0);
  });

  it("respeita a preferência de não receber avisos", async () => {
    const user = await createUser();
    await updateSettings(user, { notifyEvents: false });
    await createEvent(user, {
      title: "Silencioso", date: "2032-03-03", startTime: "09:00", endTime: null, color: "sky", location: null, notes: null, recurrence: null, reminderMinutes: 0,
    });
    const { sent, send } = recorder();
    await processDueReminders(new Date("2032-03-03T12:00:00Z"), send);
    expect(sent.filter((s) => s.userId === user)).toHaveLength(0);
  });

  it("recalcula o horário ao trocar de fuso", async () => {
    const user = await createUser();
    await createStandaloneReminder(user, { title: "Acordar", date: "2033-07-01", time: "08:00" });
    expect((await pending(user))[0]?.fireAt.toISOString()).toBe("2033-07-01T11:00:00.000Z");
    await updateSettings(user, { timezone: "Asia/Tokyo" });
    await reschedulePending(user, "Asia/Tokyo");
    expect((await pending(user))[0]?.fireAt.toISOString()).toBe("2033-06-30T23:00:00.000Z");
  });
});

describe("resumos", () => {
  it("envia o da manhã uma vez e agenda o de amanhã", async () => {
    const user = await createUser();
    await updateSettings(user, { notifyMorning: true, morningTime: "07:30" });
    const fire = new Date("2034-02-02T10:30:00Z");
    await db.update(schema.userSettings).set({ nextMorningAt: fire }).where(eq(schema.userSettings.userId, user));

    const { sent, send } = recorder();
    await Promise.all([processDigests(fire, send), processDigests(fire, send)]);
    const mine = sent.filter((s) => s.userId === user);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.payload.title).toBe("Bom dia! O seu dia:");

    const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, user));
    expect(row?.nextMorningAt?.toISOString()).toBe("2034-02-03T10:30:00.000Z");
  });
});

describe("limpeza", () => {
  it("apaga sessões vencidas", async () => {
    const user = await createUser();
    await db.insert(schema.session).values({ id: `s-${user}`, token: `t-${user}`, userId: user, expiresAt: new Date("2000-01-01") });
    await cleanup(new Date());
    expect(await db.select().from(schema.session).where(eq(schema.session.userId, user))).toEqual([]);
  });
});
