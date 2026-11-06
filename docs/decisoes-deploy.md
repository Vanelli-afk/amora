# Decisões de deploy

Registro do que foi decidido, por quê e como voltar atrás. O passo a passo está em [lancamento.md](lancamento.md).

Última atualização: 2026-11-06. Limites de planos mudam: confira as fontes antes de decidir com base neles.

## Contexto

O Amora é de uso pessoal, principalmente para a namorada do Miguel. Os dois usam iPhone. Não há plano de lançamento público no curto prazo, e a meta é não pagar nada enquanto for assim.

## Resumo

| # | Decisão | Situação |
|---|---|---|
| 1 | Hospedagem: Vercel Hobby | Em vigor |
| 2 | Banco: Supabase gratuito, região São Paulo | Em vigor, substitui o Neon |
| 3 | Lembretes: agendador externo a cada 1 minuto | Em vigor |
| 4 | Imagens guardadas no Postgres | Em vigor, implementado |
| 5 | Cadastro restrito por lista de e-mails | Em vigor, implementado |
| 6 | Sem `loading.tsx` acima de rotas dinâmicas | Em vigor, implementado |
| 7 | Revisão jurídica adiada | Em vigor enquanto o uso for pessoal |

## 1. Hospedagem: Vercel Hobby

**Por quê:** é gratuita e o uso é pessoal, o que o plano exige.

**Consequências:** o corpo de uma requisição é limitado a 4,5 MB, por isso o upload aceita até 4 MB. Não há processo contínuo, por isso o worker também existe como a rota `/api/cron/tick`.

**Quando rever:** se o Amora tiver qualquer fim comercial, o Hobby deixa de valer e é preciso migrar para o Pro.

**Alternativa guardada: servidor próprio (VPS).** Com um processo contínuo, `npm run worker` volta a servir e os lembretes não dependem de agendador externo. Em troca, é preciso operar o servidor, o HTTPS, os backups e o proxy, que precisa sobrescrever `x-forwarded-for`; sem isso, o limite de tentativas pode ser burlado.

## 2. Banco: Supabase em vez de Neon

**Por quê:** o despertador de 1 minuto mantém o banco sempre ligado. O plano gratuito do Neon cobre cerca de 400 horas por mês e, ao estourar, **desliga o banco até o mês seguinte**, derrubando o app inteiro. O Supabase não conta horas de banco ligado.

**Conta que levou à decisão** (Neon gratuito: 100 CU-horas, cerca de 400 horas em 0,25 CU, e cada acesso mantém o banco ligado por 5 minutos):

| Intervalo do despertador | Horas ligado por mês | Resultado no Neon |
|---|---|---|
| 1 minuto | cerca de 730 | Estoura a cota |
| 10 minutos | cerca de 365, mais o uso normal | No limite |
| 15 minutos | cerca de 243 | Com folga, mas o atraso chega a 15 minutos |

**Limites do Supabase gratuito:** 500 MB de banco por projeto. O projeto pausa após cerca de uma semana sem uso, o que o despertador deve evitar. Ainda não foi verificado em produção.

**Conexões:**

| Variável | Modo | Porta | Por quê |
|---|---|---|---|
| `DATABASE_URL` | Pooler, transação | 6543 | Recomendado pelo Supabase para funções serverless |
| `DATABASE_URL_MIGRATIONS` | Pooler, sessão | 5432 | A conexão direta do plano gratuito só funciona por IPv6; usar o modo sessão para migrações é inferência nossa, a confirmar no primeiro deploy |

O código não usa prepared statements nomeados nem advisory locks, que são os recursos sensíveis ao modo transação.

**Como voltar para o Neon:**
1. Criar o projeto no Neon, em `aws-sa-east-1`. A região não muda depois de criada.
2. Definir `DATABASE_URL` com a URL do pooler e `DATABASE_URL_MIGRATIONS` com a conexão direta.
3. Se já houver dados, copiar com `pg_dump` e `pg_restore`, preservando `DATA_ENCRYPTION_KEY`.
4. Aumentar o intervalo do despertador para 15 minutos ou mais, ou contratar um plano pago. O código não muda.

## 3. Lembretes: agendador externo a cada 1 minuto

**O problema:** na Vercel, o app só roda quando recebe uma visita, e um lembrete precisa sair mesmo sem ninguém usando. Um agendador visita `/api/cron/tick` periodicamente, e o app envia o que estiver vencido.

**Por quê externo:** no Hobby, o agendador da Vercel não serve. A documentação de Cron Jobs fala em uma execução por dia, com até 59 minutos de imprecisão, e a de Schedules, em até uma a cada 15 minutos. Por isso `vercel.json` não declara `crons`: uma frequência acima do permitido faz o deploy falhar.

**Escolha:** cron-job.org, a cada 1 minuto, com o cabeçalho `Authorization: Bearer <CRON_SECRET>`. Os dados dele vieram de páginas de terceiros; confirmar ao configurar.

**Consequências:** o lembrete chega com até cerca de 1 minuto de atraso. Se o agendador cair, os lembretes atrasam até ele voltar, porque ficam pendentes no banco.

**Comportamento de falha:** o lembrete é marcado como enviado antes do envio. Se o envio falhar, ele **não é reenviado**: um aviso duplicado foi considerado pior. Uma falha em um item não afeta os outros, e séries e resumos continuam agendados.

**Como voltar:** o intervalo muda no painel do agendador, sem mexer no código. No Pro, basta declarar `crons` em `vercel.json`, porque a rota aceita `GET` com esse cabeçalho, que é o formato da Vercel.

## 4. Imagens no Postgres

**Por quê:** a Vercel não tem disco persistente. As imagens são WebP reduzidas (avatar de 256 px, capa de até 600×900), então cabem no banco. O backup passa a cobrir os arquivos, e excluir a conta apaga tudo em cascata.

**Quando rever:** se as imagens começarem a pesar na cota de 500 MB, mover para um armazenamento de objetos (R2 ou Blob).

**Dados antigos:** as 4 imagens do banco local foram copiadas e conferidas por hash. A pasta `storage/` não é mais lida; pode ser apagada quando quiser.

## 5. Cadastro restrito

**Como funciona:** `ALLOWED_EMAILS` lista os e-mails permitidos, separados por vírgula. Vale para e-mail e Google. Em produção, o app não inicia sem ela, para o cadastro nunca ficar aberto por esquecimento.

**Como mudar:** editar a variável na Vercel e refazer o deploy. Para liberar todos, usar `*`.

**Limite:** remover alguém da lista só impede novos cadastros. Uma conta existente continua funcionando.

**Detalhe de implementação:** a conferência existe em dois pontos. No hook antes do cadastro, para a pessoa ver o motivo, já que, dentro do cadastro, o Better Auth responde sucesso mesmo com erro. E na criação do usuário, que também cobre o Google.

## 6. Sem `loading.tsx` acima de rotas dinâmicas

**O bug:** com `src/app/(app)/loading.tsx`, trocar de dia no calendário ou na visão do dia ficava preso para sempre: a URL e a tela não mudavam, sem nenhum erro. Só acontecia em produção, e a compressão escondia boa parte dos casos.

**O que foi medido** (navegações presas, sem compressão, em 56 tentativas por versão):

| Versão | Presas |
|---|---|
| Original | 14 |
| Sem o `ItemHost` | 14 |
| Metadados sem streaming | 12 |
| **Sem o `loading.tsx`** | **0** |

Também foram descartados, por teste: service worker, CSP, prefetch, hover e versão do Node. O servidor sempre respondeu certo; a transição é que não concluía no navegador.

**Limite do que se sabe:** a remoção resolve de forma comprovada, mas o mecanismo interno exato não foi identificado. Pode ser um bug do Next 15.5.29.

**Consequência:** não há mais tela de esqueleto ao navegar. Em rede lenta, a página atual fica visível até a próxima chegar. O efeito em rede lenta real não foi medido.

**Como voltar:** recuperar o arquivo do histórico do git e rodar `npm run test:e2e:prod`. Os testes "sempre responde" devem continuar passando; se falharem, o bug ainda existe.

**Relacionado:** `compress: false` em `next.config.ts` faz o teste local se aproximar do streaming da Vercel, que comprime na própria infraestrutura. Sem isso, o bug passa despercebido na maior parte das vezes.

## 7. Revisão jurídica adiada

**Por quê:** os termos e a política são rascunhos, o que é aceitável enquanto só vocês dois usarem.

**Antes de abrir para outras pessoas:**
- Identificar o controlador e o canal do encarregado de dados.
- Incluir hospedagem e banco em "com quem compartilhamos".
- Tratar transferência internacional e prazos de retenção.
- Ajustar "a exclusão apaga de forma definitiva": os backups guardam os dados por algum tempo.
- Remover o aviso de rascunho.

## Em aberto

- **Teste instável:** "reordenar tarefas pelo teclado persiste" falhou uma vez em dev, em uma rodada completa: a nova ordem apareceu e não estava lá depois de recarregar. Passou nas rodadas de produção e em 8 de 8 repetições isoladas. A causa não foi encontrada. Como pode indicar uma gravação perdida, vale observar no uso real.
- **Taxa de falha do bug 6:** variou bastante entre rodadas com compressão (11 a 32 de 72), sem explicação.
- **Monitoramento de erros:** ainda não existe.

## Fontes

- [Vercel: uso e preços de Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel: limites de Schedules](https://vercel.com/docs/schedules/limits)
- [Vercel: limites de Functions](https://vercel.com/docs/functions/limitations)
- [Vercel: plano Hobby](https://vercel.com/docs/plans/hobby)
- [Neon: limites do plano gratuito](https://neon.com/faqs/free-plan-limits-and-quotas)
- [Neon: regiões](https://neon.com/docs/introduction/regions)
- [Supabase: preços](https://supabase.com/pricing)
- [Supabase: regiões](https://supabase.com/docs/guides/platform/regions)
- [Supabase: como conectar](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: pausa de projetos gratuitos](https://supabase.com/docs/guides/platform/free-project-pausing)
- [cron-job.org em diretório de terceiros](https://freetier.co/directory/products/cron-joborg)
