"use client";

import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { search } from "@/actions/search";
import { Icon, type IconName } from "@/components/ui/icon";
import { Overlay } from "@/components/ui/overlay";
import type { SearchHit } from "@/data/search";

const EVENT = "amora:buscar";
export const openSearch = () => window.dispatchEvent(new Event(EVENT));

const ICONS: Record<SearchHit["kind"], IconName> = {
  evento: "calendar", tarefa: "tasks", nota: "note", livro: "book", dia: "sun", lançamento: "wallet", pet: "paw",
};

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setState("idle");
      return;
    }
    const current = ++seq.current;
    setState("loading");
    const timer = setTimeout(async () => {
      const result = await search({ query: term });
      if (current !== seq.current) return;
      if (result.ok) {
        setHits(result.data);
        setState("idle");
      } else {
        setState("error");
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  function close() {
    setOpen(false);
    setQuery("");
    setHits([]);
  }

  return (
    <AnimatePresence>
      {open ? (
        <Overlay label="Buscar em tudo" variant="palette" onClose={close}>
          <div className="row g8">
            <div className="inw f1">
              <Icon name="search" />
              <input ref={inputRef} className="inp" type="search" placeholder="Buscar em tudo…" aria-label="Buscar em tudo" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} />
            </div>
            <button type="button" className="btn btn-g btn-ic" aria-label="Fechar busca" onClick={close}><Icon name="close" /></button>
          </div>
          <div className="palette-list" aria-live="polite">
            {state === "error" ? <p className="sm t2" style={{ padding: 12 }}>Não foi possível buscar agora.</p> : null}
            {state === "idle" && query.trim().length >= 2 && !hits.length ? <p className="sm t2" style={{ padding: 12 }}>Nada encontrado para “{query.trim()}”.</p> : null}
            {query.trim().length < 2 ? <p className="sm t2" style={{ padding: 12 }}>Procure em compromissos, tarefas, notas, livros, reflexões, lançamentos e pets.</p> : null}
            {hits.map((hit, index) => (
              <Link key={`${hit.href}-${index}`} className="palette-item" href={hit.href} onClick={close}>
                <Icon name={ICONS[hit.kind]} className="t2" />
                <div className="f1" style={{ minWidth: 0 }}>
                  <b className="ell" style={{ display: "block" }}>{hit.title}</b>
                  <span className="xs t2 ell" style={{ display: "block" }}>{hit.subtitle}</span>
                </div>
              </Link>
            ))}
          </div>
        </Overlay>
      ) : null}
    </AnimatePresence>
  );
}
