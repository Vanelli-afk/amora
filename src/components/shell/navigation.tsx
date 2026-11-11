"use client";

import { AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, PlantArt, type IconName } from "@/components/ui/icon";
import { OverlayLink, TransitionLink } from "@/components/ui/links";
import { Overlay } from "@/components/ui/overlay";
import { openSearch } from "./search-palette";

const MAIN: { href: string; label: string; icon: IconName; match: string[] }[] = [
  { href: "/hoje", label: "Hoje", icon: "sun", match: ["/hoje", "/dia"] },
  { href: "/calendario", label: "Calendário", icon: "calendar", match: ["/calendario"] },
  { href: "/tarefas", label: "Tarefas", icon: "tasks", match: ["/tarefas"] },
  { href: "/notas", label: "Notas", icon: "note", match: ["/notas"] },
  { href: "/livros", label: "Livros", icon: "book", match: ["/livros"] },
  { href: "/financas", label: "Finanças", icon: "wallet", match: ["/financas"] },
  { href: "/pets", label: "Pets", icon: "paw", match: ["/pets"] },
  { href: "/perfil", label: "Perfil", icon: "user", match: ["/perfil"] },
];

type NavItem = { href: string; label: string; icon: IconName; match: string[]; exact?: boolean };

/** Dentro de /financas e /pets, o menu muda de contexto: submenu na lateral e barra inferior própria. */
type Section = {
  base: string;
  title: string;
  items: NavItem[];
  bottomLeft: NavItem[];
  bottomRight: NavItem;
  fab: { label: string; novo: string };
  more: NavItem[];
};

const FINANCAS: Section = (() => {
  const resumo: NavItem = { href: "/financas", label: "Resumo", icon: "home", match: ["/financas"], exact: true };
  const analises: NavItem = { href: "/financas/analises", label: "Análises", icon: "chart", match: ["/financas/analises"] };
  const lancamentos: NavItem = { href: "/financas/lancamentos", label: "Lançamentos", icon: "list", match: ["/financas/lancamentos"] };
  const orcamentos: NavItem = { href: "/financas/orcamentos", label: "Orçamentos", icon: "budget", match: ["/financas/orcamentos"] };
  const categorias: NavItem = { href: "/financas/categorias", label: "Categorias", icon: "grid", match: ["/financas/categorias"] };
  const contas: NavItem = { href: "/financas/contas", label: "Contas a pagar", icon: "receipt", match: ["/financas/contas"] };
  const recorrentes: NavItem = { href: "/financas/recorrentes", label: "Recorrentes", icon: "repeat", match: ["/financas/recorrentes"] };
  return {
    base: "/financas",
    title: "Finanças",
    items: [resumo, analises, lancamentos, orcamentos, categorias, contas, recorrentes],
    bottomLeft: [resumo, lancamentos],
    bottomRight: { href: "/financas/orcamentos", label: "Planejar", icon: "budget", match: ["/financas/orcamentos", "/financas/categorias"] },
    fab: { label: "Novo lançamento", novo: "lancamento" },
    more: [analises, contas, recorrentes],
  };
})();

const PETS: Section = (() => {
  const inicio: NavItem = { href: "/pets", label: "Visão geral", icon: "home", match: ["/pets"], exact: true };
  const lista: NavItem = { href: "/pets/lista", label: "Meus pets", icon: "paw", match: ["/pets/lista", "/pets/novo"] };
  const agenda: NavItem = { href: "/pets/agenda", label: "Agenda", icon: "calendar", match: ["/pets/agenda"] };
  const gastos: NavItem = { href: "/pets/gastos", label: "Gastos", icon: "wallet", match: ["/pets/gastos"] };
  return {
    base: "/pets",
    title: "Pets",
    items: [inicio, lista, agenda, gastos],
    bottomLeft: [{ ...inicio, label: "Início" }, lista],
    bottomRight: agenda,
    fab: { label: "Novo compromisso", novo: "pet-compromisso" },
    more: [gastos],
  };
})();

const sectionFor = (pathname: string): Section | null =>
  [FINANCAS, PETS].find((s) => pathname === s.base || pathname.startsWith(`${s.base}/`)) ?? null;

const isActive = (pathname: string, match: string[], exact = false) =>
  match.some((m) => pathname === m || (!exact && pathname.startsWith(`${m}/`)));

const itemActive = (pathname: string, item: NavItem) => isActive(pathname, item.match, item.exact);

export function Logo() {
  return <span className="logo"><Icon name="bookmark" size="l" />Amora</span>;
}

type User = { name: string; email: string; image?: string | null };

export function Avatar({ user, large }: { user: Pick<User, "name" | "image">; large?: boolean }) {
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";
  return (
    <span className={`av${large ? " lg" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem privada, servida com checagem de dono */}
      {user.image ? <img src={user.image} alt="" /> : initial}
    </span>
  );
}

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  return (
    <aside className="sb" aria-label="Navegação principal">
      <Logo />
      {MAIN.map((item) => {
        const active = isActive(pathname, item.match);
        return (
          <TransitionLink key={item.href} className={`sl${active ? " on" : ""}`} href={item.href} aria-current={active ? "page" : undefined} title={item.label}>
            <Icon name={item.icon} />{item.label}
          </TransitionLink>
        );
      })}
      {section ? (
        <>
          <span className="sbh">{section.title}</span>
          {section.items.map((item) => {
            const active = itemActive(pathname, item);
            return (
              <TransitionLink key={item.href} className={`sl sub${active ? " on" : ""}`} href={item.href} aria-current={active ? "page" : undefined} title={item.label}>
                <Icon name={item.icon} />{item.label}
              </TransitionLink>
            );
          })}
        </>
      ) : null}
      <span className="sbh">Atalhos</span>
      <OverlayLink className="sl" params={{ novo: "compromisso" }} title="Novo item (N)">
        <Icon name="plus" />Novo item<span className="kbd">N</span>
      </OverlayLink>
      <TransitionLink className="sl" href="/hoje" title="Ir para hoje (H)">
        <Icon name="check" />Ir para hoje<span className="kbd">H</span>
      </TransitionLink>
      <button type="button" className="sl" onClick={openSearch} title="Buscar (/)">
        <Icon name="search" />Buscar<span className="kbd">/</span>
      </button>
      <div className="sb-spacer"><PlantArt /></div>
      <TransitionLink className="me" href="/perfil" style={{ marginTop: 0 }} title="Perfil">
        <Avatar user={user} />
        <div className="col" style={{ minWidth: 0 }}>
          <b className="sm ell">{user.name}</b>
          <span className="xs t2 ell">{user.email}</span>
        </div>
      </TransitionLink>
    </aside>
  );
}

export function MobileTop({ user }: { user: User }) {
  return (
    <header className="mtop">
      <TransitionLink href="/hoje" aria-label="Amora, ir para hoje"><Logo /></TransitionLink>
      <div className="row g4">
        <button type="button" className="btn btn-g btn-ic" aria-label="Buscar" onClick={openSearch}><Icon name="search" /></button>
        <TransitionLink href="/perfil" aria-label="Perfil" className="btn btn-ic"><Avatar user={user} /></TransitionLink>
      </div>
    </header>
  );
}

const BOTTOM: { href: string; label: string; icon: IconName; match: string[] }[] = [
  MAIN[0] as (typeof MAIN)[number],
  MAIN[1] as (typeof MAIN)[number],
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const section = sectionFor(pathname);

  const left: NavItem[] = section ? section.bottomLeft : BOTTOM;
  const right: NavItem = section ? section.bottomRight : { href: "/tarefas", label: "Tarefas", icon: "tasks", match: ["/tarefas"] };
  const fab = section ? { label: section.fab.label, novo: section.fab.novo } : { label: "Novo item", novo: "compromisso" };
  const moreItems: NavItem[] = section
    ? section.more
    : [
        { href: "/notas", label: "Notas", icon: "note", match: ["/notas"] },
        { href: "/livros", label: "Livros", icon: "book", match: ["/livros"] },
        { href: "/financas", label: "Finanças", icon: "wallet", match: ["/financas"] },
        { href: "/pets", label: "Pets", icon: "paw", match: ["/pets"] },
        { href: "/perfil", label: "Perfil", icon: "user", match: ["/perfil"] },
      ];
  const inMore = moreItems.some((item) => itemActive(pathname, item));

  const link = (item: NavItem) => {
    const active = itemActive(pathname, item);
    return (
      <TransitionLink key={item.href} className={`bi${active ? " on" : ""}`} href={item.href} aria-current={active ? "page" : undefined}>
        <Icon name={item.icon} />{item.label}
      </TransitionLink>
    );
  };

  return (
    <>
      <nav className="bn" aria-label={section ? `Navegação de ${section.title}` : "Navegação principal"}>
        {left.map(link)}
        <OverlayLink className="bi add" params={{ novo: fab.novo }} aria-label={fab.label}>
          <span className="fab"><Icon name="plus" /></span>
        </OverlayLink>
        {link(right)}
        <button type="button" className={`bi${inMore ? " on" : ""}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <Icon name="more" />Mais
        </button>
      </nav>
      <AnimatePresence>
        {moreOpen ? (
          <Overlay label="Mais opções" variant="modal" narrow onClose={() => setMoreOpen(false)}>
            <div className="nav-more" style={{ padding: "6px 0 4px" }}>
              {moreItems.map((item) => (
                <TransitionLink key={item.href} href={item.href} onClick={() => setMoreOpen(false)}><Icon name={item.icon} />{item.label}</TransitionLink>
              ))}
              {section ? <TransitionLink href="/hoje" onClick={() => setMoreOpen(false)}><Icon name="left" />Voltar ao Amora</TransitionLink> : null}
              <button type="button" onClick={() => { setMoreOpen(false); openSearch(); }}><Icon name="search" />Buscar</button>
            </div>
          </Overlay>
        ) : null}
      </AnimatePresence>
    </>
  );
}
