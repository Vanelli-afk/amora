"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { TransitionLink } from "@/components/ui/links";
import type { Book } from "@/data/books";
import { matchesQuery } from "@/lib/notes";
import { CoverArt, coverClass, coverTransition } from "./cover";

const COLS = 5;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="rating" role="img" aria-label={`${rating} de 5 estrelas`}>
      {"★".repeat(rating)}<span className="off">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

const percent = (b: Book) => (b.pages ? Math.min(100, Math.round((b.currentPage / b.pages) * 100)) : 0);

function coverLabel(book: Book) {
  const base = `${book.title}${book.author ? ` ${book.author}` : ""}`;
  if (book.shelf === "reading") return `${base}, ${percent(book)}% lido`;
  if (book.rating) return `${base}, ${book.rating} estrelas`;
  return base;
}

function BookCover({ book }: { book: Book }) {
  return (
    <TransitionLink href={`/livros/${book.id}`} className={coverClass(book)} style={coverTransition(book.id)} aria-label={coverLabel(book)}>
      <CoverArt book={book} />
    </TransitionLink>
  );
}

function Shelf({ title, count, books, shelf, onAll }: { title: string; count: number; books: Book[]; shelf: Book["shelf"]; onAll: () => void }) {
  const room = shelf === "finished" ? COLS - 1 : COLS - 1;
  const visible = books.slice(0, room);
  const hidden = books.length - visible.length;
  return (
    <section>
      <div className="row jb" style={{ padding: "0 6px 10px" }}>
        <h2 className="h2">{title}</h2>
        <span className="due">{count} livro{count === 1 ? "" : "s"}</span>
      </div>
      <div className="shelf-scroll" data-shelf>
      <div className="shelf-inner">
      <div className="sh-books">
        {visible.map((book) => <BookCover key={book.id} book={book} />)}
        {hidden > 0 ? (
          <button type="button" className="col jc tc sm b t2 cover-add" onClick={onAll}><span className="ser" style={{ fontSize: 24 }}>+{hidden}</span>ver todos</button>
        ) : (
          <TransitionLink href={`/livros/adicionar?prateleira=${shelf}`} className="col jc tc sm b t2 cover-add" aria-label={`Adicionar livro em ${title}`}>
            <span className="ser" style={{ fontSize: 26 }}>+</span>adicionar
          </TransitionLink>
        )}
      </div>
      <div className="plank" />
      {shelf === "reading" && visible.length ? (
        <div className="sh-prog">
          {visible.map((book) => (
            <div key={book.id}>
              <div className="bar"><i style={{ width: `${percent(book)}%` }} /></div>
              <span className="xs b t2">{percent(book)}% · p. {book.currentPage}</span>
            </div>
          ))}
        </div>
      ) : null}
      {shelf === "finished" && visible.some((b) => b.rating) ? (
        <div className="sh-prog">
          {visible.map((book) => <div key={book.id}>{book.rating ? <Stars rating={book.rating} /> : null}</div>)}
        </div>
      ) : null}
      </div>
      </div>
    </section>
  );
}

export function Shelves({ books, aside }: { books: Book[]; aside: React.ReactNode }) {
  const [view, setView] = useState<"prateleiras" | "todos">("prateleiras");
  const [query, setQuery] = useState("");

  const filtered = query.trim() ? books.filter((b) => matchesQuery(`${b.title} ${b.author ?? ""}`, query)) : books;
  const of = (shelf: Book["shelf"]) => filtered.filter((b) => b.shelf === shelf);
  const showAll = view === "todos" || Boolean(query.trim());

  return (
    <>
      <div className="dtop">
        <div className="col">
          <h1 className="page-title">Livros</h1>
          <span className="sm t2 b">{books.length} livro{books.length === 1 ? "" : "s"} na estante</span>
        </div>
        <div className="row g8 top-tools">
          <div className="tabs" role="tablist" aria-label="Visão da estante" style={{ width: 240 }}>
            <button type="button" className={`tab${view === "prateleiras" ? " on" : ""}`} role="tab" aria-selected={view === "prateleiras"} onClick={() => setView("prateleiras")}>Prateleiras</button>
            <button type="button" className={`tab${view === "todos" ? " on" : ""}`} role="tab" aria-selected={view === "todos"} onClick={() => setView("todos")}>Todos</button>
          </div>
          <div className="inw" style={{ width: 240 }}>
            <Icon name="search" />
            <input className="inp" type="search" placeholder="Título ou autor…" aria-label="Buscar livros" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} />
          </div>
          <TransitionLink href="/livros/adicionar" className="btn btn-p"><Icon name="plus" size="s" />Adicionar livro</TransitionLink>
        </div>
      </div>

      <div className="row wrap g24" style={{ alignItems: "flex-start" }}>
        <div className="col shelves">
          {!books.length ? (
            <div className="empty">
              <h2 className="h3">A estante está esperando</h2>
              <p>Adicione o primeiro livro: o que você está lendo agora?</p>
              <TransitionLink href="/livros/adicionar" className="btn btn-p">Adicionar livro</TransitionLink>
            </div>
          ) : showAll ? (
            filtered.length ? (
              <div className="all-grid">
                {filtered.map((book) => <BookCover key={book.id} book={book} />)}
              </div>
            ) : <div className="empty"><h2 className="h3">Nenhum livro encontrado</h2><p>Tente outro título ou autor.</p></div>
          ) : (
            <>
              <Shelf title="Lendo agora" count={of("reading").length} books={of("reading")} shelf="reading" onAll={() => setView("todos")} />
              <Shelf title="Próximos" count={of("next").length} books={of("next")} shelf="next" onAll={() => setView("todos")} />
              <Shelf title="Terminados" count={of("finished").length} books={of("finished")} shelf="finished" onAll={() => setView("todos")} />
            </>
          )}
        </div>
        {aside}
      </div>
    </>
  );
}
