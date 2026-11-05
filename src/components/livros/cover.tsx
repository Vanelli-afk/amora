import type { CSSProperties } from "react";

type CoverBook = { title: string; author?: string | null; coverFileId?: string | null; coverStyle: number };

/** Capa enviada ou, sem ela, uma das capas geradas pelo CSS do design. */
export function CoverArt({ book, hideAuthor }: { book: CoverBook; hideAuthor?: boolean }) {
  if (book.coverFileId) {
    // eslint-disable-next-line @next/next/no-img-element -- imagem privada, servida com checagem de dono
    return <img src={`/api/arquivos/${book.coverFileId}`} alt="" loading="lazy" />;
  }
  return (
    <>
      <span className="cvt" aria-hidden="true">{book.title}</span>{" "}
      {book.author && !hideAuthor ? <span className="cva" aria-hidden="true">{book.author}</span> : null}
    </>
  );
}

export const coverClass = (book: CoverBook) => `cover cv${book.coverStyle}`;

export const coverTransition = (id: string): CSSProperties => ({ viewTransitionName: `livro-${id}` });
