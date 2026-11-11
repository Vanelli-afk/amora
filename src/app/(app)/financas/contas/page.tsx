import type { Metadata } from "next";
import { financeContext, toOptions } from "@/components/financas/context";
import { BillButton, BillList, UnpayButton, type BillItem } from "@/components/financas/forms";
import { CatBubble, Empty, PageHead, PlanTabs } from "@/components/financas/ui";
import { TransitionLink } from "@/components/ui/links";
import { Icon } from "@/components/ui/icon";
import { ensureRecurringBills, listAccounts, listBills, listCategories, type Bill } from "@/data/finance";
import { addDays, formatDayMonth, formatLongDay, monthOf } from "@/lib/dates";
import { monthRange } from "@/data/finance";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Contas a pagar · Finanças" };

const toItem = (b: Bill): BillItem => ({ id: b.id, name: b.name, dueDate: b.dueDate, amountCents: b.amountCents, categoryId: b.categoryId, recurring: Boolean(b.recurringId), paidOn: b.paidOn });
const sum = (bills: Bill[]) => bills.reduce((s, b) => s + b.amountCents, 0);

export default async function ContasPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const { userId, today } = await financeContext();
  await ensureRecurringBills(today, userId);
  const paidTab = aba === "pagas";
  const month = monthRange(monthOf(today));
  const [accounts, categories, open, paid] = await Promise.all([
    listAccounts(userId), listCategories(userId), listBills(userId, { paid: false }),
    paidTab ? listBills(userId, { paid: true, from: month.from, to: month.to }) : Promise.resolve([] as Bill[]),
  ]);
  const options = toOptions(accounts, categories);
  const weekEnd = addDays(today, 7);
  const overdue = open.filter((b) => b.dueDate < today);
  const week = open.filter((b) => b.dueDate >= today && b.dueDate <= weekEnd);
  const later = open.filter((b) => b.dueDate > weekEnd);
  const catById = new Map(options.categories.map((c) => [c.id, c]));
  const groups = [{ id: "atrasadas", title: "Atrasadas", bills: overdue }, { id: "semana", title: "Esta semana", bills: week }, { id: "depois", title: "Depois", bills: later }].filter((g) => g.bills.length);

  return (
    <>
      <PageHead title="Planejar" sub={`Hoje é ${formatLongDay(today)}`}>
        <BillButton className="btn btn-p" categories={options.categories} label={<><Icon name="plus" size="s" />Nova conta</>} />
      </PageHead>
      <div className="fx-stack">
        <PlanTabs active="/financas/contas" />
        <div className="tabs" style={{ alignSelf: "flex-start" }} role="group" aria-label="Situação">
          <TransitionLink className={`tab${paidTab ? "" : " on"}`} href="/financas/contas">A pagar</TransitionLink>
          <TransitionLink className={`tab${paidTab ? " on" : ""}`} href="/financas/contas?aba=pagas">Pagas</TransitionLink>
        </div>

        {paidTab ? (
          <section className="card" aria-labelledby="fx-pagas">
            <div className="cardhd"><h2 className="h2" id="fx-pagas">Pagas neste mês</h2><span className="sm t2">{paid.length} conta(s) · {formatBRL(sum(paid))}</span></div>
            {paid.length ? (
              <ul>
                {paid.map((b) => {
                  const cat = b.categoryId ? catById.get(b.categoryId) : undefined;
                  return (
                    <li key={b.id} className="fx-row">
                      <CatBubble color={cat?.color ?? "sand"} icon={cat?.icon ?? "receipt"} />
                      <span className="grow"><b className="ell">{b.name}</b><span className="sm t2">Paga em {b.paidOn ? formatDayMonth(b.paidOn) : "—"}</span></span>
                      <span className="amt">{formatBRL(b.amountCents)}</span>
                      <UnpayButton id={b.id} />
                    </li>
                  );
                })}
              </ul>
            ) : <Empty title="Nenhuma conta paga neste mês" />}
          </section>
        ) : (
          <>
            <div className="fx-kpis">
              <div className="fx-kpi big"><span className="k">Total a pagar</span><span className="v">{formatBRL(sum(open))}</span><span className="s">{open.length} conta(s) pendente(s)</span></div>
              <div className="fx-kpi"><span className="k">Atrasadas</span><span className="v">{formatBRL(sum(overdue))}</span><span className="s">{overdue.length} conta(s)</span></div>
              <div className="fx-kpi"><span className="k">Esta semana</span><span className="v">{formatBRL(sum(week))}</span><span className="s">{week.length} conta(s)</span></div>
              <div className="fx-kpi"><span className="k">Depois</span><span className="v">{formatBRL(sum(later))}</span><span className="s">{later.length} conta(s)</span></div>
            </div>
            {groups.length ? groups.map((g) => (
              <section key={g.id} className="card" aria-label={g.title}>
                <div className="cardhd"><h2 className="h2">{g.title}</h2><span className="sm t2">{formatBRL(sum(g.bills))}</span></div>
                <BillList bills={g.bills.map(toItem)} today={today} categories={options.categories} />
              </section>
            )) : <Empty title="Nenhuma conta aberta">Cadastre uma conta ou crie uma despesa recorrente.</Empty>}
          </>
        )}
      </div>
    </>
  );
}
