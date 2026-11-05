"use client";

import { Icon } from "@/components/ui/icon";
import { openSearch } from "./search-palette";

/** Parece o campo do design, mas abre a busca completa. */
export function OpenSearchField({ label = "Buscar em tudo…" }: { label?: string }) {
  return (
    <button type="button" className="inw top-search" onClick={openSearch} aria-label="Buscar em tudo">
      <Icon name="search" />
      <span className="inp inp-fake t3">{label}</span>
    </button>
  );
}
