const FALLBACK = "/hoje";
const ORIGIN = "https://amora.invalid";

/** Aceita apenas caminhos internos, para o parâmetro "volta" não virar redirecionamento aberto. */
export function safeNext(value: string | null | undefined): string {
  // O navegador descarta tabulações e quebras de linha e trata "\" como "/": "/\t/site" viraria "//site".
  if (!value || !value.startsWith("/") || /[\x00-\x1f\x7f\\]/.test(value)) return FALLBACK;
  try {
    const url = new URL(value, ORIGIN);
    // Confere o resultado, não só a entrada: "/.//site" normaliza para "//site".
    if (url.origin !== ORIGIN || url.pathname.startsWith("//")) return FALLBACK;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return FALLBACK;
  }
}
