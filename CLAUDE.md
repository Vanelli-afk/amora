# Amora

Web app de journal para organização do dia a dia: calendário embutido, compromissos, tarefas, notas e lembretes, com uma estante de livros. Visual de diário: compacto, cozy, fluido. Mobile-first (PWA) e também confortável no PC, com contas sincronizadas entre dispositivos.

## Stack

- **Next.js 15 (App Router) + React 19 + TypeScript** em um único projeto full-stack
- **PostgreSQL 17** com **Drizzle ORM** (`drizzle-kit` para migrações)
- **Better Auth**: e-mail/senha + Google
- **Zod** para validar entradas das Server Actions
- **date-fns** para datas
- CSS próprio (variáveis em `globals.css`), sem biblioteca de UI

## Comandos

```bash
npm install
npm run setup            # gera o .env com segredos e sobe o Postgres do projeto
npm run db:migrate       # aplica as migrações
npm run db:seed          # opcional: conta demo@amora.local / amora-demo-2026 com os dados do design
npm run dev              # http://localhost:3000
npm run worker           # em outro terminal: envia lembretes e resumos

npm run link:conta -- pessoa@exemplo.com   # link de confirmação de conta, enquanto não há e-mail
npm run db:up            # liga o Postgres do projeto depois de reiniciar o PC (db:down desliga)
npm run db:generate      # gera uma migração depois de mudar o schema
npm run typecheck && npm run lint
npm test                 # unidade e integração (banco amora_test)
npm run test:e2e         # navegador, desktop e celular; pare o `npm run dev` antes: usam a mesma .next
npm run test:e2e:prod    # o mesmo no build de produção; pega o que `next dev` não mostra. Rode antes de cada deploy
```

O Postgres local roda em um cluster só do projeto (`.pgdata/`, porta 54329), com os binários do Postgres 17 da máquina. Para publicar, siga [docs/lancamento.md](docs/lancamento.md); os motivos e os caminhos de volta estão em [docs/decisoes-deploy.md](docs/decisoes-deploy.md).

## Estrutura

```
src/
  app/            rotas: (app) privadas, (auth) entrada, (publico) termos e privacidade; layouts; globals.css (base do design), amora.css (responsivo e animações)
  actions/        Server Actions; todas via defineAction (lib/action.ts)
  data/           únicas funções que tocam o banco; sempre recebem userId e cuidam da criptografia
  components/     ui/ (primitivos), shell/, item/, dia/, calendario/, tarefas/, notas/, livros/, perfil/
  db/             schema.ts, index.ts, seed.ts
  lib/            auth, crypto, dates, timeline, recurrence, holidays, streak, image, allowed-emails, book-search…
  worker/         lembretes, resumos e limpezas, em desenvolvimento; em produção, a rota api/cron/tick chama o mesmo ciclo
  middleware.ts   CSP com nonce e redirecionamento de quem não tem sessão
public/sw.js      service worker: push e página offline; nunca guarda dados privados
e2e/              testes de navegador
drizzle/          migrações geradas
docs/design/      telas e CSS extraídos do design original, para consulta
```

## Modelo de dados

Colunas `*_enc` guardam texto cifrado (AES-256-GCM por usuário e campo, `lib/crypto.ts`).

- Auth (Better Auth): `user`, `session`, `account`, `verification`, `two_factor`, `rate_limit`
- `user_settings`: tema, fuso, metas (passos, água em ml, páginas, livros), notificações
- `day_entries`: uma linha por usuário/dia (humor 1-5, água em ml, passos, sono em minutos, adesivo, gratidão, reflexão)
- `events` + `event_exceptions`: compromissos (início/fim opcionais, cor, recorrência); editar "só este" pula o dia na série e cria um avulso
- `tasks`: data opcional, `done`, `position`, destaque
- `notes`: post-it (texto puro) ou nota (JSON do editor, filtrado por `sanitizeDoc`)
- `habits` + `habit_logs`: a sequência é calculada, não armazenada
- `books` + `book_quotes` + `reading_logs`: estante (`reading` / `next` / `finished`), progresso, nota, resenha, citações
- `reminders`: `fire_at` em UTC; dia, hora e antecedência permitem recalcular ao trocar de fuso
- `files`: imagens em WebP, com os bytes na própria linha (`body`). Selecione `body` só ao servir o arquivo
- `push_subscriptions`, `action_limits`

## Convenções

- Todo dado pertence a um `userId`; **toda query filtra por usuário da sessão**. Nunca confie em `userId` vindo do cliente. Só `src/data` importa o banco (regra de ESLint); toda operação nova ganha caso em `src/data/isolation.test.ts`.
- Texto escrito pelo usuário vai cifrado: nunca em coluna comum, nunca em log. Sem `dangerouslySetInnerHTML`.
- Em arquivos `"use server"`, schemas com funções (`.refine`, `.transform`) ficam em constantes fora do `export`. Constantes usadas por Server Components não podem vir de módulos `"use client"`.
- Não usar `view-transition-name` dentro de layout `columns`: derruba o renderizador do Chromium.
- Não colocar `loading.tsx` acima de rotas dinâmicas: em produção, trocar de dia ficava preso sem erro nenhum. Veja [docs/decisoes-deploy.md](docs/decisoes-deploy.md). `compress: false` no `next.config.ts` existe para o teste local não esconder esse tipo de bug.
- Mudou algo que só existe em produção (CSP, cookies, cabeçalhos, navegação)? Rode `npm run test:e2e:prod`: `next dev` não mostra.
- Datas de dia são `date` do Postgres como string `YYYY-MM-DD`, no fuso do usuário (America/Sao_Paulo). Não converter via `Date` para evitar deslocamento de dia.
- Mutações via Server Actions com validação Zod e `revalidatePath`; UI otimista (`useOptimistic`) para marcar tarefas e trocar de dia sem travar.
- Server Components por padrão; `"use client"` só onde há interação.
- Mobile-first: layout de uma coluna, alvos de toque de pelo menos 44px, navegação por dia com gesto/atalho.
- Paleta pastel (sky, lavender, peach, sage, rose, sand) em variáveis CSS; fundo creme, tipografia serifada para o número do dia.
- Textos da interface em português do Brasil.
- Sem comentários óbvios; comente apenas o porquê.

## Escopo

**Feito:** autenticação (e-mail/senha, Google, 2FA), visão do dia, calendário mensal e semanal, tarefas, notas, estante de livros, perfil, exportar e excluir conta, busca, lembretes com push (PWA).

**Fora por enquanto:** sincronização com o Google Agenda, edição offline, RLS no Postgres.

## Status atual

- Publicado para uso pessoal em https://amora-lavanda.vercel.app (Vercel Hobby + Supabase + cron-job.org), com o despertador respondendo `200`. Faltam os testes reais e o backup: passos 6 e 7 de [docs/lancamento.md](docs/lancamento.md).
- Testes de unidade, integração e navegador passam, inclusive no build de produção. "Reordenar tarefas" falhou uma vez em dev, sem causa encontrada: veja "Em aberto" em [docs/decisoes-deploy.md](docs/decisoes-deploy.md).
- O CI (`.github/workflows/ci.yml`) e o Node 24 ainda não rodaram; a máquina local usa a v26.
- Termos e privacidade são rascunhos, o que só é aceitável enquanto o uso for pessoal.
- `npm audit`: restam avisos moderados só do `drizzle-kit` (desenvolvimento). `postcss` está forçado por `overrides`; rever ao atualizar o Next.

## O que ainda não foi comprovado

Implementado, mas sem verificação de ponta a ponta. Não tratar como pronto para produção:

- **Notificação chegando de verdade:** só a lógica de envio foi testada, porque o navegador automatizado bloqueia notificações. Falta testar em um Chrome real: ativar em Perfil › Notificações › Neste aparelho, com `npm run worker` rodando, e criar um lembrete para daqui a 2 minutos. No celular, exige HTTPS; no iPhone, o app adicionado à Tela de Início.
- **Busca de livros:** não testada com a Open Library nem com o Google Books de verdade, incluindo o download de capas.
- **Login com Google:** faltam as credenciais; o botão fica oculto sem elas.
- **Envio real de e-mail:** nenhum SMTP foi testado; em desenvolvimento, os links saem no log do servidor.
- **Desempenho em rede lenta:** LCP, CLS e INP foram medidos em `localhost`, com CPU 4× mais lenta e sem atraso de rede. O INP veio de um único clique.
- **Lighthouse nas telas internas:** só `/entrar` foi medida; as demais telas passaram apenas pelo axe.

## Referências visuais

Planner digital (visão do dia com agenda colorida, tarefas, notas e frase do dia), agenda de papel (visão mensal com anotações e adesivos) e Readowl (estante com prateleiras "Lendo / Próximos / Terminados").