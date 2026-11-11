"use client";

import { useState } from "react";
import { LineChart, monthLabel } from "./charts";

type Point = { month: string; expenseCents: number };

/** Evolução das despesas; os 12 meses vêm prontos e o seletor só recorta. */
export function Evolution({ series }: { series: Point[] }) {
  const [range, setRange] = useState<3 | 6 | 12>(6);
  const points = series.slice(-range).map((p) => ({ label: monthLabel(p.month), value: p.expenseCents }));
  return (
    <div className="col g12">
      <div className="tabs" role="tablist" aria-label="Período" style={{ alignSelf: "flex-start" }}>
        {([3, 6, 12] as const).map((r) => (
          <button key={r} type="button" role="tab" aria-selected={range === r} className={`tab${range === r ? " on" : ""}`} onClick={() => setRange(r)}>{r}m</button>
        ))}
      </div>
      <LineChart points={points} label={`Despesas dos últimos ${range} meses`} />
    </div>
  );
}
