import type { Metadata } from "next";
import { Shelves } from "@/components/livros/shelves";
import { latestQuote, listBooks, pagesReadOn } from "@/data/books";
import { getSettings } from "@/data/settings";
import { diffDays, parseDay, todayIn } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Livros" };

export default async function LivrosPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const { y } = parseDay(today);
  const [books, pagesToday, quote] = await Promise.all([listBooks(user.id), pagesReadOn(user.id, today), latestQuote(user.id)]);

  const finishedThisYear = books.filter((b) => b.shelf === "finished" && b.finishedOn?.startsWith(String(y))).length;
  const goal = settings.booksGoal;
  const left = Math.max(0, goal - finishedThisYear);
  const daysLeft = Math.max(1, diffDays(`${y}-12-31`, today));
  const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
  const goalPercent = Math.min(100, Math.round((finishedThisYear / goal) * 100));
  const pagesPercent = Math.min(100, Math.round((pagesToday / settings.pagesGoal) * 100));

  // A resenha fica fora: é texto privado que a estante não usa.
  const shelfBooks = books.map((book) => ({ ...book, review: null }));

  return (
    <Shelves
      books={shelfBooks}
      aside={(
        <aside key="resumo" className="col g16 shelf-side" aria-label="Resumo de leitura">
          <section className="card lg">
            <span className="eyebrow">Meta de {y}</span>
            <div className="ser num" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1, marginTop: 4 }}>{finishedThisYear} <span className="t3" style={{ fontSize: 22 }}>/ {goal} livros</span></div>
            <div className="bar" style={{ margin: "10px 0 8px", height: 10 }}><i style={{ width: `${goalPercent}%` }} /></div>
            <p className="sm t2">
              {left === 0
                ? "Meta alcançada! Que ano bom de leitura."
                : `Faltam ${left} livro${left === 1 ? "" : "s"} em ${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"}.`}
            </p>
          </section>
          <section className="card lg">
            <span className="eyebrow">Hoje</span>
            <div className="row jb ae" style={{ marginTop: 6 }}>
              <span className="ser num" style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.1 }}>{pagesToday} <span className="t3" style={{ fontSize: 18 }}>/ {settings.pagesGoal} págs</span></span>
              <span className="tag c-sage">hábito</span>
            </div>
            <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${pagesPercent}%` }} /></div>
          </section>
          {quote ? (
            <div className="quote quote-note">
              <span className="tape sky" />“{quote.text}”
              <span className="xs b" style={{ display: "block", fontFamily: "var(--font-nunito),sans-serif", marginTop: 6, color: "#62524A" }}>{quote.bookTitle}{quote.page ? ` · p. ${quote.page}` : ""}</span>
            </div>
          ) : null}
        </aside>
      )}
    />
  );
}
