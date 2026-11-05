"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { addBookFromSearch, addBookManual, findBooks } from "@/actions/books";
import { FieldError } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { TransitionLink } from "@/components/ui/links";
import { ChipRadio } from "@/components/ui/pickers";
import { useToast } from "@/components/ui/toast";
import type { BookResult } from "@/lib/book-search";

type Shelf = "reading" | "next" | "finished";

const SHELVES = [
  { id: "reading", label: "Lendo agora" },
  { id: "next", label: "Próximos" },
  { id: "finished", label: "Terminados" },
] as const;

const MAX_BYTES = 5 * 1024 * 1024;

function hash(title: string) {
  let value = 0;
  for (const char of title) value = (value * 31 + (char.codePointAt(0) ?? 0)) % 9973;
  return (value % 10) + 1;
}

export function AddBook({ initialShelf }: { initialShelf: Shelf }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [searchError, setSearchError] = useState<string>();
  const [adding, setAdding] = useState<string | null>(null);
  const [shelf, setShelf] = useState<Shelf>(initialShelf);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    const current = ++seq.current;
    setState("loading");
    const timer = setTimeout(async () => {
      const result = await findBooks({ query: term });
      if (current !== seq.current) return;
      if (result.ok) {
        setResults(result.data);
        setState("done");
      } else {
        setSearchError(result.error);
        setState("error");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function addResult(book: BookResult, key: string) {
    setAdding(key);
    start(async () => {
      const result = await addBookFromSearch({ title: book.title, author: book.author, pages: book.pages, shelf, source: book.source, coverRef: book.coverRef });
      setAdding(null);
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Livro adicionado à estante");
      router.push(`/livros/${result.data}`);
    });
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(undefined);
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("A imagem precisa ter até 5 MB.");
      event.target.value = "";
      setPreview(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const form = new FormData(event.currentTarget);
    form.set("prateleira", shelf);
    start(async () => {
      const result = await addBookManual(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Livro adicionado à estante");
      router.push(`/livros/${result.data}`);
    });
  }

  return (
    <>
      <div className="dtop">
        <div className="row g12">
          <TransitionLink className="btn btn-s btn-ic" href="/livros" aria-label="Voltar para a estante"><Icon name="left" /></TransitionLink>
          <h1 className="page-title">Adicionar livro</h1>
        </div>
      </div>

      <div className="row wrap g24" style={{ alignItems: "flex-start" }}>
        <section style={{ flex: "1.3 1 460px", minWidth: 0 }} aria-label="Buscar livro">
          <label className="lbl" htmlFor="bq">Buscar por título ou autor</label>
          <div className="inw">
            <Icon name="search" />
            <input id="bq" className="inp" type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} placeholder="Ex.: Dom Casmurro" autoFocus />
          </div>

          <div aria-live="polite">
            {state === "loading" ? (
              <div className="col g8" style={{ marginTop: 16 }}><div className="skl" style={{ height: 100 }} /><div className="skl" style={{ height: 100 }} /></div>
            ) : null}
            {state === "error" ? <div style={{ marginTop: 12 }}><FieldError message={searchError ?? "Busca indisponível."} /></div> : null}
            {state === "done" ? <p className="sm t2 b" style={{ margin: "16px 2px 6px" }}>{results.length} resultado{results.length === 1 ? "" : "s"} para “{query.trim()}”</p> : null}
          </div>

          {results.length && state === "done" ? (
            <div className="card" style={{ padding: "4px 18px" }}>
              {results.map((book, index) => {
                const key = `${book.source}-${index}`;
                return (
                  <div key={key} className="list-row result-row">
                    <span className={`cover cv${hash(book.title)} result-cover`} role="img" aria-label={`Capa de ${book.title}`}><span className="cvt" aria-hidden="true">{book.title}</span></span>
                    <div className="f1" style={{ minWidth: 0 }}>
                      <b className="ser" style={{ fontSize: 19, lineHeight: 1.2, display: "block" }}>{book.title}</b>
                      {book.author ? <span className="t2">{book.author}</span> : null}
                      {book.pages ? <><br /><span className="xs t3 b">{book.pages} páginas</span></> : null}
                    </div>
                    <button type="button" className="btn btn-s" disabled={pending} onClick={() => addResult(book, key)} aria-label={`Adicionar ${book.title}`}>
                      <Icon name="plus" size="s" />{adding === key ? "Adicionando…" : "Adicionar"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
          {state === "done" && !results.length ? <p className="sm t2" style={{ marginTop: 8 }}>Nada encontrado. Você pode cadastrar manualmente.</p> : null}
        </section>

        <section className="card lg" style={{ flex: "1 1 360px", minWidth: 0, boxShadow: "var(--sh2)" }} aria-label="Cadastrar manualmente">
          <h2 className="h2" style={{ marginBottom: 4 }}>Cadastrar manualmente</h2>
          <p className="sm t2" style={{ marginBottom: 16 }}>Não achou? Preencha você mesmo.</p>
          <form className="col g16" onSubmit={submit}>
            <div><label className="lbl" htmlFor="mt">Título</label><input id="mt" name="titulo" className="inp" type="text" placeholder="Ex.: Onde o Rio Dorme" maxLength={300} required /></div>
            <div className="field-row">
              <div><label className="lbl" htmlFor="ma">Autor</label><input id="ma" name="autor" className="inp" type="text" placeholder="Quem escreveu" maxLength={200} /></div>
              <div style={{ flex: "0 0 110px" }}><label className="lbl" htmlFor="mp">Páginas</label><input id="mp" name="paginas" className="inp num" type="number" min={1} max={50000} inputMode="numeric" placeholder="320" /></div>
            </div>
            <div>
              <span className="lbl">Prateleira</span>
              <ChipRadio label="Prateleira" value={shelf} options={SHELVES} onChange={setShelf} />
            </div>
            <div>
              <span className="lbl">Capa</span>
              <label className="upl">
                <input className="sr" type="file" name="capa" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
                {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob) */}
                {preview ? <img src={preview} alt="Pré-visualização da capa" /> : <Icon name="upload" size="l" />}
                {preview ? "Trocar capa" : "Enviar capa"}
                <span className="xs t3">JPG ou PNG, até 5 MB</span>
              </label>
            </div>
            {error ? <FieldError message={error} /> : null}
            <div className="row g8" style={{ justifyContent: "flex-end" }}>
              <TransitionLink className="btn btn-s" href="/livros">Cancelar</TransitionLink>
              <button className="btn btn-p" disabled={pending}>{pending && !adding ? "Salvando…" : "Salvar livro"}</button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
