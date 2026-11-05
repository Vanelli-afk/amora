import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Termos de uso" };

// Rascunho: precisa de revisão jurídica antes de um lançamento público.
export default function TermosPage() {
  return (
    <main className="legal">
      <h1>Termos de uso</h1>
      <p className="t2">Rascunho para revisão antes do lançamento público.</p>

      <h2>O serviço</h2>
      <p>O Amora é um diário pessoal para organizar o dia a dia. Ele é oferecido como está, e pode mudar ao longo do tempo.</p>

      <h2>A sua conta</h2>
      <p>Você é responsável por manter a sua senha em segurança e pelo que faz na sua conta. Recomendamos ativar a verificação em duas etapas em Perfil.</p>

      <h2>O seu conteúdo</h2>
      <p>O que você escreve continua sendo seu. Pedimos só o necessário para armazenar e mostrar esse conteúdo a você. Exporte uma cópia quando quiser.</p>

      <h2>Uso aceitável</h2>
      <p>Não use o Amora para atividades ilegais, nem para tentar acessar dados de outras pessoas ou prejudicar o serviço.</p>

      <h2>Encerramento</h2>
      <p>Você pode excluir a conta a qualquer momento em Perfil. A exclusão é definitiva.</p>

      <p style={{ marginTop: 28 }}><Link className="btn btn-s" href="/entrar">Voltar</Link></p>
    </main>
  );
}
