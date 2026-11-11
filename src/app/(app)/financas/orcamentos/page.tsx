import type { Metadata } from "next";
import { financeContext, toOptions } from "@/components/financas/context";
import { BudgetButton, GoalsForm } from "@/components/financas/forms";
import { Badge, CatBubble, Empty, MonthNav, PageHead, PlanTabs } from "@/components/financas/ui";
import { Icon } from "@/components/ui/icon";
import { listAccounts, listBudgets, listCategories, monthRange, rollUp, spendingByLeaf } from "@/data/finance";
import { budgetState } from "@/lib/finance-meta";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Orçamentos · Finanças" };

export default async function OrcamentosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const { userId, settings, today, month } = await financeContext(mes);
  const { from, to } = monthRange(month);
  const [categories, accounts, budgets, leaves] = await Promise.all([listCategories(userId), listAccounts(userId), listBudgets(userId), spendingByLeaf(userId, from, to)]);
  const used = rollUp(categories, leaves);
  const options = toOptions(accounts, categories);
  const tops = categories.filter((c) => !c.parentId && c.type === "expense");
  const lines = tops
    .filter((c) => budgets.has(c.id))
    .map((c) => ({ c, used: used.get(c.id) ?? 0, limit: budgets.get(c.id) as number }))
    .map((l) => ({ ...l, ...budgetState(l.used, l.limit, settings.budgetAlertPct) }))
    .sort((a, b) => b.pct - a.pct);
  const without = tops.filter((c) => !budgets.has(c.id));
  const totalLimit = lines.reduce((s, l) => s + l.limit, 0);
  const totalUsed = lines.reduce((s, l) => s + l.used, 0);
  const attention = lines.filter((l) => l.tone !== "ok");
  const current = Object.fromEntries(budgets);

  return (
    <>
      <PageHead title="Planejar" sub={`${month === today.slice(0, 7) ? "Este mês" : "Mês selecionado"}`}>
        <MonthNav month={month} today={today} path="/financas/orcamentos" />
        <BudgetButton className="btn btn-p" categories={options.categories} current={current} label={<><Icon name="plus" size="s" />Definir limite</>} />
      </PageHead>
      <div className="fx-stack">
        <PlanTabs active="/financas/orcamentos" />

        <section className="card" aria-labelledby="fx-orc">
          <div className="cardhd">
            <div className="col"><h2 className="h2" id="fx-orc">Orçamentos do mês</h2><span className="sm t2">{formatBRL(totalUsed)} gastos de {formatBRL(totalLimit)} · disponível {formatBRL(Math.max(totalLimit - totalUsed, 0))}</span></div>
            <Badge>Avisar em {settings.budgetAlertPct}%</Badge>
          </div>
          {attention.length ? (
            <div className={`fx-alert${attention.some((a) => a.tone === "bad") ? " bad" : ""}`} role="status" style={{ marginBottom: 12 }}>
              <Icon name="warn" />
              <div className="col">
                <b>{attention.map((a) => a.c.name).join(" e ")} {attention.length > 1 ? "passaram" : "passou"} de {settings.budgetAlertPct}% do limite.</b>
                <span className="sm">{attention.map((a) => (a.limit >= a.used ? `Restam ${formatBRL(a.limit - a.used)} em ${a.c.name}` : `${a.c.name} passou ${formatBRL(a.used - a.limit)}`)).join(" · ")}</span>
              </div>
            </div>
          ) : null}
          {lines.length ? (
            <ul>
              {lines.map((l) => (
                <li key={l.c.id} className="fx-row" style={{ alignItems: "stretch" }}>
                  <CatBubble color={l.c.color} icon={l.c.icon} />
                  <div className="grow" style={{ gap: 6, justifyContent: "center" }}>
                    <div className="row jb wrap g8"><b>{l.c.name}</b><Badge tone={l.tone}>{l.label}</Badge></div>
                    <div className={`bar ${l.tone}`} role="progressbar" aria-label={`${l.c.name}: ${l.pct}% do limite`} aria-valuenow={Math.min(l.pct, 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(l.pct, 100)}%` }} /></div>
                    <div className="row jb wrap g8 sm t2">
                      <span>{formatBRL(l.used)} · {l.pct}% de {formatBRL(l.limit)}</span>
                      <span>{l.limit >= l.used ? `restam ${formatBRL(l.limit - l.used)}` : `estourou ${formatBRL(l.used - l.limit)}`}</span>
                    </div>
                  </div>
                  <BudgetButton className="btn btn-g btn-ic" categories={options.categories} current={current} categoryId={l.c.id} label={<Icon name="edit" />} />
                </li>
              ))}
            </ul>
          ) : <Empty title="Nenhum limite definido">Escolha quanto pode gastar por categoria e acompanhe o mês.</Empty>}
        </section>

        {without.length ? (
          <section className="card" aria-labelledby="fx-sem">
            <div className="cardhd"><h2 className="h3" id="fx-sem">Sem limite</h2></div>
            <ul>
              {without.map((c) => (
                <li key={c.id} className="fx-row">
                  <CatBubble color={c.color} icon={c.icon} />
                  <span className="grow"><b>{c.name}</b><span className="sm t2">{formatBRL(used.get(c.id) ?? 0)} no mês</span></span>
                  <BudgetButton categories={options.categories} current={current} categoryId={c.id} label="Definir limite" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <GoalsForm alertPct={settings.budgetAlertPct} savingsPct={settings.savingsGoalPct} />
      </div>
    </>
  );
}
