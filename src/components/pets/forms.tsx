"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  addAppointment, addVisit, changePetAvatar, clearPetAvatar, giveMedicine, removeExpense, removeMedicine, removePet, removeRoutine, removeVaccine,
  removeVisit, saveExpense, saveMedicine, savePet, saveRoutine, saveVaccine, toggleCare,
} from "@/actions/pets";
import { FieldError } from "@/components/auth/fields";
import { ConfirmDelete, Footer, MoneyField, Opener, Sheet, useRun } from "@/components/financas/forms";
import { Icon } from "@/components/ui/icon";
import { Overlay } from "@/components/ui/overlay";
import { ColorPicker, REMINDER_OPTIONS } from "@/components/ui/pickers";
import { useToast } from "@/components/ui/toast";
import type { CareItem } from "@/data/pets";
import { WEEKDAYS, WEEKDAYS_INITIAL, type Day } from "@/lib/dates";
import { formatCents, parseBRL } from "@/lib/money";
import type { ColorId } from "@/lib/palette";
import { EXPENSE_CATEGORIES, INTERVALS, ROUTINE_ICONS, SPECIES, parseWeightKg, type PetExpenseCategory, type Species } from "@/lib/pet-meta";

/* ---------- Tipos simples vindos das páginas ---------- */

export type PetOpt = { id: string; name: string; color: ColorId };
export type PetDraft = {
  id: string | null; name: string; species: Species; color: ColorId; breed: string; birthDate: string; weight: string; neuteredOn: string;
  microchip: string; allergies: string; vet: string; notes: string; avatarFileId: string | null;
};
export type VaccineItem = { id: string; name: string; doneOn: string | null; nextOn: string | null };
export type MedicineItem = { id: string; name: string; intervalDays: number | null; lastOn: string | null; nextOn: string | null };
export type RoutineItem = { id: string; name: string; icon: string; times: string[]; weekdays: number; active: boolean };
export type ExpenseItem = { id: string; petId: string; category: PetExpenseCategory; amountCents: number; date: string; title: string };

/* ---------- Pet (cadastro e edição) ---------- */

export function PetForm({ draft }: { draft: PetDraft }) {
  const router = useRouter();
  const { run, pending, error, setError, toast, start } = useRun();
  const [v, setV] = useState(draft);
  const photo = useRef<HTMLInputElement>(null);
  const set = <K extends keyof PetDraft>(key: K, value: PetDraft[K]) => setV((cur) => ({ ...cur, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const weightGrams = v.weight.trim() ? parseWeightKg(v.weight) : null;
    if (v.weight.trim() && weightGrams === null) { setError("Peso inválido. Use algo como 12,4."); return; }
    const input = {
      name: v.name, species: v.species, color: v.color, breed: v.breed, birthDate: v.birthDate || null, weightGrams,
      neuteredOn: v.neuteredOn || null, microchip: v.microchip, allergies: v.allergies, vet: v.vet, notes: v.notes,
    };
    setError(undefined);
    start(async () => {
      const result = await savePet({ id: v.id, input });
      if (!result.ok) { setError(result.error); return; }
      const file = photo.current?.files?.[0];
      if (file) {
        const form = new FormData();
        form.set("id", result.data);
        form.set("foto", file);
        const uploaded = await changePetAvatar(form);
        if (!uploaded.ok) toast(uploaded.error, { tone: "error" });
      }
      toast(v.id ? "Alterações salvas" : "Pet cadastrado");
      router.push(`/pets/${result.data}`);
    });
  }

  return (
    <form className="fx-form card lg" onSubmit={submit} style={{ maxWidth: 720 }}>
      <div><label className="lbl" htmlFor="pt-nome">Nome</label><input id="pt-nome" className="inp" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required autoFocus /></div>
      <div className="two">
        <div>
          <label className="lbl" htmlFor="pt-especie">Espécie</label>
          <select id="pt-especie" className="inp" value={v.species} onChange={(e) => set("species", e.target.value as Species)}>
            {SPECIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div><label className="lbl" htmlFor="pt-raca">Raça</label><input id="pt-raca" className="inp" value={v.breed} onChange={(e) => set("breed", e.target.value)} maxLength={120} placeholder="Ex.: SRD caramelo" /></div>
      </div>
      <div><span className="lbl">Cor no calendário</span><ColorPicker value={v.color} onChange={(c) => set("color", c)} /></div>
      <div className="two">
        <div><label className="lbl" htmlFor="pt-nasc">Nascimento</label><input id="pt-nasc" className="inp" type="date" value={v.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></div>
        <div><label className="lbl" htmlFor="pt-peso">Peso (kg)</label><input id="pt-peso" className="inp num" inputMode="decimal" value={v.weight} onChange={(e) => set("weight", e.target.value)} placeholder="12,4" /></div>
      </div>
      <div className="two">
        <div><label className="lbl" htmlFor="pt-cast">Castração</label><input id="pt-cast" className="inp" type="date" value={v.neuteredOn} onChange={(e) => set("neuteredOn", e.target.value)} /></div>
        <div><label className="lbl" htmlFor="pt-chip">Microchip</label><input id="pt-chip" className="inp" value={v.microchip} onChange={(e) => set("microchip", e.target.value)} maxLength={60} /></div>
      </div>
      <div className="two">
        <div><label className="lbl" htmlFor="pt-alerg">Alergias</label><input id="pt-alerg" className="inp" value={v.allergies} onChange={(e) => set("allergies", e.target.value)} maxLength={300} /></div>
        <div><label className="lbl" htmlFor="pt-vet">Veterinário(a)</label><input id="pt-vet" className="inp" value={v.vet} onChange={(e) => set("vet", e.target.value)} maxLength={120} /></div>
      </div>
      <div><label className="lbl" htmlFor="pt-obs">Observações</label><textarea id="pt-obs" className="inp" value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} placeholder="Medos, manias, o que gosta…" /></div>
      <div>
        <label className="lbl" htmlFor="pt-foto">Foto <span className="t3">(opcional)</span></label>
        <input id="pt-foto" ref={photo} className="inp" type="file" accept="image/jpeg,image/png,image/webp" />
        {v.id && v.avatarFileId ? (
          <button type="button" className="btn btn-g" style={{ marginTop: 6 }} onClick={() => run(() => clearPetAvatar({ id: v.id as string }), "Foto removida", () => set("avatarFileId", null))}>Remover foto atual</button>
        ) : null}
      </div>
      {error ? <FieldError message={error} /> : null}
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-s" onClick={() => router.back()}>Cancelar</button>
        <button type="submit" className="btn btn-p" disabled={pending}>{pending ? "Salvando…" : v.id ? "Salvar alterações" : "Cadastrar pet"}</button>
      </div>
    </form>
  );
}

export function RemovePetButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { pending, error, setError, toast, start } = useRun();
  return (
    <Opener title="Remover pet" trigger={(open) => <button type="button" className="btn btn-danger" onClick={open}><Icon name="trash" size="s" />Remover</button>}>
      {(close) => (
        <ConfirmDelete
          title={`Remover ${name}?`} confirm="Sim, remover" pending={pending} error={error} onBack={close}
          text="A ficha, as vacinas, a rotina, os gastos e os compromissos desse pet serão apagados. Essa ação não pode ser desfeita."
          onConfirm={() => start(async () => {
            const result = await removePet({ id });
            if (!result.ok) { setError(result.error); return; }
            toast("Pet removido");
            close();
            router.push("/pets");
          })}
        />
      )}
    </Opener>
  );
}

/* ---------- Saúde ---------- */

export function VaccineButton({ petId, item, label, className = "btn btn-s" }: { petId: string; item?: VaccineItem; label: ReactNode; className?: string }) {
  return (
    <Opener title={item ? "Editar vacina" : "Nova vacina"} trigger={(open) => <button type="button" className={className} onClick={open}>{label}</button>}>
      {(close) => <VaccineForm petId={petId} item={item} onDone={close} />}
    </Opener>
  );
}

function VaccineForm({ petId, item, onDone }: { petId: string; item?: VaccineItem; onDone: () => void }) {
  const { run, pending, error } = useRun();
  const [name, setName] = useState(item?.name ?? "");
  const [doneOn, setDoneOn] = useState(item?.doneOn ?? "");
  const [nextOn, setNextOn] = useState(item?.nextOn ?? "");
  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveVaccine({ id: item?.id ?? null, petId, input: { name, doneOn: doneOn || null, nextOn: nextOn || null } }), "Vacina salva", onDone);
  }
  return (
    <form className="fx-form" onSubmit={submit}>
      <div><label className="lbl" htmlFor="vc-nome">Vacina</label><input id="vc-nome" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus placeholder="Ex.: V10 (múltipla)" /></div>
      <div className="two">
        <div><label className="lbl" htmlFor="vc-feita">Aplicada em</label><input id="vc-feita" className="inp" type="date" value={doneOn} onChange={(e) => setDoneOn(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="vc-prox">Próxima dose</label><input id="vc-prox" className="inp" type="date" value={nextOn} onChange={(e) => setNextOn(e.target.value)} /></div>
      </div>
      <p className="hint">A próxima dose entra no calendário e avisa às 9h do dia.</p>
      <Footer error={error} pending={pending} onCancel={onDone} save="Salvar"
        extra={item ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => removeVaccine({ id: item.id }), "Vacina removida", onDone)}><Icon name="trash" size="s" />Excluir</button> : null} />
    </form>
  );
}

export function MedicineButton({ petId, item, label, className = "btn btn-s" }: { petId: string; item?: MedicineItem; label: ReactNode; className?: string }) {
  return (
    <Opener title={item ? "Editar medicamento" : "Novo medicamento"} trigger={(open) => <button type="button" className={className} onClick={open}>{label}</button>}>
      {(close) => <MedicineForm petId={petId} item={item} onDone={close} />}
    </Opener>
  );
}

function MedicineForm({ petId, item, onDone }: { petId: string; item?: MedicineItem; onDone: () => void }) {
  const { run, pending, error } = useRun();
  const [name, setName] = useState(item?.name ?? "");
  const known = INTERVALS.some((i) => i.value === String(item?.intervalDays ?? ""));
  const [interval, setInterval] = useState(item?.intervalDays ? String(item.intervalDays) : "");
  const [custom, setCustom] = useState(!known && item?.intervalDays ? String(item.intervalDays) : "");
  const [lastOn, setLastOn] = useState(item?.lastOn ?? "");
  const [nextOn, setNextOn] = useState(item?.nextOn ?? "");
  const days = custom.trim() ? Number(custom) : interval ? Number(interval) : null;
  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveMedicine({ id: item?.id ?? null, petId, input: { name, intervalDays: days, lastOn: lastOn || null, nextOn: nextOn || null } }), "Medicamento salvo", onDone);
  }
  return (
    <form className="fx-form" onSubmit={submit}>
      <div><label className="lbl" htmlFor="md-nome">Medicamento</label><input id="md-nome" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus placeholder="Ex.: Antipulgas" /></div>
      <div className="two">
        <div>
          <label className="lbl" htmlFor="md-freq">Frequência</label>
          <select id="md-freq" className="inp" value={interval} onChange={(e) => { setInterval(e.target.value); setCustom(""); }}>
            {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>
        <div><label className="lbl" htmlFor="md-dias">Ou a cada (dias)</label><input id="md-dias" className="inp num" type="number" min={1} max={3650} value={custom} onChange={(e) => setCustom(e.target.value)} /></div>
      </div>
      <div className="two">
        <div><label className="lbl" htmlFor="md-ult">Última dose</label><input id="md-ult" className="inp" type="date" value={lastOn} onChange={(e) => setLastOn(e.target.value)} /></div>
        <div><label className="lbl" htmlFor="md-prox">Próxima dose</label><input id="md-prox" className="inp" type="date" value={nextOn} onChange={(e) => setNextOn(e.target.value)} /></div>
      </div>
      <p className="hint">Sem a próxima dose, ela é calculada pela última mais a frequência.</p>
      <Footer error={error} pending={pending} onCancel={onDone} save="Salvar"
        extra={item ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => removeMedicine({ id: item.id }), "Medicamento removido", onDone)}><Icon name="trash" size="s" />Excluir</button> : null} />
    </form>
  );
}

export function GiveMedicineButton({ id }: { id: string }) {
  const { run, pending } = useRun();
  return <button type="button" className="btn btn-g" disabled={pending} onClick={() => run(() => giveMedicine({ id }), "Dose registrada")}>Dei hoje</button>;
}

export function VisitButton({ petId, today }: { petId: string; today: Day }) {
  return (
    <Opener title="Registrar consulta" trigger={(open) => <button type="button" className="btn btn-s" onClick={open}><Icon name="plus" size="s" />Registrar consulta</button>}>
      {(close) => <VisitForm petId={petId} today={today} onDone={close} />}
    </Opener>
  );
}

function VisitForm({ petId, today, onDone }: { petId: string; today: Day; onDone: () => void }) {
  const { run, pending, error } = useRun();
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => addVisit({ petId, input: { date, title, note } }), "Consulta registrada", onDone);
  }
  return (
    <form className="fx-form" onSubmit={submit}>
      <div><label className="lbl" htmlFor="vs-titulo">Motivo</label><input id="vs-titulo" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus placeholder="Ex.: Check-up anual" /></div>
      <div><label className="lbl" htmlFor="vs-data">Data</label><input id="vs-data" className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
      <div><label className="lbl" htmlFor="vs-nota">Anotação</label><textarea id="vs-nota" className="inp" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Peso, orientações…" /></div>
      <Footer error={error} pending={pending} onCancel={onDone} save="Salvar" />
    </form>
  );
}

export function RemoveVisitButton({ id }: { id: string }) {
  const { run, pending } = useRun();
  return <button type="button" className="btn btn-g btn-ic" aria-label="Excluir consulta" disabled={pending} onClick={() => run(() => removeVisit({ id }), "Consulta removida")}><Icon name="trash" size="s" /></button>;
}

/* ---------- Rotina ---------- */

export function RoutineButton({ petId, item, label, className = "btn btn-s" }: { petId: string; item?: RoutineItem; label: ReactNode; className?: string }) {
  return (
    <Opener title={item ? "Editar tarefa" : "Nova tarefa"} trigger={(open) => <button type="button" className={className} onClick={open}>{label}</button>}>
      {(close) => <RoutineForm petId={petId} item={item} onDone={close} />}
    </Opener>
  );
}

function RoutineForm({ petId, item, onDone }: { petId: string; item?: RoutineItem; onDone: () => void }) {
  const { run, pending, error } = useRun();
  const [name, setName] = useState(item?.name ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "paw");
  const [times, setTimes] = useState<string[]>(item?.times ?? ["08:00"]);
  const [weekdays, setWeekdays] = useState(item?.weekdays ?? 127);
  const [active, setActive] = useState(item?.active ?? true);
  const toggleDay = (d: number) => setWeekdays((m) => m ^ (1 << d));
  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveRoutine({ id: item?.id ?? null, petId, input: { name, icon, times: times.filter(Boolean), weekdays, active } }), "Tarefa salva", onDone);
  }
  return (
    <form className="fx-form" onSubmit={submit}>
      <div><label className="lbl" htmlFor="rt-nome">Tarefa</label><input id="rt-nome" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus placeholder="Ex.: Passeio da manhã" /></div>
      <div>
        <span className="lbl">Ícone</span>
        <div className="row g8 wrap" role="radiogroup" aria-label="Ícone">
          {ROUTINE_ICONS.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={icon === key} aria-label={key} className={`btn btn-ic ${icon === key ? "btn-p" : "btn-s"}`} onClick={() => setIcon(key)}><Icon name={key} /></button>
          ))}
        </div>
      </div>
      <div>
        <span className="lbl">Horários <span className="t3">(vazio = a qualquer hora)</span></span>
        <div className="col g8">
          {times.map((t, i) => (
            <div key={i} className="row g8">
              <input className="inp" type="time" aria-label={`Horário ${i + 1}`} value={t} onChange={(e) => setTimes((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="btn btn-g btn-ic" aria-label="Remover horário" onClick={() => setTimes((cur) => cur.filter((_, j) => j !== i))}><Icon name="close" size="s" /></button>
            </div>
          ))}
          {times.length < 8 ? <button type="button" className="btn btn-s" style={{ alignSelf: "flex-start" }} onClick={() => setTimes((cur) => [...cur, ""])}><Icon name="plus" size="s" />Horário</button> : null}
        </div>
      </div>
      <div>
        <span className="lbl">Dias</span>
        <div className="row g8 wrap" role="group" aria-label="Dias da semana">
          {WEEKDAYS_INITIAL.map((initial, d) => (
            <button key={d} type="button" className={`chip${(weekdays >> d) & 1 ? " on" : ""}`} style={{ minWidth: 44, justifyContent: "center", padding: 0 }} aria-pressed={Boolean((weekdays >> d) & 1)} aria-label={WEEKDAYS[d]} onClick={() => toggleDay(d)}>{initial}</button>
          ))}
        </div>
      </div>
      <div className="row jb">
        <div className="col"><b>Ativa</b><span className="sm t2">Desligada, sai da lista de cuidados de hoje</span></div>
        <button type="button" role="switch" aria-checked={active} aria-label="Ativa" className={`tg${active ? " on" : ""}`} onClick={() => setActive(!active)}><i /></button>
      </div>
      <Footer error={error} pending={pending} onCancel={onDone} save="Salvar"
        extra={item ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => removeRoutine({ id: item.id }), "Tarefa removida", onDone)}><Icon name="trash" size="s" />Excluir</button> : null} />
    </form>
  );
}

/** Cuidados de hoje: marcar na hora, sem esperar o servidor (reverte sozinho se falhar). */
export function CareList({ items, day }: { items: CareItem[]; day: Day }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [optimistic, setDone] = useOptimistic(items, (cur, change: { key: string; done: boolean }) => cur.map((i) => (i.key === change.key ? { ...i, done: change.done } : i)));
  function toggle(item: CareItem) {
    const done = !item.done;
    start(async () => {
      setDone({ key: item.key, done });
      const result = await toggleCare({ routineId: item.routineId, day, time: item.time, done });
      if (!result.ok) toast(result.error, { tone: "error" });
    });
  }
  return (
    <ul>
      {optimistic.map((item) => (
        <li key={item.key}>
          <button type="button" className={`routine-check${item.done ? " done" : ""}`} aria-pressed={item.done} onClick={() => toggle(item)}>
            <span className={`ck${item.done ? " on" : ""}`} aria-hidden="true">{item.done ? <Icon name="check" size="s" /> : null}</span>
            <span className="grow col"><b className="t">{item.name}</b><span className="sm t2">{item.petName}{item.time ? ` · ${item.time}` : ""}</span></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Gastos ---------- */

export function ExpenseButton({ pets, petId, item, today, label, className = "btn btn-s" }: {
  pets: PetOpt[]; petId?: string; item?: ExpenseItem; today: Day; label: ReactNode; className?: string;
}) {
  return (
    <Opener title={item ? "Editar gasto" : "Novo gasto"} trigger={(open) => <button type="button" className={className} onClick={open}>{label}</button>}>
      {(close) => <ExpenseForm pets={pets} petId={petId} item={item} today={today} onDone={close} />}
    </Opener>
  );
}

function ExpenseForm({ pets, petId, item, today, onDone }: { pets: PetOpt[]; petId?: string; item?: ExpenseItem; today: Day; onDone: () => void }) {
  const { run, pending, error, setError } = useRun();
  const [pet, setPet] = useState(item?.petId ?? petId ?? pets[0]?.id ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [amount, setAmount] = useState(item ? formatCents(item.amountCents) : "");
  const [category, setCategory] = useState<PetExpenseCategory>(item?.category ?? "food");
  const [date, setDate] = useState(item?.date ?? today);
  function submit(event: FormEvent) {
    event.preventDefault();
    const cents = parseBRL(amount);
    if (!cents) { setError("Informe um valor válido."); return; }
    run(() => saveExpense({ id: item?.id ?? null, petId: pet, input: { category, amountCents: cents, date, title } }), "Gasto salvo", onDone);
  }
  return (
    <form className="fx-form" onSubmit={submit}>
      <MoneyField id="ex-valor" label="Valor" value={amount} onChange={setAmount} big />
      <div><label className="lbl" htmlFor="ex-desc">Descrição</label><input id="ex-desc" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Ex.: Ração premium 10 kg" /></div>
      <div className="two">
        <div>
          <label className="lbl" htmlFor="ex-pet">Pet</label>
          <select id="ex-pet" className="inp" value={pet} onChange={(e) => setPet(e.target.value)} required>
            {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="ex-cat">Categoria</label>
          <select id="ex-cat" className="inp" value={category} onChange={(e) => setCategory(e.target.value as PetExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div><label className="lbl" htmlFor="ex-data">Data</label><input id="ex-data" className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
      <Footer error={error} pending={pending} onCancel={onDone} save="Salvar gasto"
        extra={item ? <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run(() => removeExpense({ id: item.id }), "Gasto removido", onDone)}><Icon name="trash" size="s" />Excluir</button> : null} />
    </form>
  );
}

/* ---------- Compromisso (abre por ?novo=pet-compromisso) ---------- */

const REPEATS = [
  { value: "", label: "Não repete" },
  { value: "weekly", label: "Toda semana" },
  { value: "monthly", label: "Todo mês" },
  { value: "yearly", label: "Todo ano" },
] as const;

export function AppointmentModal({ pets, today, onClose }: { pets: PetOpt[]; today: Day; onClose: () => void }) {
  const { run, pending, error } = useRun();
  const [pet, setPet] = useState(pets[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [reminder, setReminder] = useState("");
  const [repeat, setRepeat] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => addAppointment({
      petId: pet,
      input: {
        title, date, startTime: start || null, endTime: start && end ? end : null, location, notes: "",
        reminderMinutes: start && reminder !== "" ? Number(reminder) : null,
        recurrence: repeat ? { freq: repeat as "weekly" | "monthly" | "yearly" } : null,
      },
    }), "Compromisso criado", onClose);
  }

  if (!pets.length) {
    return (
      <Sheet title="Novo compromisso" onClose={onClose}>
        <p className="t2">Cadastre um pet antes de marcar compromissos.</p>
        <button type="button" className="btn btn-p btn-w" style={{ marginTop: 12 }} onClick={onClose}>Entendi</button>
      </Sheet>
    );
  }
  return (
    <Overlay label="Novo compromisso" variant="modal" narrow onClose={onClose}>
      <div className="row jb" style={{ marginBottom: 14 }}>
        <h2 className="ser" style={{ fontSize: 26, fontWeight: 600 }}>Novo compromisso</h2>
        <button type="button" className="btn btn-g btn-ic" aria-label="Fechar" onClick={onClose}><Icon name="close" /></button>
      </div>
      <form className="fx-form" onSubmit={submit}>
        <div>
          <label className="lbl" htmlFor="ap-pet">Pet</label>
          <select id="ap-pet" className="inp" value={pet} onChange={(e) => setPet(e.target.value)}>{pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>
        <div><label className="lbl" htmlFor="ap-titulo">Título</label><input id="ap-titulo" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus placeholder="Ex.: Banho e tosa" /></div>
        <div><label className="lbl" htmlFor="ap-data">Data</label><input id="ap-data" className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
        <div className="two">
          <div><label className="lbl" htmlFor="ap-ini">Início</label><input id="ap-ini" className="inp" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="ap-fim">Fim</label><input id="ap-fim" className="inp" type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!start} /></div>
        </div>
        <div><label className="lbl" htmlFor="ap-local">Local</label><input id="ap-local" className="inp" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="Ex.: Clínica Pé na Grama" /></div>
        <div className="two">
          <div>
            <label className="lbl" htmlFor="ap-lemb">Lembrete</label>
            <select id="ap-lemb" className="inp" value={reminder} onChange={(e) => setReminder(e.target.value)} disabled={!start}>{REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </div>
          <div>
            <label className="lbl" htmlFor="ap-rep">Repetição</label>
            <select id="ap-rep" className="inp" value={repeat} onChange={(e) => setRepeat(e.target.value)}>{REPEATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          </div>
        </div>
        <Footer error={error} pending={pending} onCancel={onClose} save="Salvar compromisso" />
      </form>
    </Overlay>
  );
}
