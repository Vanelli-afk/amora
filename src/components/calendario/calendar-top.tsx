import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { OverlayLink } from "@/components/ui/links";

export function CalendarTop({ title, subtitle, prevHref, nextHref, prevLabel, nextLabel, view, monthHref, weekHref, date }: {
  title: ReactNode;
  subtitle?: string;
  prevHref: string;
  nextHref: string;
  prevLabel: string;
  nextLabel: string;
  view: "mes" | "semana";
  monthHref: string;
  weekHref: string;
  date: string;
}) {
  return (
    <div className="dtop">
      <div className="row g12 wrap">
        <div className="row g4">
          <Link className="btn btn-s btn-ic" href={prevHref} aria-label={prevLabel} prefetch><Icon name="left" /></Link>
          <Link className="btn btn-s" href="/calendario">Hoje</Link>
          <Link className="btn btn-s btn-ic" href={nextHref} aria-label={nextLabel} prefetch><Icon name="right" /></Link>
        </div>
        <div className="col">
          <h1 className="page-title">{title}</h1>
          {subtitle ? <span className="xs t2 b">{subtitle}</span> : null}
        </div>
      </div>
      <div className="row g12">
        <nav className="tabs tabs-sm" aria-label="Visão do calendário">
          <Link className={`tab${view === "mes" ? " on" : ""}`} href={monthHref} aria-current={view === "mes" ? "page" : undefined}>Mês</Link>
          <Link className={`tab${view === "semana" ? " on" : ""}`} href={weekHref} aria-current={view === "semana" ? "page" : undefined}>Semana</Link>
        </nav>
        <OverlayLink className="btn btn-p only-desktop" params={{ novo: "compromisso", data: date }}><Icon name="plus" size="s" />Novo item</OverlayLink>
      </div>
    </div>
  );
}
