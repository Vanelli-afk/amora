# Checklist de lançamento público

O Amora roda localmente. Para abrir ao público, é preciso decidir e configurar o que está abaixo. Nada disto está feito.

## Bloqueia o lançamento

- [ ] **Hospedagem com HTTPS.** Sem HTTPS, o PWA e o push não funcionam em outros aparelhos.
- [ ] **Proxy confiável na frente do app.** O limite de tentativas usa o IP de `x-forwarded-for`. Exposto direto à internet, o cliente pode falsificar esse cabeçalho e escapar do limite. O proxy precisa sobrescrever o cabeçalho, nunca repassar o valor recebido.
- [ ] **E-mail transacional.** Definir `SMTP_URL` e `EMAIL_FROM` com domínio próprio. Em produção o app não inicia sem `SMTP_URL`.
- [ ] **Segredos novos.** Gerar `BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY` e as chaves VAPID para produção. Nunca reaproveitar os de desenvolvimento.
- [ ] **Custódia da chave.** Guardar `DATA_ENCRYPTION_KEY` em um cofre, com backup separado do banco. **Perder essa chave significa perder todos os textos, sem recuperação.**
- [ ] **Backups cifrados do banco e de `STORAGE_DIR`**, com restauração testada.
- [ ] **Worker sempre ativo.** `npm run worker` precisa rodar como serviço, ou os lembretes não saem.
- [ ] **Migrações.** Rodar `npm run db:migrate` no deploy. Em produção, não usar `db:push`.
- [ ] **Usuário do banco** sem permissão de superusuário e com TLS, se o banco estiver em outra máquina.
- [ ] **Revisão jurídica** de `/termos` e `/privacidade`: são rascunhos, e faltam o controlador e o contato do encarregado de dados (LGPD).
- [ ] **Login com Google** (opcional): credenciais de produção com a URL de callback do domínio final.

## Recomendado

- [ ] Google Books: `GOOGLE_BOOKS_API_KEY`, para complementar a Open Library.
- [ ] Monitoramento de erros **sem conteúdo do usuário** nos eventos.
- [ ] Limitar a taxa também no proxy, como segunda barreira.
- [ ] RLS no Postgres como segunda barreira de isolamento (ficou de fora de propósito; a proteção atual é a camada `src/data` com testes de acesso cruzado).
- [ ] `npm audit` e atualização de dependências em rotina.

## Testar push em um celular antes do lançamento

Push exige HTTPS. Use um túnel para o servidor local e ajuste `BETTER_AUTH_URL` para o endereço dele. No iPhone, o push só funciona com o app adicionado à Tela de Início.
