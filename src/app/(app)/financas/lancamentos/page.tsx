import type { Metadata } from "next";
import { financeContext } from "@/components/financas/context";
import { Badge, CatBubble, Empty, NewTxButton, PageHead } from "@/components/financas/ui";
import { Icon } from "@/components/ui/icon";
import { OverlayLink, TransitionLink } from "@/components/ui/links";
import { listAccounts, listCategories, listTransactions } from "@/data/finance";
import { formatMonthYear, formatShortDay } from "@/lib/dates";
import { PAY_METHODS, payLabel } from "@/lib/finance-meta";
import { parseTxQuery, periodRange, txHref, type Period } from "@/lib/finance-filters";
import { formatBRL, formatSigned } from "@/lib/money";

export const metadata: Metadata = { title: "Lançamentos · Finanças" };

const PERIODS: { id: Period; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "mes", label: "Este mês" },
  { id: "mes-passado", label: "Mês passado" },
  { id: "custom", label: "Personalizado" },
];
const PAGE = 12;
const BASE = "/financas/lancamentos";

export default async function LancamentosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const { userId, today } = await financeContext();
  const q = parseTxQuery(raw, today.slice(0, 7));
  const range = periodRange(q, today);
  const [accounts, categories, result] = await Promise.all([
    listAccounts(userId),
    listCategories(userId),
    listTransactions(userId, {
      from: range.from, to: range.to, type: q.tipo || undefined, categoryId: q.categoria || undefined,
      accountId: q.conta || undefined, payMethod: q.pagamento || undefined, q: q.q || undefined,
    }, q.pagina, PAGE),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const pages = Math.max(1, Math.ceil(result.total / PAGE));
  const active = [q.tipo, q.categoria, q.conta, q.pagamento, q.q].filter(Boolean).length;
  const exportHref = txHref("/api/financas/exportar", { ...q, pagina: 1 });
  const title = q.periodo === "mes" ? formatMonthYear(q.mes) : PERIODS.find((p) => p.id === q.periodo)?.label ?? "";

  return (
    <>
      <PageHead title="Lançamentos" sub={`${title} · ${result.total} lançamento(s)`}>
        <a className="btn btn-s" href={exportHref} download><Icon name="download" size="s" />Exportar</a>
        <NewTxButton />
      </PageHead>

      <div className="fx-stack">
        <div className="fx-kpis">
          <div className="fx-kpi"><span className="k">Entradas</span><span className="v pos">+ {formatBRL(result.incomeCents)}</span></div>
          <div className="fx-kpi"><span className="k">Saídas</span><span className="v">− {formatBRL(result.expenseCents)}</span></div>
          <div className="fx-kpi"><span className="k">Resultado do período</span><span className="v">{formatBRL(result.incomeCents - result.expenseCents)}</span></div>
        </div>

        <div className="fx-chips" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <TransitionLink key={p.id} className={`chip${q.periodo === p.id ? " on" : ""}`} href={txHref(BASE, { ...q, periodo: p.id, pagina: 1 })}>{p.label}</TransitionLink>
          ))}
        </div>

        <details className="card" open={active > 0 || q.periodo === "custom"}>
          <summary className="row jb" style={{ cursor: "pointer", minHeight: 44 }}>
            <b className="h3">Filtros</b>{active ? <Badge tone="info">{active} ativo(s)</Badge> : null}
          </summary>
          <form method="get" action={BASE} className="fx-filter" style={{ marginTop: 12 }}>
            <input type="hidden" name="periodo" value={q.periodo} />
            {q.periodo === "custom" ? (
              <>
                <div><label className="lbl" htmlFor="f-de">De</label><input id="f-de" className="inp" type="date" name="de" defaultValue={range.from} /></div>
                <div><label className="lbl" htmlFor="f-ate">Até</label><input id="f-ate" className="inp" type="date" name="ate" defaultValue={range.to} /></div>
              </>
            ) : null}
            <div><label className="lbl" htmlFor="f-q">Buscar lançamento</label><input id="f-q" className="inp" type="search" name="q" defaultValue={q.q} placeholder="Descrição ou observação" /></div>
            <div>
              <label className="lbl" htmlFor="f-tipo">Tipo</label>
              <select id="f-tipo" className="inp" name="tipo" defaultValue={q.tipo}>
                <option value="">Todos</option><option value="income">Entradas</option><option value="expense">Saídas</option>
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="f-cat">Categoria</label>
              <select id="f-cat" className="inp" name="categoria" defaultValue={q.categoria}>
                <option value="">Todas</option>
                {categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="f-conta">Conta</label>
              <select id="f-conta" className="inp" name="conta" defaultValue={q.conta}>
                <option value="">Todas</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="f-pag">Forma de pagamento</label>
              <select id="f-pag" className="inp" name="pagamento" defaultValue={q.pagamento}>
                <option value="">Todas</option>
                {PAY_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="row g8">
              <TransitionLink className="btn btn-s" href={txHref(BASE, { periodo: q.periodo, mes: q.mes })}>Limpar</TransitionLink>
              <button type="submit" className="btn btn-p">Aplicar</button>
            </div>
          </form>
        </details>

        <section className="card" aria-labelledby="fx-todos">
          <div className="cardhd"><h2 className="h2" id="fx-todos">Todos os lançamentos</h2></div>
          {result.rows.length ? (
            <>
              <div className="tx-head" aria-hidden="true">
                <span>Descrição</span><span>Categoria</span><span>Conta</span><span>Pagamento</span><span>Data</span><span style={{ textAlign: "right" }}>Valor</span>
              </div>
              <ul>
                {result.rows.map((t) => {
                  const cat = t.categoryId ? byId.get(t.categoryId) : undefined;
                  const top = cat?.parentId ? byId.get(cat.parentId) : cat;
                  const catName = cat ? (top && top.id !== cat.id ? `${top.name} › ${cat.name}` : cat.name) : "Sem categoria";
                  return (
                    <li key={t.id}>
                      <OverlayLink className="tx-row" params={{ lancamento: t.id }}>
                        <span className="n">
                          <CatBubble color={top?.color ?? "sand"} icon={top?.icon ?? "grid"} />
                          <span className="t"><b className="ell">{t.description}</b><span className="sm t2 ell mobile-meta">{catName} · {formatShortDay(t.date)}</span></span>
                        </span>
                        <span className="col-cat sm ell">{catName}</span>
                        <span className="col-acc sm ell">{accountName.get(t.accountId) ?? "—"}</span>
                        <span className="col-pay sm ell">{payLabel(t.payMethod)}</span>
                        <span className="col-date sm num">{t.date.slice(8, 10)}/{t.date.slice(5, 7)}</span>
                        <span className={`amt num ${t.type === "income" ? "pos" : ""}`}>{formatSigned(t.amountCents, t.type)}</span>
                      </OverlayLink>
                    </li>
                  );
                })}
              </ul>
              <nav className="row jb" style={{ marginTop: 12 }} aria-label="Páginas">
                <span className="sm t2">Mostrando {(q.pagina - 1) * PAGE + 1}–{(q.pagina - 1) * PAGE + result.rows.length} de {result.total}</span>
                <span className="row g8">
                  {q.pagina > 1 ? <TransitionLink className="btn btn-s btn-ic" href={txHref(BASE, { ...q, pagina: q.pagina - 1 })} aria-label="Página anterior"><Icon name="left" /></TransitionLink> : null}
                  <span className="sm b">{q.pagina} / {pages}</span>
                  {q.pagina < pages ? <TransitionLink className="btn btn-s btn-ic" href={txHref(BASE, { ...q, pagina: q.pagina + 1 })} aria-label="Próxima página"><Icon name="right" /></TransitionLink> : null}
                </span>
              </nav>
            </>
          ) : <Empty title="Nenhum lançamento">Ajuste os filtros ou registre um novo lançamento.</Empty>}
        </section>
      </div>
    </>
  );
}
