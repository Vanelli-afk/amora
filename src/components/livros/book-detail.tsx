"use client";

import { AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { addBookQuote, changeCover, removeBook, removeQuote, saveBook, saveReview, updateProgress } from "@/actions/books";
import { FieldError } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { TransitionLink } from "@/components/ui/links";
import { Overlay } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useAutosave } from "@/components/ui/use-autosave";
import type { Book, Quote } from "@/data/books";
import { CoverArt, coverClass, coverTransition } from "./cover";

const SHELF_LABEL: Record<Book["shelf"], string> = { reading: "Lendo agora", next: "Próximos", finished: "Terminados" };

export function BookDetail({ book, quotes, pagesGoal, streak }: { book: Book; quotes: Quote[]; pagesGoal: number; streak: number }) {
  const router = useRouter();
  const toast = useToast();
  const [page, setPage] = useState(book.currentPage);
  const [saved, setSaved] = useState(book.currentPage);
  const [rating, setRating] = useState(book.rating);
  const [review, setReview] = useState(book.review ?? "");
  const [editing, setEditing] = useState(false);
  const [addingQuote, setAddingQuote] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();
  const [removedQuotes, setRemovedQuotes] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const visibleQuotes = quotes.filter((q) => !removedQuotes.includes(q.id));

  const { schedule, flush, status } = useAutosave<string>(async (text) => (await saveReview({ id: book.id, review: text })).ok);

  const max = book.pages ?? 50000;
  const clamp = (value: number) => Math.max(0, Math.min(max, value));
  const percent = book.pages ? Math.min(100, Math.round((page / book.pages) * 100)) : 0;
  const remaining = book.pages ? Math.max(0, book.pages - page) : null;
  const daysLeft = remaining !== null ? Math.ceil(remaining / pagesGoal) : null;

  function commitProgress() {
    start(async () => {
      const result = await updateProgress({ id: book.id, page: clamp(page) });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      setSaved(clamp(page));
      toast("Progresso atualizado");
    });
  }

  function patch(values: Parameters<typeof saveBook>[0]["patch"]) {
    start(async () => {
      const result = await saveBook({ id: book.id, patch: values });
      if (!result.ok) toast(result.error, { tone: "error" });
    });
  }

  function chooseRating(value: number) {
    const next = rating === value ? null : value;
    setRating(next);
    patch({ rating: next });
  }

  function destroy() {
    start(async () => {
      const result = await removeBook({ id: book.id });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Livro removido da estante");
      router.push("/livros");
    });
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pages = String(form.get("paginas") ?? "").trim();
    setError(undefined);
    start(async () => {
      const result = await saveBook({
        id: book.id,
        patch: { title: String(form.get("titulo")), author: String(form.get("autor") ?? ""), pages: pages ? Number(pages) : null },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function onCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("id", book.id);
    form.set("capa", file);
    start(async () => {
      const result = await changeCover(form);
      toast(result.ok ? "Capa atualizada" : result.error, { tone: result.ok ? "ok" : "error" });
    });
  }

  function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quotePage = String(form.get("pagina") ?? "").trim();
    setError(undefined);
    start(async () => {
      const result = await addBookQuote({ bookId: book.id, text: String(form.get("citacao")), page: quotePage ? Number(quotePage) : null });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAddingQuote(false);
    });
  }

  function deleteQuote(id: string) {
    setRemovedQuotes((list) => [...list, id]);
    start(async () => {
      const result = await removeQuote({ id });
      if (!result.ok) {
        setRemovedQuotes((list) => list.filter((q) => q !== id));
        toast(result.error, { tone: "error" });
      }
    });
  }

  return (
    <>
      <div className="dtop">
        <div className="row g12">
          <TransitionLink className="btn btn-s btn-ic" href="/livros" aria-label="Voltar para a estante"><Icon name="left" /></TransitionLink>
          <span className="eyebrow">Estante · {SHELF_LABEL[book.shelf]}</span>
        </div>
        <div className="row g8">
          <button type="button" className="btn btn-s" onClick={() => { setError(undefined); setEditing(true); }}><Icon name="edit" size="s" />Editar</button>
          <button type="button" className="btn btn-g btn-ic" aria-label="Remover da estante" onClick={() => setConfirmDelete(true)}><Icon name="trash" /></button>
        </div>
      </div>

      <div className="row wrap g32" style={{ alignItems: "flex-start" }}>
        <section className="col book-side">
          <div className="book-cover">
            <span className="tape" />
            <span className={coverClass(book)} style={coverTransition(book.id)} role="img" aria-label={`Capa de ${book.title}${book.author ? ` ${book.author}` : ""}`}><CoverArt book={book} /></span>
          </div>
          <h1 className="ser tc" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.15, marginTop: 22 }}>{book.title}</h1>
          {book.author ? <p className="t2 b" style={{ marginTop: 2 }}>{book.author}</p> : null}
          <div style={{ width: "100%", marginTop: 18 }}>
            <label className="lbl" htmlFor="prateleira">Prateleira</label>
            <select id="prateleira" className="inp" defaultValue={book.shelf} key={book.shelf} onChange={(e) => patch({ shelf: e.target.value as Book["shelf"] })}>
              <option value="reading">Lendo agora</option>
              <option value="next">Próximos</option>
              <option value="finished">Terminados</option>
            </select>
          </div>
          <div className="field-row" style={{ width: "100%", marginTop: 12 }}>
            <div><label className="lbl" htmlFor="inicio">Início</label><input id="inicio" className="inp" type="date" defaultValue={book.startedOn ?? ""} key={`i${book.startedOn}`} onBlur={(e) => { if (e.target.value !== (book.startedOn ?? "")) patch({ startedOn: e.target.value || null }); }} /></div>
            <div><label className="lbl" htmlFor="fim">Fim</label><input id="fim" className="inp" type="date" defaultValue={book.finishedOn ?? ""} key={`f${book.finishedOn}`} onBlur={(e) => { if (e.target.value !== (book.finishedOn ?? "")) patch({ finishedOn: e.target.value || null }); }} /></div>
          </div>
        </section>

        <div className="col g20 book-main">
          <section className="card lg">
            <div className="row jb ae wrap g8">
              <div>
                <span className="eyebrow">Progresso</span>
                <div className="ser num" style={{ fontSize: "clamp(32px,6vw,44px)", fontWeight: 600, lineHeight: 1.1, marginTop: 2 }}>
                  {page}{book.pages ? <span className="t3" style={{ fontSize: 24 }}> / {book.pages} páginas</span> : <span className="t3" style={{ fontSize: 24 }}> páginas</span>}
                </div>
              </div>
              {book.pages ? <span className="ser cr" style={{ fontSize: 40, fontWeight: 700 }}>{percent}%</span> : null}
            </div>
            <div className="bar" style={{ margin: "12px 0 16px", height: 12 }}><i style={{ width: `${percent}%` }} /></div>
            <div className="row g8 wrap">
              <button type="button" className="stp" aria-label="Voltar uma página" onClick={() => setPage((p) => clamp(p - 1))}><Icon name="minus" size="s" /></button>
              <div style={{ width: 110 }}>
                <label className="sr" htmlFor="pg">Página atual</label>
                <input id="pg" className="inp num tc" style={{ fontWeight: 800 }} type="number" inputMode="numeric" min={0} max={max} value={page} onChange={(e) => setPage(clamp(Number(e.target.value) || 0))} />
              </div>
              <button type="button" className="stp" aria-label="Avançar uma página" onClick={() => setPage((p) => clamp(p + 1))}><Icon name="plus" size="s" /></button>
              <button type="button" className="chip" style={{ fontSize: 13 }} onClick={() => setPage((p) => clamp(p + 10))}>+10 págs</button>
              <span className="f1" />
              <button type="button" className="btn btn-p" onClick={commitProgress} disabled={pending || page === saved}>Atualizar progresso</button>
            </div>
            {remaining ? (
              <p className="hand t2" style={{ fontSize: 22, marginTop: 10 }}>
                faltam {remaining} páginas · no ritmo de {pagesGoal} por dia, termina em {daysLeft} dia{daysLeft === 1 ? "" : "s"}
              </p>
            ) : null}
          </section>

          <div className="row g20 wrap as">
            <section className="card row jb" style={{ flex: "1 1 220px", minHeight: 68, padding: "10px 18px" }}>
              <span className="h3">Minha nota</span>
              <div className="stars" role="radiogroup" aria-label="Minha nota">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" className="star-btn" role="radio" aria-checked={rating === value} aria-label={`${value} de 5 estrelas`} onClick={() => chooseRating(value)}>
                    <Icon name="star" size="l" className={rating && value <= rating ? undefined : "o"} />
                  </button>
                ))}
              </div>
            </section>
            <section className="card row g12" style={{ flex: "1 1 220px", minHeight: 68, padding: "10px 18px" }}>
              <Icon name="flame" className="cr" />
              <div>
                <b>{streak === 1 ? "1 dia seguido" : `${streak} dias seguidos`}</b>
                <div className="xs t2">lendo {pagesGoal} páginas</div>
              </div>
            </section>
          </div>

          <section>
            <div className="row jb">
              <label className="h2" htmlFor="rs" style={{ display: "block", marginBottom: 8 }}>Resenha</label>
              <span className={`saved${status === "idle" ? "" : " on"}`} aria-live="polite">{status === "saving" ? "salvando…" : status === "error" ? "não foi possível salvar" : "salvo"}</span>
            </div>
            <textarea id="rs" className="inp ruled" style={{ minHeight: 130 }} value={review} maxLength={20000} placeholder="O que você achou deste livro?" onChange={(e) => { setReview(e.target.value); schedule(e.target.value); }} onBlur={() => void flush()} />
          </section>

          <section>
            <div className="row jb wrap g8" style={{ marginBottom: 10 }}>
              <h2 className="h2">Citações favoritas</h2>
              <button type="button" className="btn btn-s" onClick={() => { setError(undefined); setAddingQuote(true); }}><Icon name="plus" size="s" />Adicionar citação</button>
            </div>
            {visibleQuotes.length ? (
              <div className="row g16 wrap as">
                {visibleQuotes.map((quote) => (
                  <figure key={quote.id} className="quote rel enter" style={{ flex: "1 1 260px" }}>
                    <blockquote style={{ margin: 0 }}>“{quote.text}”</blockquote>
                    <figcaption className="row jb xs t2 b" style={{ fontFamily: "var(--font-nunito),sans-serif", marginTop: 4 }}>
                      <span>{quote.page ? `página ${quote.page}` : ""}</span>
                      <button type="button" className="btn btn-g btn-ic" style={{ minHeight: 32, width: 32 }} aria-label="Remover citação" onClick={() => deleteQuote(quote.id)}><Icon name="close" size="s" /></button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : <p className="sm t2">Guarde aqui os trechos que você quer lembrar.</p>}
          </section>
        </div>
      </div>

      <AnimatePresence>
        {editing ? (
          <Overlay key="editar" label="Editar livro" variant="modal" narrow onClose={() => setEditing(false)}>
            <h2 className="ser" style={{ fontSize: 26, fontWeight: 600, marginBottom: 14 }}>Editar livro</h2>
            <form className="col g16" onSubmit={submitEdit}>
              <div><label className="lbl" htmlFor="ed-t">Título</label><input id="ed-t" name="titulo" className="inp" defaultValue={book.title} maxLength={300} required /></div>
              <div><label className="lbl" htmlFor="ed-a">Autor</label><input id="ed-a" name="autor" className="inp" defaultValue={book.author ?? ""} maxLength={200} /></div>
              <div><label className="lbl" htmlFor="ed-p">Páginas</label><input id="ed-p" name="paginas" className="inp num" type="number" min={1} max={50000} defaultValue={book.pages ?? ""} /></div>
              <label className="upl" style={{ minHeight: 76 }}>
                <input className="sr" type="file" accept="image/jpeg,image/png,image/webp" onChange={onCover} />
                <Icon name="upload" />Trocar capa<span className="xs t3">JPG ou PNG, até 5 MB</span>
              </label>
              {error ? <FieldError message={error} /> : null}
              <div className="row g8" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-s" onClick={() => setEditing(false)}>Cancelar</button>
                <button className="btn btn-p" disabled={pending}>Salvar</button>
              </div>
            </form>
          </Overlay>
        ) : null}
        {addingQuote ? (
          <Overlay key="citacao" label="Adicionar citação" variant="modal" narrow onClose={() => setAddingQuote(false)}>
            <h2 className="ser" style={{ fontSize: 26, fontWeight: 600, marginBottom: 14 }}>Nova citação</h2>
            <form className="col g16" onSubmit={submitQuote}>
              <div><label className="lbl" htmlFor="q-t">Trecho</label><textarea id="q-t" name="citacao" className="inp ruled inp-hand" maxLength={2000} required autoFocus /></div>
              <div><label className="lbl" htmlFor="q-p">Página</label><input id="q-p" name="pagina" className="inp num" type="number" min={1} max={50000} /></div>
              {error ? <FieldError message={error} /> : null}
              <div className="row g8" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-s" onClick={() => setAddingQuote(false)}>Cancelar</button>
                <button className="btn btn-p" disabled={pending}>Salvar citação</button>
              </div>
            </form>
          </Overlay>
        ) : null}
        {confirmDelete ? (
          <Overlay key="remover" label="Remover livro" variant="modal" narrow onClose={() => setConfirmDelete(false)}>
            <h2 className="ser" style={{ fontSize: 26, fontWeight: 600 }}>Remover da estante?</h2>
            <p className="t2" style={{ margin: "8px 0 18px" }}>“{book.title}”, a resenha e as citações serão apagados. Isso não pode ser desfeito.</p>
            <div className="row g8" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-s" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={destroy} disabled={pending}>Remover</button>
            </div>
          </Overlay>
        ) : null}
      </AnimatePresence>
    </>
  );
}
