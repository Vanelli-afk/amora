import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacidade" };

// Rascunho: precisa de revisão jurídica e dos dados do controlador antes de um lançamento público.
export default function PrivacidadePage() {
  return (
    <main className="legal">
      <h1>Política de privacidade</h1>
      <p className="t2">Rascunho para revisão antes do lançamento público.</p>

      <h2>O que guardamos</h2>
      <ul>
        <li>Conta: nome, e-mail, foto (opcional) e senha, armazenada só como hash.</li>
        <li>O que você escreve: compromissos, tarefas, notas, reflexões, hábitos e livros.</li>
        <li>Técnico: sessões de acesso (aparelho e IP), para manter a conta segura.</li>
      </ul>

      <h2>Para que usamos</h2>
      <p>Só para fazer o Amora funcionar para você. Não vendemos dados, não mostramos anúncios e não usamos o que você escreve para nenhuma outra finalidade.</p>

      <h2>Como protegemos</h2>
      <ul>
        <li>Conexão criptografada e isolamento: cada conta só acessa os próprios dados.</li>
        <li>Títulos, notas, reflexões, resenhas e citações ficam cifrados no banco de dados, com uma chave guardada fora dele.</li>
        <li>Imagens enviadas são regravadas para remover metadados, como localização.</li>
      </ul>

      <h2>Com quem compartilhamos</h2>
      <p>Só com serviços necessários ao funcionamento: envio de e-mails da conta, login com Google (se você escolher) e o serviço de notificações do seu navegador, que recebe o conteúdo cifrado. Ao buscar um livro, o termo pesquisado é enviado às bases públicas Open Library ou Google Books, a partir dos nossos servidores e sem identificar você.</p>

      <h2>Seus direitos (LGPD)</h2>
      <p>Em <Link className="link" href="/perfil">Perfil</Link> você pode corrigir os seus dados, exportar tudo em JSON e excluir a conta. A exclusão apaga os dados e arquivos de forma definitiva.</p>

      <h2>Contato</h2>
      <p>O canal de contato do encarregado de dados será informado aqui antes do lançamento.</p>

      <p style={{ marginTop: 28 }}><Link className="btn btn-s" href="/entrar">Voltar</Link></p>
    </main>
  );
}
