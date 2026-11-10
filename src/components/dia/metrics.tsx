"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { saveMetrics } from "@/actions/day";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { formatNumber, formatSleep } from "@/lib/dates";

const FACE = (mouth: ReactNode) => (
  <svg className="i l" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    {mouth}
  </svg>
);

const MOODS = [
  { value: 1, label: "Muito mal", icon: FACE(<path d="M8.5 16.500c1-1.500 2.100-2.200 3.500-2.200s2.500.7 3.500 2.200" />) },
  { value: 2, label: "Mal", icon: FACE(<path d="M9 15.800c.9-.7 1.900-1 3-1s2.100.3 3 1" />) },
  { value: 3, label: "Neutro", icon: FACE(<path d="M9 15.200h6" />) },
  { value: 4, label: "Bem", icon: FACE(<path d="M9 14.400c.9 1 1.900 1.500 3 1.500s2.100-.5 3-1.500" />) },
  { value: 5, label: "Ótimo", icon: FACE(<path d="M8 13.600c.8 2.400 2.200 3.500 4 3.500s3.200-1.100 4-3.500z" />) },
];

type Props = {
  date: string;
  mood: number | null;
  waterMl: number;
  waterGoal: number;
  waterStep: number;
  sleepGoal: number;
  steps: number | null;
  sleepMinutes: number | null;
  sticker: "star" | "rainbow" | "moon" | null;
  stepGoal: number;
};

const STICKERS = [
  { id: "star", label: "Estrela", art: <path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3z" fill="#F0B93A" /> },
  { id: "rainbow", label: "Arco-íris", art: <><path d="M2 19a10 10 0 0120 0" fill="none" stroke="#F2A09A" strokeWidth="2.600" strokeLinecap="round" /><path d="M6 19a6 6 0 0112 0" fill="none" stroke="#9CCBEA" strokeWidth="2.600" strokeLinecap="round" /></> },
  { id: "moon", label: "Lua", art: <path d="M19.500 14.500A8 8 0 019.500 4.500a8 8 0 1010 10z" fill="#E9C95F" /> },
] as const;

export function Metrics(props: Props) {
  const toast = useToast();
  const [mood, setMood] = useState(props.mood);
  const [water, setWater] = useState(props.waterMl);
  const [steps, setSteps] = useState(props.steps);
  const [sleep, setSleep] = useState(props.sleepMinutes);
  const [sticker, setSticker] = useState(props.sticker);
  const [editing, setEditing] = useState<"steps" | "sleep" | null>(null);
  const waterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function save(patch: Parameters<typeof saveMetrics>[0], undo: () => void) {
    const result = await saveMetrics(patch);
    if (!result.ok) {
      undo();
      toast(result.error, { tone: "error" });
    }
  }

  function chooseMood(value: number) {
    const before = mood;
    const next = mood === value ? null : value;
    setMood(next);
    void save({ date: props.date, mood: next }, () => setMood(before));
  }

  // Agrupa cliques seguidos em uma só gravação.
  function changeWater(delta: number) {
    const next = Math.min(MAX_WATER, Math.max(0, water + delta));
    setWater(next);
    if (waterTimer.current) clearTimeout(waterTimer.current);
    waterTimer.current = setTimeout(() => {
      void save({ date: props.date, waterMl: next }, () => setWater(props.waterMl));
    }, 400);
  }

  function chooseSticker(id: Props["sticker"]) {
    const before = sticker;
    const next = sticker === id ? null : id;
    setSticker(next);
    void save({ date: props.date, sticker: next }, () => setSticker(before));
  }

  function commitSteps(raw: string) {
    setEditing(null);
    const value = raw.trim() === "" ? null : Math.max(0, Math.min(300_000, Math.round(Number(raw))));
    if (value !== null && Number.isNaN(value)) return;
    const before = steps;
    setSteps(value);
    void save({ date: props.date, steps: value }, () => setSteps(before));
  }

  function commitSleep(raw: string) {
    setEditing(null);
    if (!raw) {
      const before = sleep;
      setSleep(null);
      void save({ date: props.date, sleepMinutes: null }, () => setSleep(before));
      return;
    }
    const [h, m] = raw.split(":").map(Number) as [number, number];
    const before = sleep;
    const value = h * 60 + m;
    setSleep(value);
    void save({ date: props.date, sleepMinutes: value }, () => setSleep(before));
  }

  const sleepAsTime = sleep === null ? "" : `${String(Math.floor(sleep / 60)).padStart(2, "0")}:${String(sleep % 60).padStart(2, "0")}`;

  return (
    <section className="row g12 wrap metrics" aria-label="Métricas rápidas" data-no-swipe>
      <div className="pill" style={{ padding: "0 8px" }} role="group" aria-label="Humor do dia">
        {MOODS.map((item) => (
          <button key={item.value} type="button" className={`mood${mood === item.value ? " on" : ""}`} aria-label={item.label} aria-pressed={mood === item.value} onClick={() => chooseMood(item.value)}>
            {item.icon}
          </button>
        ))}
      </div>

      <div className="pill" role="group" aria-label="Água do dia">
        <WaterGlass fraction={props.waterGoal > 0 ? water / props.waterGoal : 0} />
        <div>
          <small>Água · meta {formatNumber(props.waterGoal)} ml</small>
          <span key={water} className="val val-roll num">{formatNumber(water)} ml</span>
        </div>
        <button type="button" className="stp" aria-label={`Menos ${props.waterStep} ml de água`} onClick={() => changeWater(-props.waterStep)}><Icon name="minus" size="s" /></button>
        <button type="button" className="stp" aria-label={`Mais ${props.waterStep} ml de água`} onClick={() => changeWater(props.waterStep)}><Icon name="plus" size="s" /></button>
      </div>

      <div className="pill" style={{ paddingRight: editing === "steps" ? 10 : 0 }}>
        {editing === "steps" ? (
          <>
            <Icon name="steps" className="ic" />
            <div>
              <small><label htmlFor="passos">Passos</label></small>
              <AutoInput id="passos" type="number" min={0} max={300000} inputMode="numeric" defaultValue={steps ?? ""} onCommit={commitSteps} onCancel={() => setEditing(null)} />
            </div>
          </>
        ) : (
          <button type="button" className="pill-btn" onClick={() => setEditing("steps")}>
            <Icon name="steps" className="ic" />
            <div><small>Passos · meta {formatNumber(props.stepGoal)}</small><span className="val num">{steps === null ? "—" : formatNumber(steps)}</span><span className="sr"> Editar</span></div>
          </button>
        )}
      </div>

      <div className="pill" style={{ paddingRight: editing === "sleep" ? 10 : 0 }}>
        {editing === "sleep" ? (
          <>
            <Icon name="moon" className="ic" />
            <div>
              <small><label htmlFor="sono">Sono (horas:min)</label></small>
              <AutoInput id="sono" type="time" defaultValue={sleepAsTime} onCommit={commitSleep} onCancel={() => setEditing(null)} />
            </div>
          </>
        ) : (
          <button type="button" className="pill-btn" onClick={() => setEditing("sleep")}>
            <Icon name="moon" className="ic" />
            <div><small>Sono · meta {formatSleep(props.sleepGoal)}</small><span className="val">{sleep === null ? "—" : formatSleep(sleep)}</span><span className="sr"> Editar</span></div>
          </button>
        )}
      </div>

      <div className="pill" style={{ padding: "0 8px" }} role="group" aria-label="Adesivo do dia">
        {STICKERS.map((item) => (
          <button key={item.id} type="button" className={`mood stk-btn${sticker === item.id ? " on" : ""}`} aria-label={`Adesivo: ${item.label}`} aria-pressed={sticker === item.id} onClick={() => chooseSticker(item.id)}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{item.art}</svg>
          </button>
        ))}
      </div>
    </section>
  );
}

const MAX_WATER = 10_000;

/** Copo cuja água sobe conforme se bebe; passa da meta sem estourar o desenho. */
function WaterGlass({ fraction }: { fraction: number }) {
  const clipId = useId();
  const level = Math.min(1, Math.max(0, fraction));
  return (
    <svg className="i ic glass" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" data-full={level >= 1 || undefined}>
      <defs><clipPath id={clipId}><path d="M6.500 4.500h11l-1.300 13.600a2 2 0 01-2 1.900H9.800a2 2 0 01-2-1.900z" /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        <rect className="glass-water" x="4" y="4" width="16" height="17" style={{ transform: `translateY(${(1 - level) * 16}px)` }} />
      </g>
      <path d="M5.500 3.500h13l-1.500 14.800a2.500 2.500 0 01-2.500 2.200h-5a2.500 2.500 0 01-2.500-2.200z" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinejoin="round" />
    </svg>
  );
}

function AutoInput({ onCommit, onCancel, defaultValue, ...props }: {
  id: string; type: string; min?: number; max?: number; inputMode?: "numeric"; defaultValue: string | number;
  onCommit: (value: string) => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select?.(); }, []);
  return (
    <input
      ref={ref}
      className="inp pill-edit num"
      defaultValue={defaultValue}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      {...props}
    />
  );
}
