import type { Metadata } from "next";
import { Empty, MonthNav } from "@/components/financas/ui";
import { petContext } from "@/components/pets/context";
import { ExpenseButton } from "@/components/pets/forms";
import { NoPets, PetAvatar, PetFilter } from "@/components/pets/ui";
import { Icon } from "@/components/ui/icon";
import { expenseSummary, listExpenses, listPets } from "@/data/pets";
import { isValidMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { expenseCategory } from "@/lib/pet-meta";

export const metadata: Metadata = { title: "Gastos · Pets" };

const UUID = /^[0-9a-f-]{36}$/i;
const monthEnd = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
const dm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export default async function GastosPage({ searchParams }: { searchParams: Promise<{ mes?: string; pet?: string }> }) {
  const raw = await searchParams;
  const { userId, today } = await petContext();
  const month = raw.mes && isValidMonth(raw.mes) ? raw.mes : today.slice(0, 7);
  const petId = raw.pet && UUID.test(raw.pet) ? raw.pet : undefined;
  const [pets, summary, expenses] = await Promise.all([
    listPets(userId), expenseSummary(userId, month), listExpenses(userId, { from: `${month}-01`, to: monthEnd(month), petId }),
  ]);
  const byId = new Map(pets.map((p) => [p.id, p]));
  const petOpts = pets.map((p) => ({ id: p.id, name: p.name, color: p.color }));
  const change = summary.prevTotalCents > 0 ? ((summary.totalCents - summary.prevTotalCents) / summary.prevTotalCents) * 100 : null;
  const maxCat = Math.max(...summary.categories.map((c) => c.totalCents), 1);
  const shownTotal = petId ? (summary.perPet.get(petId) ?? 0) : summary.totalCents;

  return (
    <>
      <div className="dtop">
        <div className="col"><h1 className="page-title">Gastos</h1><span className="sm t2 b">Quanto custa cuidar de quem a gente ama</span></div>
        <div className="row g8 wrap">
          <MonthNav month={month} today={today} path="/pets/gastos" />
          {pets.length ? <ExpenseButton className="btn btn-p" pets={petOpts} petId={petId} today={today} label={<><Icon name="plus" size="s" />Novo gasto</>} /> : null}
        </div>
      </div>
      {!pets.length ? <NoPets /> : (
        <div className="fx-stack">
          <PetFilter pets={pets} active={petId ?? null} base="/pets/gastos" />
          <div className="fx-cols">
            <section className="card" aria-labelledby="gt-resumo">
              <div className="cardhd"><h2 className="h2" id="gt-resumo">Resumo do mês</h2></div>
              <div className="fx-kpi" style={{ padding: 0, boxShadow: "none" }}>
                <span className="v">{formatBRL(shownTotal)}</span>
                <span className="s">{petId ? "Deste pet no mês" : change === null ? "Sem gastos no mês anterior para comparar" : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1).replace(".", ",")}% frente ao mês anterior (${formatBRL(summary.prevTotalCents)})`}</span>
              </div>
              {summary.categories.length ? (
                <ul style={{ marginTop: 10 }}>
                  {summary.categories.map((c) => {
                    const meta = expenseCategory(c.category);
                    return (
                      <li key={c.category} className="fx-row" style={{ minHeight: 52 }}>
                        <span className={`ibub c-${meta.color}`}><Icon name={meta.icon} size="s" /></span>
                        <div className="grow" style={{ gap: 4 }}>
                          <div className="row jb"><b>{meta.label}</b><span className="amt">{formatBRL(c.totalCents)}</span></div>
                          <div className="bar ok" aria-hidden="true"><i style={{ width: `${(c.totalCents / maxCat) * 100}%` }} /></div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : <Empty title="Sem gastos neste mês" />}
              {!petId && summary.perPet.size > 1 ? (
                <p className="sm t2" style={{ marginTop: 8 }}>{[...summary.perPet.entries()].map(([id, total]) => `${byId.get(id)?.name ?? "—"} ${formatBRL(total)}`).join(" · ")}</p>
              ) : null}
            </section>

            <section className="card" aria-labelledby="gt-lanc">
              <div className="cardhd"><h2 className="h2" id="gt-lanc">Lançamentos do mês</h2></div>
              {expenses.length ? (
                <ul>
                  {expenses.map((e) => {
                    const meta = expenseCategory(e.category);
                    const pet = byId.get(e.petId);
                    return (
                      <li key={e.id}>
                        <ExpenseButton pets={petOpts} item={e} today={today} className="fx-row" label={
                          <>
                            {pet ? <PetAvatar pet={pet} size={40} /> : null}
                            <span className="grow" style={{ textAlign: "left" }}><b className="ell">{e.title}</b><span className="sm t2">{dm(e.date)} · {pet?.name} · {meta.label}</span></span>
                            <span className="amt">{formatBRL(e.amountCents)}</span>
                          </>
                        } />
                      </li>
                    );
                  })}
                </ul>
              ) : <Empty title="Nenhum lançamento" />}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
