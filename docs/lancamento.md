# Guia de deploy

Passo a passo para publicar o Amora para uso pessoal: Vercel Hobby, Supabase gratuito e cron-job.org. Os motivos e as alternativas estão em [decisoes-deploy.md](decisoes-deploy.md).

**Situação em 2026-11-06:** publicado em `https://amora-lavanda.vercel.app`, com o despertador respondendo `200`. Os testes do passo 6 e o backup do passo 7 ainda não foram feitos. As caixas dos passos 1 a 4 não foram revisadas item a item.

## Antes de começar

- [ ] Rodar `npm run typecheck && npm run lint && npm test`.
- [ ] Rodar `npm run test:e2e:prod` com o `npm run dev` parado: usam a mesma pasta `.next`.
- [ ] Confirmar que o CI passou no GitHub, com o Node 24.

## 1. Banco (Supabase)

- [ ] Criar um projeto na região **South America (São Paulo)**.
- [ ] Guardar a senha do banco no gerenciador de senhas.
- [ ] Copiar a URL do pooler em **modo transação** (porta 6543): será `DATABASE_URL`.
- [ ] Copiar a URL do pooler em **modo sessão** (porta 5432): será `DATABASE_URL_MIGRATIONS`.

A conexão direta do plano gratuito só funciona por IPv6, e por isso não serve aqui.

## 2. Segredos

Gerar valores novos. **Nunca reaproveitar os do `.env` local.**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # DATA_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"      # CRON_SECRET
npx web-push generate-vapid-keys                                              # chaves VAPID
```

- [ ] **Guardar `DATA_ENCRYPTION_KEY` em um gerenciador de senhas, separada dos backups. Perder essa chave significa perder todos os textos, sem recuperação.**
- [ ] Guardar também `BETTER_AUTH_SECRET` e a chave privada VAPID. Trocar a primeira derruba as sessões e provavelmente invalida o 2FA; trocar a segunda invalida as inscrições de push.

## 3. E-mail

- [ ] Ativar a verificação em duas etapas na conta Gmail e criar uma senha de app.
- [ ] Montar `SMTP_URL` no formato `smtps://CONTA%40gmail.com:SENHA_DE_APP@smtp.gmail.com:465`. O `@` da conta vira `%40`, e os espaços da senha de app são removidos.
- [ ] Usar o mesmo endereço em `EMAIL_FROM`, por exemplo `Amora <CONTA@gmail.com>`.

O envio pelo Gmail ainda não foi testado com o Amora.

## 4. Vercel

- [ ] Importar o repositório `Vanelli-afk/amora` no plano Hobby. O Next.js é detectado sozinho, e `vercel.json` já fixa a região `gru1`.
- [ ] Desativar os deploys de preview, ou deixar as variáveis abaixo só em Production: previews não podem usar o banco de produção, e a autenticação não funciona neles.
- [ ] Definir as variáveis de ambiente abaixo em Production.

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Pooler, modo transação (porta 6543) |
| `DATABASE_URL_MIGRATIONS` | Pooler, modo sessão (porta 5432) |
| `BETTER_AUTH_SECRET` | Gerado no passo 2 |
| `BETTER_AUTH_URL` | `https://SEU-PROJETO.vercel.app`, sem barra no final |
| `DATA_ENCRYPTION_KEY` | Gerado no passo 2 |
| `CRON_SECRET` | Gerado no passo 2 |
| `ALLOWED_EMAILS` | Os e-mails de vocês, separados por vírgula |
| `SMTP_URL` | Do passo 3 |
| `EMAIL_FROM` | Do passo 3 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública do passo 2 |
| `VAPID_PRIVATE_KEY` | Chave privada do passo 2 |
| `VAPID_SUBJECT` | `mailto:CONTA@gmail.com` |

Sem as variáveis exigidas, o build ou a primeira requisição falha, de propósito, com o nome das que faltam, mas nunca com os valores.

- [ ] Publicar. O script `vercel-build` aplica as migrações só em produção e depois gera o build.

**Se a conexão falhar por certificado** (`self-signed certificate`): o Postgres do Supabase usa uma CA própria, o que pode exigir configurar o certificado no `pg`. Não desligar a verificação para contornar.

## 5. Despertador (cron-job.org)

- [x] Criar uma tarefa para `https://SEU-PROJETO.vercel.app/api/cron/tick`, a cada 1 minuto.
- [x] Adicionar o cabeçalho `Authorization: Bearer SEU_CRON_SECRET`.
- [ ] Ativar o aviso por e-mail em caso de falha.
- [x] Conferir no histórico da tarefa que a resposta é `200`. `401` indica segredo errado.

## 6. Testar de verdade

- [ ] Criar as duas contas com os e-mails reais e confirmar o link recebido.
- [ ] Tentar criar conta com outro e-mail: deve aparecer "Este e-mail não tem acesso ao Amora."
- [ ] Trocar de dia no calendário e na visão do dia várias vezes, sem nenhum clique se perder.
- [ ] Enviar uma foto e uma capa, e buscar um livro com capa.
- [ ] Exportar os dados da conta.
- [ ] Em cada iPhone (iOS 16.4 ou mais recente):
  - [ ] Abrir o link no Safari, tocar em Compartilhar e em "Adicionar à Tela de Início".
  - [ ] Abrir o Amora **pelo ícone** e entrar.
  - [ ] Ativar em Perfil › Notificações › Neste aparelho.
  - [ ] Criar um lembrete para daqui a 3 minutos, bloquear o celular e conferir se chega.

## 7. Backup

- [ ] Fazer um dump periódico e guardá-lo cifrado, fora do Supabase, porque é o diário de vocês:

```bash
pg_dump "URL_DO_MODO_SESSAO" --format=custom --file=amora.dump
```

- [ ] **Restaurar uma vez em um banco limpo** e abrir o app apontando para ele, para confirmar que os textos são decifrados com a chave guardada.

## Depois de publicar

- Observar se alguma tarefa volta à ordem antiga depois de reordenar: veja "Em aberto" em [decisoes-deploy.md](decisoes-deploy.md).
- Olhar o uso do banco no painel do Supabase depois de alguns dias.
- Rodar `npm audit` e atualizar dependências de tempos em tempos.

## Se um dia abrir para outras pessoas

Tudo isto passa a ser obrigatório:

- [ ] Revisão jurídica de `/termos` e `/privacidade`, com os itens de [decisoes-deploy.md](decisoes-deploy.md).
- [ ] Domínio próprio com e-mail transacional, SPF, DKIM e DMARC.
- [ ] Rever `ALLOWED_EMAILS` e o plano Hobby, que não permite uso comercial.
- [ ] Monitoramento de erros **sem conteúdo do usuário** nos eventos.
- [ ] Limite de taxa também na borda, e RLS no Postgres como segunda barreira de isolamento.
- [ ] Aumentar o HSTS (hoje 30 dias, sem preload) quando o domínio estiver estável.
