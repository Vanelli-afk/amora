import type { Metadata } from "next";
import { financeContext, toOptions } from "@/components/financas/context";
import { RecurringButton, type RecurringItem } from "@/components/financas/forms";
import { Badge, CatBubble, Empty, PageHead, PlanTabs } from "@/components/financas/ui";
import { Icon } from "@/components/ui/icon";
import { TransitionLink } from "@/components/ui/links";
import { listAccounts, listCategories, listRecurring } from "@/data/finance";
import { upcomingCharges } from "@/data/finance-overview";
import { RECURRING_KINDS, type RecurringKind } from "@/lib/finance-meta";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Recorrentes · Finanças" };

const FILTERS: { id: "todas" | RecurringKind; label: string }[] = [{ id: "todas", label: "Todas" }, ...RECURRING_KINDS.map((k) => ({ id: k.id, label: k.plural }))];

export default async function RecorrentesPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const { userId, today } = await financeContext();
  const [accounts, categories, all] = await Promise.all([listAccounts(userId), listCategories(userId), listRecurring(userId)]);
  const options = toOptions(accounts, categories);
  const filter = FILTERS.find((f) => f.id === tipo)?.id ?? "todas";
  const catById = new Map(options.categories.map((c) => [c.id, c]));
  const expenses = all.filter((r) => r.type === "expense" && r.active);
  const subs = expenses.filter((r) => r.kind === "subscription");
  const income = all.filter((r) => r.type === "income" && r.active);
  const next = new Map(upcomingCharges(all, today).map((c) => [c.recurring.id, c.inDays]));
  const toItem = (r: (typeof all)[number]): RecurringItem => ({ ...r });

  const shown = all.filter((r) => r.type === "expense" && (filter === "todas" || r.kind === filter));
  const groups = RECURRING_KINDS.map((k) => ({ ...k, items: shown.filter((r) => r.kind === k.id) })).filter((g) => g.items.length);
  const incomeShown = filter === "todas" ? all.filter((r) => r.type === "income") : [];

  const row = (r: (typeof all)[number]) => {
    const cat = r.categoryId ? catById.get(r.categoryId) : undefined;
    const parent = cat?.parentId ? catById.get(cat.parentId) : cat;
    const inDays = next.get(r.id);
    return (
      <li key={r.id}>
        <RecurringButton item={toItem(r)} options={options} today={today} className="fx-row" label={
          <>
            <CatBubble color={parent?.color ?? "sand"} icon={parent?.icon ?? "repeat"} />
            <span className="grow" style={{ textAlign: "left" }}><b className="ell">{r.name}</b><span className="sm t2">Todo dia {r.dayOfMonth}{inDays !== undefined ? ` · ${inDays === 0 ? "hoje" : inDays === 1 ? "amanhã" : `em ${inDays} dias`}` : ""}</span></span>
            <span className="end"><span className={`amt num ${r.type === "income" ? "pos" : ""}`}>{formatBRL(r.amountCents)}</span>{r.active ? (r.endsOn && r.endsOn < today ? <Badge>Encerrada</Badge> : <Badge tone="ok">Ativa</Badge>) : <Badge>Pausada</Badge>}</span>
          </>
        } />
      </li>
    );
  };

  return (
    <>
      <PageHead title="Planejar" sub="Todo mês, sem esquecer">
        <RecurringButton className="btn btn-p" options={options} today={today} label={<><Icon name="plus" size="s" />Nova recorrente</>} />
      </PageHead>
      <div className="fx-stack">
        <PlanTabs active="/financas/recorrentes" />
        <div className="fx-kpis">
          <div className="fx-kpi big"><span className="k">Compromissos fixos por mês</span><span className="v">{formatBRL(expenses.reduce((s, r) => s + r.amountCents, 0))}</span><span className="s">{expenses.length} despesa(s) recorrente(s)</span></div>
          <div className="fx-kpi"><span className="k">Assinaturas</span><span className="v">{formatBRL(subs.reduce((s, r) => s + r.amountCents, 0))}</span><span className="s">{subs.length} serviço(s) ativo(s)</span></div>
          <div className="fx-kpi"><span className="k">Receita fixa</span><span className="v pos">{formatBRL(income.reduce((s, r) => s + r.amountCents, 0))}</span><span className="s">{income.map((r) => `${r.name}, todo dia ${r.dayOfMonth}`).join(" · ") || "Nenhuma cadastrada"}</span></div>
        </div>
        <div className="fx-chips" role="group" aria-label="Grupo">
          {FILTERS.map((f) => <TransitionLink key={f.id} className={`chip${filter === f.id ? " on" : ""}`} href={f.id === "todas" ? "/financas/recorrentes" : `/financas/recorrentes?tipo=${f.id}`}>{f.label}</TransitionLink>)}
        </div>
        {groups.map((g) => (
          <section key={g.id} className="card" aria-label={g.plural}>
            <div className="cardhd"><h2 className="h2">{g.plural}</h2><span className="sm t2 b">{formatBRL(g.items.filter((r) => r.active).reduce((s, r) => s + r.amountCents, 0))}</span></div>
            <ul>{g.items.map(row)}</ul>
          </section>
        ))}
        {incomeShown.length ? (
          <section className="card" aria-label="Receitas fixas"><div className="cardhd"><h2 className="h2">Receitas fixas</h2></div><ul>{incomeShown.map(row)}</ul></section>
        ) : null}
        {!groups.length && !incomeShown.length ? <Empty title="Nenhuma recorrente">Cadastre aluguel, assinaturas e mensalidades para as contas nascerem sozinhas.</Empty> : null}
        <p className="hint">Toque em um item para editar, pausar ou encerrar a recorrência.</p>
      </div>
    </>
  );
}
