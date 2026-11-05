"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTransitionNavigate } from "@/components/ui/links";
import { openOverlay } from "@/components/ui/url-state";
import { openSearch } from "./search-palette";

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/** Atalhos do design: N novo item, H hoje, / buscar. */
export function Shortcuts() {
  const navigate = useTransitionNavigate();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openOverlay({ novo: "compromisso" });
      } else if (event.key === "h" || event.key === "H") {
        event.preventDefault();
        navigate("/hoje");
      } else if (event.key === "/") {
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
  return null;
}

/** App aberto há muito tempo (PWA): ao voltar, atualiza o dia e a hora. */
export function RefreshOnReturn() {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);
  useEffect(() => {
    function onChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > 5 * 60_000) {
        hiddenAt.current = null;
        router.refresh();
      }
    }
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router]);
  return null;
}

/** Em outro aparelho o cookie de tema pode estar ausente: alinha com a preferência da conta. */
export function ThemeSync({ theme }: { theme: string }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}

/** Registra o service worker, que cuida do push e da página offline. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
