// Dinheiro sempre em centavos inteiros: somar em ponto flutuante acumula erro.
const MINUS = "−";

function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 428690 → "4.286,90" */
export function formatCents(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  return `${group(String(Math.trunc(abs / 100)))},${String(abs % 100).padStart(2, "0")}`;
}

/** 428690 → "R$ 4.286,90"; negativo → "−R$ 4.286,90" */
export function formatBRL(cents: number): string {
  return `${cents < 0 ? MINUS : ""}R$ ${formatCents(cents)}`;
}

/** Com sinal explícito, como na lista de lançamentos: "− R$ 212,40" / "+ R$ 1.350,00". */
export function formatSigned(cents: number, type: "income" | "expense"): string {
  return `${type === "income" ? "+" : MINUS} R$ ${formatCents(cents)}`;
}

const MAX_CENTS = 99_999_999_999; // R$ 999.999.999,99

/**
 * Lê o que a pessoa digitou: "1.234,56", "1234,56", "1234.5", "R$ 12". Devolve centavos ou null.
 * Com vírgula, ela é o decimal e os pontos são milhar; sem vírgula, um ponto seguido de 1 ou 2
 * dígitos é decimal ("12.5"), qualquer outro ponto é milhar ("1.234").
 */
export function parseBRL(input: string): number | null {
  const s = input.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;

  let int: string;
  let frac = "";
  const comma = s.lastIndexOf(",");
  if (comma >= 0) {
    int = s.slice(0, comma);
    frac = s.slice(comma + 1);
    if (int.includes(",") || frac.includes(".")) return null;
    int = int.replace(/\./g, "");
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    [int, frac] = s.split(".") as [string, string];
  } else {
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(s)) return null;
    int = s.replace(/\./g, "");
  }
  if (!/^\d+$/.test(int) || frac.length > 2 || (frac && !/^\d+$/.test(frac))) return null;

  const cents = Number(int) * 100 + Number(frac.padEnd(2, "0") || "0");
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}
