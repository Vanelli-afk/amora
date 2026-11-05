"use client";

// Painéis ficam na URL: o botão voltar do celular os fecha e o link direto funciona.
// pushState mantém a transição instantânea, sem ida ao servidor.

let openedByUs = 0;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    openedByUs = Math.max(0, openedByUs - 1);
  });
}

export function openOverlay(params: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  openedByUs += 1;
  window.history.pushState(null, "", url);
}

export function replaceOverlay(params: Record<string, string>, remove: string[] = []) {
  const url = new URL(window.location.href);
  for (const key of remove) url.searchParams.delete(key);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  window.history.replaceState(null, "", url);
}

export function closeOverlay(keys: string[]) {
  if (openedByUs > 0) {
    window.history.back();
    return;
  }
  const url = new URL(window.location.href);
  for (const key of keys) url.searchParams.delete(key);
  window.history.replaceState(null, "", url);
}
