import type { Metadata } from "next";
import { Badge, Empty } from "@/components/financas/ui";
import { CareList, ExpenseButton } from "@/components/pets/forms";
import { petContext, petStatus } from "@/components/pets/context";
import { NoPets, PetAvatar } from "@/components/pets/ui";
import { Icon } from "@/components/ui/icon";
import { OverlayLink, TransitionLink } from "@/components/ui/links";
import { loadPetsOverview } from "@/data/pets";
import { WEEKDAYS_SHORT, dayOfWeek, formatLongDay } from "@/lib/dates";
import { careBadge, expenseCategory, speciesLabel, petAge } from "@/lib/pet-meta";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Pets" };

const pctChange = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);

export default async function PetsPage() {
  const { userId, today } = await petContext();
  const o = await loadPetsOverview(userId, today);
  const done = o.care.filter((c) => c.done).length;
  const change = pctChange(o.summary.totalCents, o.summary.prevTotalCents);
  const firstAppointment = o.upcoming[0];
  const petOpts = o.pets.map((p) => ({ id: p.id, name: p.name, color: p.color }));

  return (
    <>
      <div className="dtop">
        <div className="col"><h1 className="page-title">Seus pets</h1><span className="sm t2 b">{formatLongDay(today)}</span></div>
        <div className="row g8 wrap">
          <OverlayLink className="btn btn-s only-desktop" params={{ novo: "pet-compromisso" }}><Icon name="calendar" size="s" />Novo compromisso</OverlayLink>
          <TransitionLink className="btn btn-p" href="/pets/novo"><Icon name="plus" size="s" />Cadastrar pet</TransitionLink>
        </div>
      </div>

      {!o.pets.length ? <NoPets /> : (
        <div className="fx-stack">
          <div className="fx-kpis">
            <div className="fx-kpi"><span className="k">Pets cadastrados</span><span className="v">{o.pets.length}</span><span className="s">{o.pets.map((p) => speciesLabel(p.species).toLowerCase()).join(", ")}</span></div>
            <div className="fx-kpi"><span className="k">Compromissos</span><span className="v">{o.appointmentsCount}</span><span className="s">{firstAppointment ? `Próximo: ${WEEKDAYS_SHORT[dayOfWeek(firstAppointment.date)]}, ${firstAppointment.date.slice(8, 10)}/${firstAppointment.date.slice(5, 7)}` : "Nada marcado"}</span></div>
            <div className="fx-kpi"><span className="k">Vacinas pendentes</span><span className="v">{o.pendingVaccines.length}</span><span className="s">{o.pendingVaccines[0] ? `${o.pendingVaccines[0].name}, ${careBadge(o.pendingVaccines[0].nextOn, today).label.toLowerCase()}` : "Tudo em dia"}</span></div>
            <div className="fx-kpi"><span className="k">Alertas</span><span className="v">{o.alerts.length}</span><span className="s">{o.alerts.length ? "Veja a lista abaixo" : "Nenhum no momento"}</span></div>
          </div>

          <div className="fx-cols wide">
            <div className="fx-stack">
              <section className="card" aria-labelledby="pt-alertas">
                <div className="cardhd"><h2 className="h2" id="pt-alertas">Alertas importantes</h2>{o.alerts.length ? <Badge tone="warn">{o.alerts.length} atenção</Badge> : null}</div>
                {o.alerts.length ? (
                  <ul>
                    {o.alerts.map((a) => {
                      const pet = o.byId.get(a.petId);
                      const badge = careBadge(a.date, today);
                      return (
                        <li key={a.key} className="fx-row">
                          {pet ? <PetAvatar pet={pet} size={40} /> : null}
                          <span className="grow"><b className="ell">{a.title}</b><span className="sm t2">{a.sub} · {a.date.slice(8, 10)}/{a.date.slice(5, 7)}</span></span>
                          <Badge tone={badge.tone}>{a.kind === "vacina" ? "Vacina" : badge.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                ) : <Empty title="Sem alertas">Vacinas, remédios e consultas próximos aparecem aqui.</Empty>}
              </section>

              <section className="card" aria-labelledby="pt-prox">
                <div className="cardhd"><h2 className="h2" id="pt-prox">Próximos compromissos</h2><TransitionLink className="btn btn-g" href="/pets/agenda">Ver agenda</TransitionLink></div>
                {o.upcoming.length ? (
                  <ul>
                    {o.upcoming.map((e) => {
                      const pet = o.byId.get(e.petId);
                      return (
                        <li key={`${e.id}-${e.date}`}>
                          <TransitionLink className="fx-row" href={`/pets/agenda?evento=${e.id}&data=${e.date}`}>
                            <span className={`date-tile c-${pet?.color ?? "sky"}`}><small>{WEEKDAYS_SHORT[dayOfWeek(e.date)]}</small><b>{e.date.slice(8, 10)}</b></span>
                            <span className="grow"><b className="ell">{e.title}</b><span className="sm t2">{pet?.name}{e.startTime ? ` · ${e.startTime}` : ""}{e.location ? ` · ${e.location}` : ""}</span></span>
                          </TransitionLink>
                        </li>
                      );
                    })}
                  </ul>
                ) : <Empty title="Nenhum compromisso">Marque banho, consulta ou vacina.</Empty>}
              </section>

              <section className="card" aria-labelledby="pt-meus">
                <div className="cardhd"><h2 className="h2" id="pt-meus">Meus pets</h2><TransitionLink className="btn btn-g" href="/pets/lista">Ver todos</TransitionLink></div>
                <div className="pet-cards">
                  {o.pets.map((pet) => {
                    const status = petStatus(pet, o, today);
                    return (
                      <TransitionLink key={pet.id} href={`/pets/${pet.id}`} className="pet-card">
                        <div className="row g12"><PetAvatar pet={pet} size={56} /><div className="col"><b className="h3">{pet.name}</b><span className="sm t2">{[speciesLabel(pet.species), pet.breed].filter(Boolean).join(" · ")}</span><span className="sm t2">{petAge(pet.birthDate, today)}</span></div></div>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </TransitionLink>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="fx-stack">
              <section className="card" aria-labelledby="pt-cuidados">
                <div className="cardhd"><h2 className="h2" id="pt-cuidados">Cuidados de hoje</h2>{o.care.length ? <span className="sm t2 b">{done} de {o.care.length} feitos</span> : null}</div>
                {o.care.length ? <CareList items={o.care} day={today} /> : <Empty title="Sem tarefas hoje">Crie a rotina na ficha de cada pet.</Empty>}
              </section>

              <section className="card" aria-labelledby="pt-gastos">
                <div className="cardhd"><h2 className="h2" id="pt-gastos">Gastos do mês</h2><TransitionLink className="btn btn-g" href="/pets/gastos">Detalhes</TransitionLink></div>
                <div className="fx-kpi" style={{ padding: 0, boxShadow: "none" }}>
                  <span className="v">{formatBRL(o.summary.totalCents)}</span>
                  <span className="s">{change === null ? "Sem gastos no mês passado" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1).replace(".", ",")}% em relação ao mês passado (${formatBRL(o.summary.prevTotalCents)})`}</span>
                </div>
                <ul style={{ marginTop: 8 }}>
                  {o.summary.categories.slice(0, 4).map((c) => {
                    const meta = expenseCategory(c.category);
                    return (
                      <li key={c.category} className="fx-row" style={{ minHeight: 48 }}>
                        <span className={`ibub c-${meta.color}`}><Icon name={meta.icon} size="s" /></span>
                        <span className="grow"><b>{meta.label}</b></span><span className="amt">{formatBRL(c.totalCents)}</span>
                      </li>
                    );
                  })}
                </ul>
                <ExpenseButton className="btn btn-s btn-w" pets={petOpts} today={today} label={<><Icon name="plus" size="s" />Novo gasto</>} />
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
