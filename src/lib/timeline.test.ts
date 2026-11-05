import { describe, expect, it } from "vitest";
import { buildTimeline } from "./timeline";

const designDay = [
  { id: "vovo", start: "08:30", end: "09:00" },
  { id: "reuniao", start: "09:30", end: "10:30" },
  { id: "foco", start: "10:30", end: "12:00" },
  { id: "almoco", start: "12:30", end: "13:30" },
  { id: "revisao", start: "15:00", end: "16:00" },
  { id: "telas", start: "21:30", end: "22:30" },
];

describe("linha do tempo do dia", () => {
  it("reproduz as posições da prancha Hoje", () => {
    const t = buildTimeline(designDay, "19:42");
    const item = (id: string) => t.items.find((i) => i.id === id);
    expect(item("vovo")).toMatchObject({ top: 30, height: 30, compact: true });
    expect(item("reuniao")).toMatchObject({ top: 90, height: 60, compact: false });
    expect(item("foco")).toMatchObject({ top: 150, height: 90 });
    expect(item("revisao")).toMatchObject({ top: 420, height: 60 });
    expect(item("telas")).toMatchObject({ top: 554, height: 60 });
    expect(t.hours.map((h) => h.top).slice(-3)).toEqual([524, 584, 644]);
    expect(t.height).toBe(656);
  });

  it("recolhe o bloco livre e mostra o agora dentro dele", () => {
    const t = buildTimeline(designDay, "19:42");
    expect(t.gaps).toEqual([{ top: 488, height: 32, fromHour: 16, toHour: 21, nowInside: true }]);
    expect(t.nowTop).toBeNull();
  });

  it("não recolhe intervalos menores que 3 horas", () => {
    const t = buildTimeline([{ id: "a", start: "08:00", end: "09:00" }, { id: "b", start: "11:00", end: "12:00" }]);
    expect(t.gaps.find((g) => g.fromHour === 9)).toBeUndefined();
  });

  it("mostra a linha do agora quando o horário não está recolhido", () => {
    expect(buildTimeline(designDay, "09:45").nowTop).toBe(105);
  });

  it("divide em colunas o que se sobrepõe", () => {
    const t = buildTimeline([
      { id: "a", start: "09:00", end: "10:00" },
      { id: "b", start: "09:30", end: "10:30" },
      { id: "c", start: "11:00", end: "12:00" },
    ]);
    const item = (id: string) => t.items.find((i) => i.id === id);
    expect(item("a")).toMatchObject({ column: 0, columns: 2 });
    expect(item("b")).toMatchObject({ column: 1, columns: 2 });
    expect(item("c")).toMatchObject({ column: 0, columns: 1 });
  });

  it("não sobrepõe compromissos encostados", () => {
    const t = buildTimeline([{ id: "a", start: "09:00", end: "10:00" }, { id: "b", start: "10:00", end: "11:00" }]);
    expect(t.items.every((i) => i.columns === 1)).toBe(true);
  });

  it("amplia o dia para incluir compromissos cedo ou tarde", () => {
    const t = buildTimeline([{ id: "a", start: "06:15", end: "07:00" }, { id: "b", start: "23:30", end: "23:59" }]);
    expect(t.hours[0]?.hour).toBe(6);
    expect(t.hours.at(-1)?.hour).toBe(24);
  });

  it("dá duração padrão a quem não tem fim", () => {
    const t = buildTimeline([{ id: "a", start: "10:00" }]);
    expect(t.items[0]?.height).toBe(30);
  });

  it("recolhe o dia inteiro quando não há nada", () => {
    const t = buildTimeline([]);
    expect(t.items).toHaveLength(0);
    expect(t.gaps).toHaveLength(1);
    expect(t.gaps[0]).toMatchObject({ fromHour: 8, toHour: 23 });
  });
});
