import { Icon } from "@/components/ui/icon";
import { OverlayLink, TransitionLink } from "@/components/ui/links";
import type { Overview } from "@/data/finance-overview";
import { MONTHS_SHORT, formatDayMonth, formatShortDay, formatMonthYear } from "@/lib/dates";
import { billBadge, payLabel } from "@/lib/finance-meta";
import { formatBRL, formatSigned } from "@/lib/money";
import { AccountsButton } from "./forms";
import { Donut, GroupedBars, monthLabel } from "./charts";
import { Evolution } from "./evolution";
import { Badge, CatBubble, colorVar, Empty } from "./ui";

const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

export function TxList({ o, rows }: { o: Overview; rows: Overview["recent"] }) {
  if (!rows.length) return <Empty title="Nada por aqui ainda">Os lançamentos do mês aparecem nesta lista.</Empty>;
  return (
    <ul>
      {rows.map((t) => {
        const cat = t.categoryId ? o.byId.get(t.categoryId) : undefined;
        const parent = cat?.parentId ? o.byId.get(cat.parentId) : undefined;
        return (
          <li key={t.id}>
            <OverlayLink className="fx-row" params={{ lancamento: t.id }}>
              <CatBubble color={(parent ?? cat)?.color ?? "sand"} icon={(parent ?? cat)?.icon ?? "grid"} />
              <span className="grow"><b className="ell">{t.description}</b><span className="sm t2 ell">{cat?.name ?? "Sem categoria"} · {payLabel(t.payMethod)} · {formatShortDay(t.date)}</span></span>
              <span className={`amt num ${t.type === "income" ? "pos" : ""}`}>{formatSigned(t.amountCents, t.type)}</span>
            </OverlayLink>
          </li>
        );
      })}
    </ul>
  );
}

/** Resumo: saldo, entradas e saídas, contas a vencer, últimos lançamentos e próximas cobranças. */
export function SummarySection({ o, accountsOpt }: { o: Overview; accountsOpt: Parameters<typeof AccountsButton>[0]["accounts"] }) {
  const ratio = o.incomeCents > 0 ? (o.expenseCents / o.incomeCents) * 100 : 0;
  return (
    <div className="fx-stack">
      <div className="fx-kpis">
        <div className="fx-kpi big" style={{ gridColumn: "span 2" }}>
          <span className="k">Saldo atual</span>
          <span className="v">{formatBRL(o.balanceCents)}</span>
          <span className="s">{o.savedCents >= 0 ? "+" : "−"} {formatBRL(Math.abs(o.savedCents)).replace("−", "")} neste mês{o.incomeCents > 0 ? ` · economia de ${pct(o.savingsPct)}` : ""}</span>
          <div className="row g8 wrap" style={{ marginTop: 8 }}>
            {o.accounts.map((a) => <Badge key={a.id}>{a.name} · {formatBRL(a.balanceCents)}</Badge>)}
            <AccountsButton accounts={accountsOpt} />
          </div>
        </div>
        <div className="fx-kpi"><span className="k">Receitas do mês</span><span className="v pos">{formatBRL(o.incomeCents)}</span><span className="s">{o.prevTotals.incomeCents ? `Mês passado: ${formatBRL(o.prevTotals.incomeCents)}` : "Sem comparação"}</span></div>
        <div className="fx-kpi"><span className="k">Despesas do mês</span><span className="v">{formatBRL(o.expenseCents)}</span><span className="s">{o.incomeCents ? `${pct(ratio)} das receitas` : "Sem receitas no mês"}</span></div>
      </div>

      <div className="fx-cols">
        <section className="card" aria-labelledby="fx-vencer">
          <div className="cardhd">
            <div className="col"><h2 className="h2" id="fx-vencer">Contas a vencer</h2><span className="sm t2">{o.openBills.length} pendentes · {formatBRL(o.openBillsTotal)}{o.overdueCount ? ` · ${o.overdueCount} atrasada(s)` : ""}</span></div>
            <TransitionLink className="btn btn-g" href="/financas/contas">Ver todas</TransitionLink>
          </div>
          {o.upcomingBills.length ? (
            <ul>
              {o.upcomingBills.map((b) => {
                const badge = billBadge(b.dueDate, o.today, false);
                const cat = b.categoryId ? o.byId.get(b.categoryId) : undefined;
                return (
                  <li key={b.id} className="fx-row">
                    <CatBubble color={cat?.color ?? "sand"} icon={cat?.icon ?? "receipt"} />
                    <span className="grow"><b className="ell">{b.name}</b><span className="sm t2">{formatDayMonth(b.dueDate)}</span></span>
                    <span className="end"><span className="amt">{formatBRL(b.amountCents)}</span><Badge tone={badge.tone}>{badge.label}</Badge></span>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="Tudo pago">Nenhuma conta aberta no momento.</Empty>}
        </section>

        <section className="card" aria-labelledby="fx-prox">
          <div className="cardhd"><h2 className="h2" id="fx-prox">Próximas cobranças</h2><TransitionLink className="btn btn-g" href="/financas/recorrentes">Ver recorrentes<Icon name="right" size="s" /></TransitionLink></div>
          {o.nextCharges.length ? (
            <ul>
              {o.nextCharges.map(({ recurring: r, date, inDays }) => (
                <li key={r.id} className="fx-row">
                  <span className="date-tile"><small>{MONTHS_SHORT[Number(date.slice(5, 7)) - 1]}</small><b>{date.slice(8, 10)}</b></span>
                  <span className="grow"><b className="ell">{r.name}</b><span className="sm t2">{inDays === 0 ? "Hoje" : inDays === 1 ? "Amanhã" : `Em ${inDays} dias`}</span></span>
                  <span className="amt">{formatBRL(r.amountCents)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty title="Sem cobranças fixas">Cadastre assinaturas e contas que se repetem todo mês.</Empty>}
        </section>
      </div>

      <section className="card" aria-labelledby="fx-ult">
        <div className="cardhd"><h2 className="h2" id="fx-ult">Últimos lançamentos</h2><TransitionLink className="btn btn-g" href="/financas/lancamentos">Ver todos</TransitionLink></div>
        <TxList o={o} rows={o.recent} />
      </section>
    </div>
  );
}

/** Análises: evolução, receitas × despesas, categorias, economia e orçamentos perto do limite. */
export function AnalysisSection({ o, savingsGoalPct }: { o: Overview; savingsGoalPct: number }) {
  const slices = o.spending.map((s) => ({ id: s.id, label: s.name, value: s.totalCents, color: colorVar(s.color) }));
  const near = o.budgetLines.filter((b) => b.tone !== "ok").slice(0, 4);
  const reached = o.incomeCents > 0 && o.savingsPct >= savingsGoalPct;
  const peak = o.biggestMonth && o.biggestMonth.expenseCents > 0 ? o.biggestMonth : null;
  const six = o.series.slice(-6);

  return (
    <div className="fx-stack">
      <div className="fx-cols">
        <section className="card" aria-labelledby="fx-evo">
          <div className="cardhd"><div className="col"><h2 className="h2" id="fx-evo">Evolução das despesas</h2>{peak ? <span className="sm t2">{formatMonthYear(peak.month)} foi o mês de maior gasto: {formatBRL(peak.expenseCents)}</span> : null}</div></div>
          <Evolution series={o.series} />
        </section>
        <section className="card" aria-labelledby="fx-rxd">
          <div className="cardhd"><h2 className="h2" id="fx-rxd">Receitas × despesas</h2></div>
          <GroupedBars label="Receitas e despesas dos últimos 6 meses" data={six.map((p) => ({ label: monthLabel(p.month), income: p.incomeCents, expense: p.expenseCents }))} />
          <div className="legend" style={{ marginTop: 8 }}><span><i style={{ ["--lg" as string]: "var(--sage-e)" }} />Receitas</span><span><i style={{ ["--lg" as string]: "var(--coral)" }} />Despesas</span></div>
        </section>
      </div>

      <div className="fx-cols">
        <section className="card" aria-labelledby="fx-cat">
          <div className="cardhd"><h2 className="h2" id="fx-cat">Gastos por categoria</h2></div>
          {slices.length ? <Donut slices={slices} centerLabel="Total" label="Gastos do mês por categoria" /> : <Empty title="Sem despesas no mês" />}
        </section>
        <div className="fx-stack">
          <section className="card" aria-labelledby="fx-eco">
            <div className="cardhd"><h2 className="h2" id="fx-eco">Economia do mês</h2>{o.incomeCents > 0 ? <Badge tone={reached ? "ok" : "warn"}>{reached ? `Meta de ${savingsGoalPct}% atingida` : `Meta de ${savingsGoalPct}%`}</Badge> : null}</div>
            <div className="fx-kpi" style={{ padding: 0, boxShadow: "none" }}>
              <span className="v">{formatBRL(o.savedCents)}</span>
              <span className="s">{o.incomeCents > 0 ? `${pct(o.savingsPct)} da receita · meta ${savingsGoalPct}%` : "Registre receitas para ver a economia"}</span>
            </div>
            <div className={`bar ${reached ? "ok" : "warn"}`} style={{ marginTop: 10 }}><i style={{ width: `${Math.max(0, Math.min(100, savingsGoalPct ? (o.savingsPct / savingsGoalPct) * 100 : 0))}%` }} /></div>
          </section>
          <section className="card" aria-labelledby="fx-orc">
            <div className="cardhd"><h2 className="h2" id="fx-orc">Orçamentos</h2><TransitionLink className="btn btn-g" href="/financas/orcamentos">Ver todos</TransitionLink></div>
            {near.length ? (
              <ul>
                {near.map((b) => (
                  <li key={b.id} className="fx-row">
                    <CatBubble color={b.color} icon={b.icon} />
                    <span className="grow"><b>{b.name}</b><span className="sm t2">{b.pct}% usado</span></span>
                    <Badge tone={b.tone}>{b.label}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="t2">{o.budgetLines.length ? "Nenhum orçamento perto do limite." : "Defina limites por categoria em Orçamentos."}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
