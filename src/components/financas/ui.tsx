import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { OverlayLink, TransitionLink } from "@/components/ui/links";
import { addMonths, formatMonthYear, type Month } from "@/lib/dates";
import { categoryIcon, type Tone } from "@/lib/finance-meta";
import { formatBRL, formatSigned } from "@/lib/money";
import type { ColorId } from "@/lib/palette";

export const colorVar = (color: ColorId) => `var(--${color}-e)`;

export function Badge({ tone = "", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`bdg${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

export function CatBubble({ color, icon, large }: { color: ColorId; icon: string; large?: boolean }) {
  return <span className={`ibub c-${color}${large ? " lg" : ""}`}><Icon name={categoryIcon(icon)} /></span>;
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="dtop">
      <div className="col">
        <h1 className="page-title">{title}</h1>
        {sub ? <span className="sm t2 b">{sub}</span> : null}
      </div>
      {children ? <div className="row g8 wrap">{children}</div> : null}
    </div>
  );
}

/** Troca de mês por link (?mes=YYYY-MM): funciona sem JavaScript e dá endereço a cada mês. */
export function MonthNav({ month, today, path }: { month: Month; today: string; path: string }) {
  const href = (m: Month) => (m === today.slice(0, 7) ? path : `${path}?mes=${m}`);
  return (
    <div className="fx-month" role="group" aria-label="Mês">
      <TransitionLink className="btn btn-s btn-ic" href={href(addMonths(month, -1))} aria-label="Mês anterior"><Icon name="left" /></TransitionLink>
      <b>{formatMonthYear(month)}</b>
      <TransitionLink className="btn btn-s btn-ic" href={href(addMonths(month, 1))} aria-label="Próximo mês"><Icon name="right" /></TransitionLink>
    </div>
  );
}

const PLAN_TABS = [
  { href: "/financas/orcamentos", label: "Orçamentos" },
  { href: "/financas/categorias", label: "Categorias" },
  { href: "/financas/contas", label: "Contas a pagar" },
  { href: "/financas/recorrentes", label: "Recorrentes" },
] as const;

/** Troca entre as telas de planejamento; no celular vira o seletor do topo, como no design. */
export function PlanTabs({ active }: { active: (typeof PLAN_TABS)[number]["href"] }) {
  return (
    <nav className="tabs" aria-label="Planejar" style={{ overflowX: "auto" }}>
      {PLAN_TABS.map((tab) => (
        <TransitionLink key={tab.href} href={tab.href} className={`tab${tab.href === active ? " on" : ""}`} aria-current={tab.href === active ? "page" : undefined}>
          {tab.label}
        </TransitionLink>
      ))}
    </nav>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function Amount({ cents, type }: { cents: number; type: "expense" | "income" }) {
  return <span className={`amt num ${type === "income" ? "pos" : "neg"}`}>{formatSigned(cents, type)}</span>;
}

export function Money({ cents }: { cents: number }) {
  return <span className="num">{formatBRL(cents)}</span>;
}

export function NewTxButton({ className = "btn btn-p only-desktop" }: { className?: string }) {
  return <OverlayLink className={className} params={{ novo: "lancamento" }}><Icon name="plus" size="s" />Novo lançamento</OverlayLink>;
}
