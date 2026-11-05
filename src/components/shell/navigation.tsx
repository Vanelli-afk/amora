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
  { href: "/perfil", label: "Perfil", icon: "user", match: ["/perfil"] },
];

const isActive = (pathname: string, match: string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

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
  const inMore = isActive(pathname, ["/notas", "/livros", "/perfil"]);

  return (
    <>
      <nav className="bn" aria-label="Navegação principal">
        {BOTTOM.map((item) => (
          <TransitionLink key={item.href} className={`bi${isActive(pathname, item.match) ? " on" : ""}`} href={item.href} aria-current={isActive(pathname, item.match) ? "page" : undefined}>
            <Icon name={item.icon} />{item.label}
          </TransitionLink>
        ))}
        <OverlayLink className="bi add" params={{ novo: "compromisso" }} aria-label="Novo item">
          <span className="fab"><Icon name="plus" /></span>
        </OverlayLink>
        <TransitionLink className={`bi${isActive(pathname, ["/tarefas"]) ? " on" : ""}`} href="/tarefas" aria-current={isActive(pathname, ["/tarefas"]) ? "page" : undefined}>
          <Icon name="tasks" />Tarefas
        </TransitionLink>
        <button type="button" className={`bi${inMore ? " on" : ""}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <Icon name="more" />Mais
        </button>
      </nav>
      <AnimatePresence>
        {moreOpen ? (
          <Overlay label="Mais opções" variant="modal" narrow onClose={() => setMoreOpen(false)}>
            <div className="nav-more" style={{ padding: "6px 0 4px" }}>
              <TransitionLink href="/notas" onClick={() => setMoreOpen(false)}><Icon name="note" />Notas</TransitionLink>
              <TransitionLink href="/livros" onClick={() => setMoreOpen(false)}><Icon name="book" />Livros</TransitionLink>
              <TransitionLink href="/perfil" onClick={() => setMoreOpen(false)}><Icon name="user" />Perfil</TransitionLink>
              <button type="button" onClick={() => { setMoreOpen(false); openSearch(); }}><Icon name="search" />Buscar</button>
            </div>
          </Overlay>
        ) : null}
      </AnimatePresence>
    </>
  );
}
