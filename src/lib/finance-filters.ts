import { addDays, isValidDay, isValidMonth, type Day } from "./dates";
import type { PayMethod } from "./finance-meta";

// Filtros da lista de lançamentos vivem na URL: dá para compartilhar e o botão voltar funciona.

export type Period = "hoje" | "7d" | "mes" | "mes-passado" | "custom";

export type TxQuery = {
  periodo: Period;
  mes: string;
  de: string;
  ate: string;
  tipo: "" | "expense" | "income";
  categoria: string;
  conta: string;
  pagamento: "" | PayMethod;
  q: string;
  pagina: number;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const UUID = /^[0-9a-f-]{36}$/i;
const PAYS = new Set(["pix", "debit", "credit", "boleto", "transfer", "cash", "auto_debit"]);

export function parseTxQuery(raw: Record<string, string | string[] | undefined>, thisMonth: string): TxQuery {
  const periodo = first(raw.periodo);
  const mes = first(raw.mes);
  const de = first(raw.de);
  const ate = first(raw.ate);
  const tipo = first(raw.tipo);
  const categoria = first(raw.categoria);
  const conta = first(raw.conta);
  const pagamento = first(raw.pagamento);
  return {
    periodo: (["hoje", "7d", "mes", "mes-passado", "custom"] as const).find((p) => p === periodo) ?? "mes",
    mes: isValidMonth(mes) ? mes : thisMonth,
    de: isValidDay(de) ? de : "",
    ate: isValidDay(ate) ? ate : "",
    tipo: tipo === "expense" || tipo === "income" ? tipo : "",
    categoria: UUID.test(categoria) ? categoria : "",
    conta: UUID.test(conta) ? conta : "",
    pagamento: PAYS.has(pagamento) ? (pagamento as PayMethod) : "",
    q: first(raw.q).slice(0, 80),
    pagina: Math.max(1, Math.min(500, Number.parseInt(first(raw.pagina), 10) || 1)),
  };
}

/** Intervalo de datas do período escolhido. */
export function periodRange(q: TxQuery, today: Day): { from: Day; to: Day } {
  const month = q.mes;
  switch (q.periodo) {
    case "hoje": return { from: today, to: today };
    case "7d": return { from: addDays(today, -6), to: today };
    case "mes-passado": {
      const [y, m] = today.slice(0, 7).split("-").map(Number) as [number, number];
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      return { from: `${prev}-01`, to: lastDay(prev) };
    }
    case "custom": {
      const from = q.de || `${month}-01`;
      const to = q.ate || lastDay(month);
      return from <= to ? { from, to } : { from: to, to: from };
    }
    default: return { from: `${month}-01`, to: lastDay(month) };
  }
}

function lastDay(month: string): Day {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/** Monta a URL mantendo só o que não é padrão. */
export function txHref(base: string, q: Partial<TxQuery>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value === "" || value === undefined || (key === "pagina" && value === 1) || (key === "periodo" && value === "mes")) continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${base}?${text}` : base;
}
