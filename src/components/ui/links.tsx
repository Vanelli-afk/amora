"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, type ComponentProps, type MouseEvent } from "react";
import { openOverlay } from "./url-state";

const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

let finishTransition: (() => void) | null = null;

/** Executa a navegação dentro de uma View Transition. Sem suporte, navega direto. */
export function useTransitionNavigate() {
  const router = useRouter();
  return (href: string) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduced) {
      router.push(href);
      return;
    }
    document.startViewTransition(() => new Promise<void>((resolve) => {
      finishTransition = resolve;
      startTransition(() => router.push(href));
      // Rede lenta: não deixa a tela congelada esperando a próxima página.
      setTimeout(resolve, 900);
    }));
  };
}

/** Avisa a View Transition de que a nova página já está na tela. */
export function ViewTransitionDone() {
  const pathname = usePathname();
  useEffect(() => {
    finishTransition?.();
    finishTransition = null;
  }, [pathname]);
  return null;
}

export function TransitionLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const navigate = useTransitionNavigate();
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !isPlainClick(event)) return;
        event.preventDefault();
        navigate(href);
      }}
      {...props}
    />
  );
}

/** Link real (abre em nova aba) que, no clique normal, só abre o painel sobre a página. */
export function OverlayLink({ params, onClick, ...props }: ComponentProps<"a"> & { params: Record<string, string> }) {
  const href = `?${new URLSearchParams(params).toString()}`;
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !isPlainClick(event)) return;
        event.preventDefault();
        openOverlay(params);
      }}
      {...props}
    />
  );
}
