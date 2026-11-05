import "server-only";
import { z } from "zod";
import { createBreaker } from "./circuit-breaker";
import { UserError } from "./errors";
import { MAX_UPLOAD_BYTES } from "./storage";

export type BookResult = {
  source: "openlibrary" | "google";
  /** Identificador da capa na fonte, nunca uma URL: o cliente não escolhe o que o servidor baixa. */
  coverRef: string | null;
  title: string;
  author: string | null;
  pages: number | null;
};

// Sem e-mail nem dados da conta: as APIs só precisam saber qual aplicativo está chamando.
const HEADERS = { "User-Agent": "Amora/1.0", Accept: "application/json" };
const TIMEOUT_MS = 6000;

// Resposta recusada ou fora do formato pode vir da busca digitada, não de o serviço estar mal.
class RejectedQueryError extends Error {}
const isUpstreamFailure = (error: unknown) => !(error instanceof RejectedQueryError || error instanceof z.ZodError);

function checkResponse(response: Response) {
  if (response.ok) return;
  const rejected = response.status >= 400 && response.status < 500 && response.status !== 429;
  throw rejected ? new RejectedQueryError() : new Error("Serviço de livros indisponível");
}

const openLibraryBreaker = createBreaker({ counts: isUpstreamFailure });
const googleBreaker = createBreaker({ counts: isUpstreamFailure });
const coverBreaker = createBreaker();

const OpenLibrary = z.object({
  docs: z.array(z.object({
    title: z.string(),
    author_name: z.array(z.string()).optional(),
    number_of_pages_median: z.number().optional(),
    cover_i: z.number().optional(),
  })),
});

const GoogleBooks = z.object({
  items: z.array(z.object({
    id: z.string(),
    volumeInfo: z.object({
      title: z.string().optional(),
      authors: z.array(z.string()).optional(),
      pageCount: z.number().optional(),
      imageLinks: z.object({ thumbnail: z.string().optional() }).optional(),
    }),
  })).optional(),
});

async function fromOpenLibrary(query: string): Promise<BookResult[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("fields", "title,author_name,number_of_pages_median,cover_i");
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  checkResponse(response);
  const data = OpenLibrary.parse(await response.json());
  return data.docs.map((doc) => ({
    source: "openlibrary",
    coverRef: doc.cover_i ? String(doc.cover_i) : null,
    title: doc.title.slice(0, 300),
    author: doc.author_name?.[0]?.slice(0, 200) ?? null,
    pages: doc.number_of_pages_median ?? null,
  }));
}

async function fromGoogle(query: string): Promise<BookResult[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "8");
  url.searchParams.set("key", key);
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  checkResponse(response);
  const data = GoogleBooks.parse(await response.json());
  return (data.items ?? []).filter((i) => i.volumeInfo.title).map((item) => ({
    source: "google",
    coverRef: item.volumeInfo.imageLinks?.thumbnail ? item.id : null,
    title: (item.volumeInfo.title ?? "").slice(0, 300),
    author: item.volumeInfo.authors?.[0]?.slice(0, 200) ?? null,
    pages: item.volumeInfo.pageCount || null,
  }));
}

export async function searchBooks(query: string): Promise<BookResult[]> {
  const [open, google] = await Promise.allSettled([openLibraryBreaker(() => fromOpenLibrary(query)), googleBreaker(() => fromGoogle(query))]);
  if (open.status === "rejected" && google.status === "rejected") {
    throw new UserError("A busca está indisponível agora. Você pode cadastrar o livro manualmente.");
  }
  const results = [
    ...(open.status === "fulfilled" ? open.value : []),
    ...(google.status === "fulfilled" ? google.value : []),
  ];
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.title.toLowerCase()}|${(r.author ?? "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

const ALLOWED_HOSTS = [/^covers\.openlibrary\.org$/, /(^|\.)archive\.org$/, /^books\.google\.com$/, /^books\.googleusercontent\.com$/];

export function isAllowedCoverUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

/** URL montada só a partir de um identificador validado, sem aceitar endereço do cliente (evita SSRF). */
export function coverUrl(source: BookResult["source"], ref: string): string | null {
  if (source === "openlibrary") return /^\d{1,12}$/.test(ref) ? `https://covers.openlibrary.org/b/id/${ref}-L.jpg` : null;
  return /^[\w-]{1,40}$/.test(ref) ? `https://books.google.com/books/content?id=${ref}&printsec=frontcover&img=1&zoom=1` : null;
}

/** Baixa a capa seguindo redirecionamentos apenas para hosts permitidos. Falha devolve null: o livro fica com capa gerada. */
export async function fetchCover(source: BookResult["source"], ref: string): Promise<Buffer | null> {
  let url = coverUrl(source, ref);
  if (!url) return null;
  try {
    for (let hop = 0; hop < 4; hop += 1) {
      if (!isAllowedCoverUrl(url)) return null;
      const target: string = url;
      const response: Response = await coverBreaker(() => fetch(target, { headers: { "User-Agent": HEADERS["User-Agent"] }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) }));
      if (response.status >= 300 && response.status < 400) {
        const next: string | null = response.headers.get("location");
        if (!next) return null;
        url = new URL(next, url).toString();
        continue;
      }
      if (!response.ok) return null;
      if (Number(response.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return null;
      const body = Buffer.from(await response.arrayBuffer());
      return body.length > MAX_UPLOAD_BYTES ? null : body;
    }
  } catch {
    return null;
  }
  return null;
}
