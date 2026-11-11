import { listAccounts, listCategories, listTransactions } from "@/data/finance";
import { getSettings } from "@/data/settings";
import { todayIn } from "@/lib/dates";
import { payLabel } from "@/lib/finance-meta";
import { parseTxQuery, periodRange } from "@/lib/finance-filters";
import { formatCents } from "@/lib/money";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Planilhas interpretam =, +, - e @ no início como fórmula: o apóstrofo neutraliza.
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV dos lançamentos com os mesmos filtros da tela. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  const userId = session.user.id;

  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const { timezone } = await getSettings(userId);
  const today = todayIn(timezone);
  const q = parseTxQuery(raw, today.slice(0, 7));
  const range = periodRange(q, today);

  const [accounts, categories, result] = await Promise.all([
    listAccounts(userId, true),
    listCategories(userId),
    listTransactions(userId, {
      from: range.from, to: range.to, type: q.tipo || undefined, categoryId: q.categoria || undefined,
      accountId: q.conta || undefined, payMethod: q.pagamento || undefined, q: q.q || undefined,
    }, 1, 20_000),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const lines = [["Data", "Tipo", "Descrição", "Categoria", "Conta", "Pagamento", "Valor (R$)", "Observação"].map(cell).join(";")];
  for (const t of result.rows) {
    const cat = t.categoryId ? byId.get(t.categoryId) : undefined;
    const parent = cat?.parentId ? byId.get(cat.parentId) : undefined;
    lines.push([
      t.date, t.type === "income" ? "Receita" : "Despesa", t.description,
      cat ? (parent ? `${parent.name} › ${cat.name}` : cat.name) : "",
      accountName.get(t.accountId) ?? "", payLabel(t.payMethod),
      `${t.type === "income" ? "" : "-"}${formatCents(t.amountCents)}`, t.note ?? "",
    ].map(cell).join(";"));
  }

  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lancamentos-${range.from}_${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
