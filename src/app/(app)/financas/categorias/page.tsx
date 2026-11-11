import type { Metadata } from "next";
import { financeContext } from "@/components/financas/context";
import { CategoryButton, type CategoryOpt } from "@/components/financas/forms";
import { CatBubble, Empty, MonthNav, PageHead, PlanTabs } from "@/components/financas/ui";
import { Icon } from "@/components/ui/icon";
import { listCategories, monthRange, rollUp, spendingByLeaf } from "@/data/finance";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = { title: "Categorias · Finanças" };

export default async function CategoriasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const { userId, today, month } = await financeContext(mes);
  const { from, to } = monthRange(month);
  const [categories, expense, income] = await Promise.all([
    listCategories(userId), spendingByLeaf(userId, from, to, "expense"), spendingByLeaf(userId, from, to, "income"),
  ]);
  const opt = (c: (typeof categories)[number]): CategoryOpt => ({ id: c.id, parentId: c.parentId, type: c.type, name: c.name, color: c.color, icon: c.icon });
  const topExpense = rollUp(categories, expense);
  const topIncome = rollUp(categories, income);
  const expenses = categories.filter((c) => !c.parentId && c.type === "expense");
  const incomes = categories.filter((c) => !c.parentId && c.type === "income");
  const subsCount = categories.filter((c) => c.parentId).length;

  return (
    <>
      <PageHead title="Planejar" sub={`${expenses.length + incomes.length} categorias e ${subsCount} subcategorias`}>
        <MonthNav month={month} today={today} path="/financas/categorias" />
        <CategoryButton className="btn btn-p" label={<><Icon name="plus" size="s" />Nova categoria</>} />
      </PageHead>
      <div className="fx-stack">
        <PlanTabs active="/financas/categorias" />
        <h2 className="h2">Despesas</h2>
        {expenses.length ? (
          <div className="cat-grid">
            {expenses.map((c) => {
              const subs = categories.filter((s) => s.parentId === c.id);
              return (
                <section key={c.id} className="card" aria-label={c.name}>
                  <div className="row g12">
                    <CatBubble color={c.color} icon={c.icon} large />
                    <div className="grow col"><b className="h3">{c.name}</b><span className="sm t2">{subs.length} subcategoria(s)</span></div>
                    <span className="amt num b">{formatBRL(topExpense.get(c.id) ?? 0)}</span>
                    <CategoryButton className="btn btn-g btn-ic" category={opt(c)} label={<Icon name="edit" />} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {subs.map((s) => (
                      <div key={s.id} className="sub-row">
                        <span className="ell">{s.name}</span>
                        <b>{formatBRL(expense.get(s.id) ?? 0)}</b>
                        <CategoryButton className="btn btn-g btn-ic" category={opt(s)} label={<Icon name="edit" size="s" />} />
                      </div>
                    ))}
                    <div className="sub-row" style={{ paddingLeft: 0 }}>
                      <CategoryButton className="btn btn-g" parent={opt(c)} label={<><Icon name="plus" size="s" />Adicionar subcategoria</>} />
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        ) : <Empty title="Nenhuma categoria de despesa">Crie a primeira para organizar seus gastos.</Empty>}

        <h2 className="h2">Receitas</h2>
        <section className="card" aria-label="Receitas">
          <div className="cardhd"><span className="sm t2">Total do mês: {formatBRL([...topIncome.values()].reduce((s, v) => s + v, 0))}</span><CategoryButton type="income" label={<><Icon name="plus" size="s" />Nova categoria</>} /></div>
          {incomes.length ? (
            <ul>
              {incomes.map((c) => (
                <li key={c.id} className="fx-row">
                  <CatBubble color={c.color} icon={c.icon} />
                  <span className="grow"><b>{c.name}</b></span>
                  <span className="amt num">{formatBRL(topIncome.get(c.id) ?? 0)}</span>
                  <CategoryButton className="btn btn-g btn-ic" category={opt(c)} label={<Icon name="edit" />} />
                </li>
              ))}
            </ul>
          ) : <Empty title="Nenhuma categoria de receita" />}
        </section>
      </div>
    </>
  );
}
