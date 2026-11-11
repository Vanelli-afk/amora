import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge, Empty } from "@/components/financas/ui";
import { petContext } from "@/components/pets/context";
import {
  ExpenseButton, GiveMedicineButton, MedicineButton, RemovePetButton, RemoveVisitButton, RoutineButton, VaccineButton, VisitButton, type PetOpt,
} from "@/components/pets/forms";
import { PetHead, PetTabs, parseTab } from "@/components/pets/ui";
import { Icon } from "@/components/ui/icon";
import { OverlayLink, TransitionLink } from "@/components/ui/links";
import {
  expenseSummary, getPet, listExpenses, listMedicines, listPetOccurrences, listRoutines, listVaccines, listVisits,
} from "@/data/pets";
import { WEEKDAYS_INITIAL, WEEKDAYS_SHORT, addDays, dayOfWeek, formatDayMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { careBadge, expenseCategory, formatWeight, intervalLabel, petAge, routineIcon, speciesLabel } from "@/lib/pet-meta";

export const metadata: Metadata = { title: "Ficha do pet" };

const dmy = (day: string | null) => (day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : "—");

function weekdaysText(mask: number): string {
  if (mask === 127) return "todos os dias";
  return WEEKDAYS_SHORT.filter((_, d) => (mask >> d) & 1).join(", ");
}

export default async function PetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { aba } = await searchParams;
  const tab = parseTab(aba);
  const { userId, today } = await petContext();
  const pet = await getPet(userId, id);
  if (!pet) notFound();
  const petOpt = { id: pet.id, name: pet.name, color: pet.color };

  return (
    <>
      <PetHead pet={pet} today={today}>
        <TransitionLink className="btn btn-s" href={`/pets/${pet.id}/editar`}><Icon name="edit" size="s" />Editar perfil</TransitionLink>
        <RemovePetButton id={pet.id} name={pet.name} />
      </PetHead>
      <div className="fx-stack">
        <PetTabs petId={pet.id} active={tab} />
        {tab === "perfil" ? await Perfil({ userId, pet, today }) : null}
        {tab === "saude" ? await Saude({ userId, petId: pet.id, today }) : null}
        {tab === "rotina" ? await Rotina({ userId, petId: pet.id, today }) : null}
        {tab === "gastos" ? await Gastos({ userId, pet: petOpt, today }) : null}
      </div>
    </>
  );
}

async function Perfil({ userId, pet, today }: { userId: string; pet: NonNullable<Awaited<ReturnType<typeof getPet>>>; today: string }) {
  const upcoming = await listPetOccurrences(userId, today, addDays(today, 90), pet.id);
  const rows: [string, string][] = [
    ["Espécie", speciesLabel(pet.species)], ["Raça", pet.breed ?? "—"], ["Nascimento", `${dmy(pet.birthDate)}${pet.birthDate ? ` (${petAge(pet.birthDate, today)})` : ""}`],
    ["Peso", formatWeight(pet.weightGrams) || "—"], ["Castração", pet.neuteredOn ? `Castrado em ${dmy(pet.neuteredOn)}` : "—"], ["Microchip", pet.microchip ?? "—"],
    ["Alergias", pet.allergies ?? "—"], ["Veterinário(a)", pet.vet ?? "—"],
  ];
  return (
    <div className="fx-cols">
      <section className="card" aria-labelledby="pf-info">
        <div className="cardhd"><h2 className="h2" id="pf-info">Informações</h2></div>
        <dl className="kv">{rows.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <h3 className="h3" style={{ margin: "16px 0 6px" }}>Observações</h3>
        <p className="t2">{pet.notes ?? "Nada anotado ainda. Medos, manias e o que ele gosta ajudam quem for cuidar."}</p>
      </section>
      <section className="card" aria-labelledby="pf-agenda">
        <div className="cardhd"><h2 className="h2" id="pf-agenda">Próximos compromissos</h2><OverlayLink className="btn btn-g" params={{ novo: "pet-compromisso" }}><Icon name="plus" size="s" />Novo</OverlayLink></div>
        {upcoming.length ? (
          <ul>
            {upcoming.slice(0, 6).map((e) => (
              <li key={`${e.id}-${e.date}`}>
                <OverlayLink className="fx-row" params={{ evento: e.id, data: e.date }}>
                  <span className={`date-tile c-${pet.color}`}><small>{WEEKDAYS_SHORT[dayOfWeek(e.date)]}</small><b>{e.date.slice(8, 10)}</b></span>
                  <span className="grow"><b className="ell">{e.title}</b><span className="sm t2">{formatDayMonth(e.date)}{e.startTime ? ` · ${e.startTime}` : ""}{e.location ? ` · ${e.location}` : ""}</span></span>
                </OverlayLink>
              </li>
            ))}
          </ul>
        ) : <Empty title="Nada marcado">Banho, consulta ou vacina entram aqui.</Empty>}
      </section>
    </div>
  );
}

async function Saude({ userId, petId, today }: { userId: string; petId: string; today: string }) {
  const [vaccines, medicines, visits] = await Promise.all([listVaccines(userId, petId), listMedicines(userId, petId), listVisits(userId, petId)]);
  const pending = vaccines.filter((v) => v.nextOn && v.nextOn <= addDays(today, 14)).length;
  return (
    <div className="fx-cols">
      <section className="card" aria-labelledby="sd-vac">
        <div className="cardhd"><div className="col"><h2 className="h2" id="sd-vac">Vacinas</h2>{pending ? <span className="sm t2">{pending} pendente(s)</span> : null}</div><VaccineButton petId={petId} className="btn btn-g" label={<><Icon name="plus" size="s" />Vacina</>} /></div>
        {vaccines.length ? (
          <ul>
            {vaccines.map((v) => {
              const badge = careBadge(v.nextOn, today);
              return (
                <li key={v.id}>
                  <VaccineButton petId={petId} item={v} className="fx-row" label={
                    <>
                      <span className={`ibub ${badge.tone === "ok" ? "c-sage" : "c-peach"}`}><Icon name="vaccine" /></span>
                      <span className="grow" style={{ textAlign: "left" }}><b>{v.name}</b><span className="sm t2">{v.doneOn ? `Aplicada em ${dmy(v.doneOn)}` : "Ainda não aplicada"}{v.nextOn ? ` · próxima ${dmy(v.nextOn)}` : ""}</span></span>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </>
                  } />
                </li>
              );
            })}
          </ul>
        ) : <Empty title="Nenhuma vacina registrada" />}
      </section>

      <section className="card" aria-labelledby="sd-med">
        <div className="cardhd"><h2 className="h2" id="sd-med">Medicamentos</h2><MedicineButton petId={petId} className="btn btn-g" label={<><Icon name="plus" size="s" />Medicamento</>} /></div>
        {medicines.length ? (
          <ul>
            {medicines.map((m) => {
              const badge = careBadge(m.nextOn, today);
              return (
                <li key={m.id} className="fx-row">
                  <MedicineButton petId={petId} item={m} className="grow fx-row" label={
                    <>
                      <span className="ibub c-sand"><Icon name="pill" /></span>
                      <span className="grow" style={{ textAlign: "left" }}><b>{m.name}</b><span className="sm t2">{intervalLabel(m.intervalDays)}{m.nextOn ? ` · próxima ${dmy(m.nextOn)}` : ""}</span></span>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </>
                  } />
                  <GiveMedicineButton id={m.id} />
                </li>
              );
            })}
          </ul>
        ) : <Empty title="Nenhum medicamento" />}
      </section>

      <section className="card" aria-labelledby="sd-cons" style={{ gridColumn: "1 / -1" }}>
        <div className="cardhd"><h2 className="h2" id="sd-cons">Consultas</h2><VisitButton petId={petId} today={today} /></div>
        {visits.length ? (
          <ul>
            {visits.map((v) => (
              <li key={v.id} className="fx-row">
                <span className="date-tile"><small>{["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(v.date.slice(5, 7)) - 1]}</small><b>{v.date.slice(8, 10)}</b></span>
                <span className="grow"><b>{v.title}</b>{v.note ? <span className="sm t2">{v.note}</span> : null}</span>
                <RemoveVisitButton id={v.id} />
              </li>
            ))}
          </ul>
        ) : <Empty title="Nenhuma consulta registrada">O histórico ajuda na próxima ida ao veterinário.</Empty>}
      </section>
    </div>
  );
}

async function Rotina({ userId, petId, today }: { userId: string; petId: string; today: string }) {
  const routines = await listRoutines(userId, petId);
  return (
    <section className="card" aria-labelledby="rt-tit">
      <div className="cardhd"><h2 className="h2" id="rt-tit">Rotina e cuidados</h2><RoutineButton petId={petId} className="btn btn-g" label={<><Icon name="plus" size="s" />Nova tarefa</>} /></div>
      {routines.length ? (
        <ul>
          {routines.map((r) => (
            <li key={r.id}>
              <RoutineButton petId={petId} item={r} className="fx-row" label={
                <>
                  <span className="ibub c-peach"><Icon name={routineIcon(r.icon)} /></span>
                  <span className="grow" style={{ textAlign: "left" }}><b>{r.name}</b><span className="sm t2">{r.times.length ? r.times.join(" e ") : "Qualquer hora"} · {weekdaysText(r.weekdays)}</span></span>
                  <Badge tone={r.active ? "ok" : ""}>{r.active ? "Ativa" : "Pausada"}</Badge>
                </>
              } />
            </li>
          ))}
        </ul>
      ) : <Empty title="Sem rotina cadastrada">Alimentação, passeios e banhos viram uma lista de cuidados para cada dia.</Empty>}
      <p className="hint">Dias: {WEEKDAYS_INITIAL.join(" ")} · {today.slice(8, 10)}/{today.slice(5, 7)} é hoje.</p>
    </section>
  );
}

async function Gastos({ userId, pet, today }: { userId: string; pet: PetOpt; today: string }) {
  const month = today.slice(0, 7);
  const [expenses, summary] = await Promise.all([listExpenses(userId, { petId: pet.id }, 30), expenseSummary(userId, month)]);
  const total = summary.perPet.get(pet.id) ?? 0;
  return (
    <section className="card" aria-labelledby="gs-tit">
      <div className="cardhd">
        <div className="col"><h2 className="h2" id="gs-tit">Gastos</h2><span className="sm t2">{formatBRL(total)} neste mês</span></div>
        <ExpenseButton pets={[pet]} petId={pet.id} today={today} className="btn btn-g" label={<><Icon name="plus" size="s" />Novo gasto</>} />
      </div>
      {expenses.length ? (
        <ul>
          {expenses.map((e) => {
            const meta = expenseCategory(e.category);
            return (
              <li key={e.id}>
                <ExpenseButton pets={[pet]} petId={pet.id} item={e} today={today} className="fx-row" label={
                  <>
                    <span className={`ibub c-${meta.color}`}><Icon name={meta.icon} /></span>
                    <span className="grow" style={{ textAlign: "left" }}><b className="ell">{e.title}</b><span className="sm t2">{dmy(e.date)} · {meta.label}</span></span>
                    <span className="amt">{formatBRL(e.amountCents)}</span>
                  </>
                } />
              </li>
            );
          })}
        </ul>
      ) : <Empty title="Nenhum gasto registrado" />}
    </section>
  );
}
