import { MONTHS_SHORT } from "@/lib/dates";
import { formatBRL, formatCents } from "@/lib/money";

// Gráficos em SVG puro, desenhados no servidor: sem biblioteca, sem JavaScript no cliente.

const W = 640;
const H = 220;
const PAD = { l: 8, r: 8, t: 14, b: 26 };

export const monthLabel = (month: string) => MONTHS_SHORT[Number(month.slice(5, 7)) - 1] ?? month;

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= value) ?? 10;
  return step * pow;
}

export function LineChart({ points, label }: { points: { label: string; value: number }[]; label: string }) {
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = points.length ? `${path} L${x(points.length - 1).toFixed(1)} ${PAD.t + ih} L${x(0).toFixed(1)} ${PAD.t + ih} Z` : "";
  const peak = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? -1) ? i : best), 0);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 0.5, 1].map((f) => <line key={f} className="gl" x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih * f} y2={PAD.t + ih * f} />)}
      <path className="ar" d={area} />
      <path className="ln" d={path} />
      {points.map((p, i) => (
        <g key={p.label + i}>
          {i === peak || points.length <= 6 ? <circle className="pt" cx={x(i)} cy={y(p.value)} r={4.5} /> : null}
          <text x={x(i)} y={H - 6} textAnchor="middle">{p.label}</text>
        </g>
      ))}
      {points[peak] && points[peak].value > 0 ? (
        <text x={Math.min(Math.max(x(peak), 50), W - 50)} y={Math.max(y(points[peak].value) - 10, 10)} textAnchor="middle" style={{ fill: "var(--tx)" }}>{formatBRL(points[peak].value)}</text>
      ) : null}
    </svg>
  );
}

export function GroupedBars({ data, label }: { data: { label: string; income: number; expense: number }[]; label: string }) {
  const max = niceMax(Math.max(...data.flatMap((d) => [d.income, d.expense]), 0));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const slot = iw / Math.max(data.length, 1);
  const bw = Math.min(26, slot / 3);
  const h = (v: number) => (v / max) * ih;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 0.5, 1].map((f) => <line key={f} className="gl" x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih * f} y2={PAD.t + ih * f} />)}
      {data.map((d, i) => {
        const cx = PAD.l + slot * i + slot / 2;
        return (
          <g key={d.label + i}>
            <rect className="b-in" x={cx - bw - 1} y={PAD.t + ih - h(d.income)} width={bw} height={h(d.income)} rx={4} />
            <rect className="b-out" x={cx + 1} y={PAD.t + ih - h(d.expense)} width={bw} height={h(d.expense)} rx={4} />
            <text x={cx} y={H - 6} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export type Slice = { id: string; label: string; value: number; color: string };

export function Donut({ slices, centerLabel, label }: { slices: Slice[]; centerLabel: string; label: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 62;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 168 168" role="img" aria-label={label}>
        <circle cx={84} cy={84} r={R} fill="none" stroke="var(--line)" strokeWidth={22} />
        {total > 0 ? slices.map((s) => {
          const len = (s.value / total) * C;
          const circle = (
            <circle key={s.id} cx={84} cy={84} r={R} fill="none" stroke={s.color} strokeWidth={22}
              strokeDasharray={`${Math.max(len - 2, 0)} ${C - Math.max(len - 2, 0)}`} strokeDashoffset={-offset} transform="rotate(-90 84 84)" />
          );
          offset += len;
          return circle;
        }) : null}
        <text x={84} y={80} textAnchor="middle" style={{ fontSize: 11, fill: "var(--tx2)" }}>{centerLabel}</text>
        <text x={84} y={100} textAnchor="middle" style={{ fontSize: 15, fontWeight: 800, fill: "var(--tx)" }}>{formatCents(total)}</text>
      </svg>
      <ul>
        {slices.map((s) => (
          <li key={s.id} style={{ ["--lg" as string]: s.color }}>
            <i />
            <span>{s.label}</span>
            <span className="num">{total ? `${((s.value / total) * 100).toFixed(1).replace(".", ",")}%` : "0%"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
