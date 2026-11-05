import { minutesOf } from "./dates";

export type TimelineInput = { id: string; start: string; end?: string | null };

export type TimelineHour = { hour: number; top: number };
export type TimelineGap = { top: number; height: number; fromHour: number; toHour: number; nowInside: boolean };
export type TimelineItem = { id: string; top: number; height: number; column: number; columns: number; compact: boolean };

export type Timeline = {
  height: number;
  hours: TimelineHour[];
  gaps: TimelineGap[];
  items: TimelineItem[];
  nowTop: number | null;
};

const HOUR_PX = 60;
const GAP_PX = 44;
const MIN_ITEM_PX = 30;
const DEFAULT_MINUTES = 30;
const MIN_COLLAPSE_HOURS = 3;
const DAY_START = 8;
const DAY_END = 23;

type Segment = { fromHour: number; toHour: number; top: number; collapsed: boolean };

/**
 * Coloca os compromissos na linha do tempo do dia. Blocos de 3 horas ou mais sem nada são
 * recolhidos em um "livre até as…", como no design, para a agenda caber sem rolagem longa.
 */
export function buildTimeline(events: TimelineInput[], now?: string | null): Timeline {
  const spans = events
    .map((e) => {
      const start = minutesOf(e.start);
      const rawEnd = e.end ? minutesOf(e.end) : start + DEFAULT_MINUTES;
      return { id: e.id, start, end: Math.max(rawEnd, start + 1) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const firstHour = Math.min(DAY_START, ...spans.map((s) => Math.floor(s.start / 60)));
  const lastHour = Math.min(24, Math.max(DAY_END, ...spans.map((s) => Math.ceil(s.end / 60))));

  const busy = (hour: number) => spans.some((s) => s.start < (hour + 1) * 60 && s.end > hour * 60);

  const segments: Segment[] = [];
  let top = 0;
  let hour = firstHour;
  while (hour < lastHour) {
    let run = hour;
    while (run < lastHour && !busy(run)) run += 1;
    if (run - hour >= MIN_COLLAPSE_HOURS) {
      segments.push({ fromHour: hour, toHour: run, top, collapsed: true });
      top += GAP_PX;
      hour = run;
    } else {
      segments.push({ fromHour: hour, toHour: hour + 1, top, collapsed: false });
      top += HOUR_PX;
      hour += 1;
    }
  }

  const yOf = (minutes: number): number => {
    for (const seg of segments) {
      const from = seg.fromHour * 60;
      const to = seg.toHour * 60;
      if (minutes >= from && minutes < to) {
        const ratio = (minutes - from) / (to - from);
        return seg.top + ratio * (seg.collapsed ? GAP_PX : HOUR_PX);
      }
    }
    return top;
  };

  const nowMinutes = now ? minutesOf(now) : null;
  const inGap = (seg: Segment) =>
    nowMinutes !== null && nowMinutes >= seg.fromHour * 60 && nowMinutes < seg.toHour * 60;

  const hours: TimelineHour[] = [];
  const gaps: TimelineGap[] = [];
  for (const seg of segments) {
    hours.push({ hour: seg.fromHour, top: seg.top });
    if (seg.collapsed) {
      gaps.push({
        top: seg.top + 8,
        height: GAP_PX - 12,
        fromHour: seg.fromHour,
        toHour: seg.toHour,
        nowInside: inGap(seg),
      });
    }
  }
  const lastTop = top;
  hours.push({ hour: lastHour, top: lastTop });

  const columns = assignColumns(spans);
  const items: TimelineItem[] = spans.map((s) => {
    const y = yOf(s.start);
    const height = Math.max(MIN_ITEM_PX, yOf(s.end) - y);
    const placement = columns.get(s.id) ?? { column: 0, columns: 1 };
    return { id: s.id, top: y, height, compact: height < 44, ...placement };
  });

  const nowInGap = segments.some((seg) => seg.collapsed && inGap(seg));
  const nowInRange = nowMinutes !== null && nowMinutes >= firstHour * 60 && nowMinutes < lastHour * 60;

  return {
    height: lastTop + 12,
    hours,
    gaps,
    items,
    nowTop: nowInRange && !nowInGap && nowMinutes !== null ? yOf(nowMinutes) : null,
  };
}

/** Compromissos que se sobrepõem dividem a largura em colunas. */
export function assignColumns(spans: { id: string; start: number; end: number }[]) {
  const result = new Map<string, { column: number; columns: number }>();
  let cluster: { id: string; column: number }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const member of cluster) result.set(member.id, { column: member.column, columns: columnEnds.length });
    cluster = [];
    columnEnds = [];
  };

  for (const span of spans) {
    if (span.start >= clusterEnd) flush();
    let column = columnEnds.findIndex((end) => end <= span.start);
    if (column < 0) column = columnEnds.length;
    columnEnds[column] = span.end;
    cluster.push({ id: span.id, column });
    clusterEnd = Math.max(clusterEnd, span.end);
  }
  flush();
  return result;
}
