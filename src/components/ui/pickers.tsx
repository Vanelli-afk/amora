"use client";

import type { ReactNode } from "react";
import { COLORS, type ColorId } from "@/lib/palette";

export function ColorPicker({ value, onChange }: { value: ColorId; onChange: (color: ColorId) => void }) {
  return (
    <div>
      <span className="lbl" style={{ marginBottom: 0 }}>Cor</span>
      <div className="row wrap" style={{ gap: 6, marginLeft: -4 }} role="radiogroup" aria-label="Cor do item">
        {COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            className={`sw c-${color.id}${value === color.id ? " on" : ""}`}
            role="radio"
            aria-checked={value === color.id}
            aria-label={`${color.label} · ${color.category}`}
            onClick={() => onChange(color.id)}
          >
            <i />
          </button>
        ))}
      </div>
    </div>
  );
}

export const NOTE_COLORS = [
  { id: "y", label: "Amarelo" },
  { id: "p", label: "Rosa" },
  { id: "m", label: "Verde" },
  { id: "b", label: "Azul" },
  { id: "l", label: "Lilás" },
] as const;

export type NoteColorId = (typeof NOTE_COLORS)[number]["id"] | "paper";

export function NoteColorPicker({ value, onChange, withPaper }: { value: NoteColorId; onChange: (color: NoteColorId) => void; withPaper?: boolean }) {
  const options: { id: NoteColorId; label: string }[] = [...NOTE_COLORS, ...(withPaper ? [{ id: "paper" as const, label: "Papel" }] : [])];
  return (
    <div className="note-colors" role="radiogroup" aria-label="Cor da nota">
      {options.map((color) => (
        <button
          key={color.id}
          type="button"
          className={`nc ${color.id}${value === color.id ? " on" : ""}`}
          role="radio"
          aria-checked={value === color.id}
          aria-label={color.label}
          onClick={() => onChange(color.id)}
        />
      ))}
    </div>
  );
}

export function ChipRadio<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly { id: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="row g8 wrap" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`chip${value === option.id ? " on" : ""}`}
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const REMINDER_OPTIONS = [
  { value: "", label: "Sem lembrete" },
  { value: "0", label: "Na hora" },
  { value: "5", label: "5 min antes" },
  { value: "15", label: "15 min antes" },
  { value: "30", label: "30 min antes" },
  { value: "60", label: "1 h antes" },
  { value: "1440", label: "1 dia antes" },
] as const;
