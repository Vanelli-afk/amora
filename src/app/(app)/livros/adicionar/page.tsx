import type { Metadata } from "next";
import { AddBook } from "@/components/livros/add-book";

export const metadata: Metadata = { title: "Adicionar livro" };

export default async function AdicionarLivroPage({ searchParams }: { searchParams: Promise<{ prateleira?: string }> }) {
  const { prateleira } = await searchParams;
  const shelf = prateleira === "next" || prateleira === "finished" ? prateleira : "reading";
  return <AddBook initialShelf={shelf} />;
}
