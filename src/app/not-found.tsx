import Link from "next/link";

export default function NotFound() {
  return (
    <main className="legal tc">
      <h1>Página em branco</h1>
      <p>Não encontramos o que você procurava.</p>
      <Link className="btn btn-p" href="/hoje">Voltar para hoje</Link>
    </main>
  );
}
