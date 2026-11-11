import type { Metadata } from "next";
import { Empty, MonthNav } from "@/components/financas/ui";
import { petContext } from "@/components/pets/context";
import { NoPets, PetFilter } from "@/components/pets/ui";
import { Icon } from "@/components/ui/icon";
import { OverlayLink } from "@/components/ui/links";
import { listPetOccurrences, listPets } from "@/data/pets";
import { WEEKDAYS_SHORT, addDays, dayOfWeek, formatDayMonth, isValidMonth, monthGrid } from "@/lib/dates";

export const metadata: Metadata = { title: "Agenda · Pets" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string; pet?: string }> }) {
  const raw = await searchParams;
  const { userId, today } = await petContext();
  const month = raw.mes && isValidMonth(raw.mes) ? raw.mes : today.slice(0, 7);
  const petId = raw.pet && UUID.test(raw.pet) ? raw.pet : undefined;
  const pets = await listPets(userId);
  const byId = new Map(pets.map((p) => [p.id, p]));
  const grid = monthGrid(month);
  const first = grid[0]?.day ?? `${month}-01`;
  const last = grid[grid.length - 1]?.day ?? `${month}-28`;
  const [inGrid, upcoming] = await Promise.all([listPetOccurrences(userId, first, last, petId), listPetOccurrences(userId, today, addDays(today, 60), petId)]);
  const byDay = new Map<string, typeof inGrid>();
  for (const e of inGrid) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const path = petId ? `/pets/agenda?pet=${petId}` : "/pets/agenda";

  return (
    <>
      <div className="dtop">
        <div className="col"><h1 className="page-title">Agenda</h1><span className="sm t2 b">Consultas, vacinas e banhos</span></div>
        <div className="row g8 wrap">
          <MonthNav month={month} today={today} path="/pets/agenda" />
          <OverlayLink className="btn btn-p only-desktop" params={{ novo: "pet-compromisso" }}><Icon name="plus" size="s" />Novo compromisso</OverlayLink>
        </div>
      </div>
      {!pets.length ? <NoPets /> : (
        <div className="fx-stack">
          <PetFilter pets={pets} active={petId ?? null} base="/pets/agenda" />
          <div className="fx-cols wide">
            <section className="card" aria-label="Calendário do mês">
              <div className="cal7" role="grid">
                {WEEKDAYS_SHORT.map((d) => <div key={d} className="dow" role="columnheader">{d}</div>)}
                {grid.map(({ day, inMonth }) => {
                  const events = byDay.get(day) ?? [];
                  return (
                    <div key={day} className={`cell${inMonth ? "" : " out"}${day === today ? " today" : ""}`} role="gridcell" aria-label={`${formatDayMonth(day)}${day === today ? ", hoje" : ""}${events.length ? `, ${events.length} compromisso(s)` : ""}`}>
                      <span className="d">{Number(day.slice(8, 10))}</span>
                      {events.slice(0, 3).map((e) => (
                        <OverlayLink key={`${e.id}-${e.date}`} className={`ev c-${byId.get(e.petId)?.color ?? "sky"}`} params={{ evento: e.id, data: e.date }}>{e.title}</OverlayLink>
                      ))}
                      {events.length > 3 ? <span className="xs t2">+{events.length - 3}</span> : null}
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="card" aria-labelledby="ag-prox">
              <div className="cardhd"><h2 className="h2" id="ag-prox">Próximos compromissos</h2></div>
              {upcoming.length ? (
                <ul>
                  {upcoming.slice(0, 10).map((e) => {
                    const pet = byId.get(e.petId);
                    return (
                      <li key={`${e.id}-${e.date}`}>
                        <OverlayLink className="fx-row" params={{ evento: e.id, data: e.date }}>
                          <span className={`date-tile c-${pet?.color ?? "sky"}`}><small>{WEEKDAYS_SHORT[dayOfWeek(e.date)]}</small><b>{e.date.slice(8, 10)}</b></span>
                          <span className="grow"><b className="ell">{e.title}</b><span className="sm t2">{pet?.name}{e.startTime ? ` · ${e.startTime}` : ""}{e.location ? ` · ${e.location}` : ""}</span></span>
                        </OverlayLink>
                      </li>
                    );
                  })}
                </ul>
              ) : <Empty title="Nada marcado">Use “Novo compromisso” para agendar.</Empty>}
            </section>
          </div>
          <span className="hint">{path === "/pets/agenda" ? "Mostrando todos os pets." : "Filtrando um pet."}</span>
        </div>
      )}
    </>
  );
}
