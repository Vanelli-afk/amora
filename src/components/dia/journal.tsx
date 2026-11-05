"use client";

import { useState } from "react";
import { saveJournal } from "@/actions/day";
import { Icon } from "@/components/ui/icon";
import { useAutosave } from "@/components/ui/use-autosave";

function SavedHint({ status }: { status: string }) {
  const text = status === "saving" ? "salvando…" : status === "error" ? "não foi possível salvar" : "salvo";
  return <span className={`saved${status === "idle" ? "" : " on"}`} aria-live="polite">{text}</span>;
}

function JournalField({ id, field, date, label, placeholder, icon, initial }: {
  id: string; field: "gratitude" | "reflection"; date: string; label: string; placeholder?: string; icon?: boolean; initial: string;
}) {
  const [value, setValue] = useState(initial);
  const { schedule, flush, status } = useAutosave<string>(async (text) => {
    const result = await saveJournal({ date, [field]: text });
    return result.ok;
  });

  return (
    <div className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
      <div className="row jb">
        <div className="row g8">
          {icon ? <Icon name="moon" className="cr" /> : null}
          <label className="hand hand-label" htmlFor={id}>{label}</label>
        </div>
        <SavedHint status={status} />
      </div>
      <textarea
        id={id}
        className="inp ruled inp-hand"
        placeholder={placeholder}
        value={value}
        maxLength={20000}
        onChange={(e) => {
          setValue(e.target.value);
          schedule(e.target.value);
        }}
        onBlur={() => void flush()}
      />
    </div>
  );
}

export function Journal({ date, gratitude, reflection }: { date: string; gratitude: string; reflection: string }) {
  return (
    <>
      <JournalField id="grato" field="gratitude" date={date} label="Hoje agradeço por…" initial={gratitude} />
      <JournalField id="reflexao" field="reflection" date={date} label="Reflexão da noite" placeholder="Como foi o seu dia? O que você aprendeu?" icon initial={reflection} />
    </>
  );
}
