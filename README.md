# Sistema Interno IEEE UFJF

Documentacao principal do projeto `atasieeeufjf`.

Ultima revisao desta documentacao: `2026-06-28`

## 1. Visao geral

Este repositorio implementa o **Sistema Interno IEEE UFJF**, publicado em
`interno.ieeeufjf.com.br`.

O projeto comecou como sistema de geracao e banco de atas, mas hoje e a
plataforma interna do Ramo Estudantil IEEE UFJF. Ele centraliza:

- autenticacao de usuarios;
- homepage interna com atalhos dos modulos;
- geracao, salvamento e consulta de atas;
- tarefas internas por capitulo;
- calendario interno com eventos recorrentes;
- area de diretoria;
- metricas de tarefas por membro;
- cadastro e gestao de membros;
- administracao do conteudo do site publico;
- modo demo aberto para visitantes;
- notificacoes por e-mail;
- sincronizacao de tarefas e eventos com Firebase;
- modulo de arquivos pessoais, atualmente configuravel/desabilitavel.

O sistema foi desenhado para manter as funcoes originais de atas e, ao mesmo
tempo, permitir a gestao interna do Ramo e dos capitulos.

## 2. Estado atual

Funciona hoje:

- login em `/login`;
- redirecionamento automatico de usuarios deslogados para login;
- homepage interna em `/`;
- modo demo publico em `/demo`;
- hub de atas em `/atas`;
- banco de atas salvas em `/atas/banco`;
- criacao de nova ata em `/atas/nova`;
- geracao de PDF no navegador com SwiftLaTeX;
- templates de ata para Ramo e capitulos;
- salvamento de atas e metadados de anexos no PostgreSQL;
- pagina de tarefas em `/tarefas`;
- pagina de calendario em `/calendario`;
- pagina de membros em `/membros`;
- area restrita de diretoria em `/diretoria`;
- subrotas de diretoria para membros, metricas e site;
- administracao de membros publicados no site;
- administracao de projetos publicados no site;
- administracao de fotos da homepage do site;
- administracao e importacao de fotos historicas do site;
- APIs publicas para o site `SiteRamo`;
- notificacoes via Resend;
- sincronizacao com Firebase;
- protecoes de login, sessao, permissao e rate limit.

Pontos importantes:

- a antiga rota publica `/admin` foi removida;
- a administracao do site fica dentro de `/diretoria/site`;
- o sistema de atas continua existindo, mas agora e um modulo do Sistema Interno;
- o banco PostgreSQL e a fonte primaria de dados;
- o Firebase e usado para sincronizacao com o aplicativo;
- o modulo de arquivos pode ser desabilitado com `INTERNAL_FILES_STORAGE_MODE=disabled`;
- o modo demo nao deve gravar dados reais nem enviar PDF ao servidor.

## 3. Tecnologias

Principais tecnologias:

- Next.js 16;
- React 19;
- Prisma 7;
- PostgreSQL;
- Resend;
- SwiftLaTeX/WebAssembly;
- templates LaTeX por capitulo;
- Firebase para sincronizacao com o aplicativo;
- DeepL para traducao automatica de biografias;
- CSS global em `src/app/globals.css`.

Scripts principais:

```bash
npm run dev
npm run build
npm run start
npm run db:generate
npm run db:push
npm run db:studio
```

Scripts auxiliares:

```bash
npm run members:import-contacts
npm run site-projects:seed-chapters
npm run vendor:texlive
```

## 4. Estrutura do repositorio

Principais diretorios:

- [`src/app`](./src/app): rotas App Router, paginas e APIs.
- [`src/components`](./src/components): telas e componentes React.
- [`src/lib`](./src/lib): regras de negocio, banco, auth, atas, e-mails e integracoes.
- [`prisma`](./prisma): schema Prisma do banco PostgreSQL.
- [`classes`](./classes): templates LaTeX por capitulo.
- [`public`](./public): logos, fontes, fotos, SwiftLaTeX e assets.
- [`scripts`](./scripts): scripts de manutencao, importacao e build.
- [`ata-receiver`](./ata-receiver): servico auxiliar para recebimento externo de arquivos/PDFs.
- [`texlive`](./texlive): arquivos TeX locais usados pelo SwiftLaTeX.

Arquivos mais importantes:

- [`middleware.js`](./middleware.js): protecao de rotas e redirecionamento para login.
- [`src/app/layout.jsx`](./src/app/layout.jsx): layout raiz e metadados.
- [`src/app/globals.css`](./src/app/globals.css): tema visual do sistema.
- [`prisma/schema.prisma`](./prisma/schema.prisma): modelos de dados.
- [`src/lib/auth.js`](./src/lib/auth.js): autenticacao, usuarios, sessoes e permissoes.
- [`src/lib/ata.js`](./src/lib/ata.js): templates, sociedades e renderizacao LaTeX.
- [`src/lib/saved-atas.js`](./src/lib/saved-atas.js): banco de atas salvas.
- [`src/lib/internal.js`](./src/lib/internal.js): tarefas, calendario e metricas.
- [`src/lib/email-notifications.js`](./src/lib/email-notifications.js): e-mails do sistema.
- [`src/lib/firebase-sync.js`](./src/lib/firebase-sync.js): sincronizacao com Firebase.
- [`src/lib/site-members.js`](./src/lib/site-members.js): membros do site publico.
- [`src/lib/site-projects.js`](./src/lib/site-projects.js): projetos do site publico.
- [`src/lib/site-home-photos.js`](./src/lib/site-home-photos.js): fotos da home do site.
- [`src/lib/site-history-photos.js`](./src/lib/site-history-photos.js): fotos historicas do site.
- [`src/lib/internal-files.js`](./src/lib/internal-files.js): arquivos pessoais.

## 5. Paginas do sistema

## 5.1 `/login`

Pagina de autenticacao.

Funcoes:

- exibir o formulario de login;
- permitir acesso ao modo demo;
- redirecionar usuario autenticado para a homepage;
- usar layout em tela cheia com identidade visual do Ramo.

Rotas de API relacionadas:

- `POST /api/auth/login`
- `POST /api/auth/setup`
- `GET /api/auth/me`

## 5.2 `/`

Homepage interna.

Funcoes:

- saudar o usuario;
- exibir slideshow/fotos do Ramo quando configurado;
- oferecer atalhos para atas, tarefas, calendario e diretoria;
- mostrar o botao de diretoria apenas para usuarios autorizados;
- permitir alternancia de tema.

## 5.3 `/atas`

Hub do modulo de atas.

Funcoes:

- perguntar se o usuario quer consultar banco de atas ou criar nova ata;
- direcionar para `/atas/banco` ou `/atas/nova`;
- manter o fluxo de atas separado da homepage.

## 5.4 `/atas/nova`

Gerador de atas.

Funcoes:

- escolher template visual por capitulo;
- preencher dados da reuniao;
- adicionar membros presentes;
- adicionar pautas;
- adicionar resultados;
- adicionar anexos;
- salvar ata;
- gerar PDF no navegador;
- abrir rascunhos;
- importar/exportar JSON.

Comportamento importante:

- o cargo dos membros e calculado conforme o capitulo da ata;
- atas do Ramo mostram cargos no formato `CARGO-Capitulo`;
- atas de capitulo mostram diretoria do capitulo apenas com o cargo;
- presidente de outro capitulo aparece como `Presidente-Capitulo`;
- demais membros aparecem como `Membro`.

## 5.5 `/atas/banco`

Banco de atas salvas.

Funcoes:

- listar atas por capitulo;
- respeitar capitulos visiveis ao usuario;
- abrir ata no gerador;
- gerar PDF de ata salva;
- renomear ata;
- excluir ata.

## 5.6 `/tarefas`

Modulo de tarefas internas.

Funcoes:

- listar tarefas abertas e concluidas;
- filtrar por capitulo;
- criar tarefa por popup;
- escolher prioridade, prazo, status e responsavel;
- criar tarefa para um usuario especifico ou para o capitulo;
- editar tarefa;
- concluir tarefa;
- excluir tarefa;
- sincronizar com Firebase;
- enviar notificacoes por e-mail quando habilitado.

## 5.7 `/calendario`

Modulo de calendario.

Funcoes:

- listar eventos;
- exibir calendario do dia;
- mostrar horarios agendados;
- criar evento por popup;
- editar evento;
- excluir evento;
- excluir serie recorrente;
- criar eventos recorrentes;
- usar datas/horas em BRT;
- sincronizar com Firebase;
- enviar e-mail de notificacao quando habilitado.

## 5.8 `/membros`

Lista de membros visiveis.

Funcoes:

- pesquisar membros;
- listar membros por escopo permitido;
- apoiar o preenchimento de atas;
- mostrar cargos e capitulos.

## 5.9 `/diretoria`

Painel restrito de diretoria.

Funcoes:

- centralizar atalhos de gestao;
- abrir cadastro de membros;
- abrir metricas de tarefas;
- abrir administracao do site;
- mostrar acesso negado para usuarios sem permissao.

## 5.10 `/diretoria/membros`

Cadastro e gestao de usuarios.

Funcoes:

- criar novo usuario/membro;
- informar e-mail;
- definir capitulos;
- definir cargos por capitulo;
- editar membros existentes;
- controlar permissao de administrador quando o usuario atual pode;
- enviar e-mail de boas-vindas quando habilitado.

## 5.11 `/diretoria/tarefas`

Metricas de tarefas.

Funcoes:

- exibir tarefas registradas por membro;
- exibir tarefas concluidas por membro;
- separar dados por capitulo;
- restringir visualizacao conforme cargo.

Regras:

- diretoria do Ramo ve todos os capitulos;
- presidente/diretoria de capitulo ve apenas o proprio capitulo.

## 5.12 `/diretoria/site`

Administracao do conteudo do site publico.

Funcoes:

- cadastrar membros exibidos no site;
- cadastrar projetos exibidos no site;
- cadastrar fotos da homepage;
- cadastrar fotos historicas;
- importar fotos historicas a partir de pasta publica do Google Drive;
- controlar se um projeto aparece na home, no capitulo, ou em ambos;
- configurar fotos, zoom e posicao;
- preencher/traduzir biografias.

## 5.13 `/arquivos`

Modulo de armazenamento pessoal.

Estado atual:

- pode ficar desabilitado;
- quando desabilitado, o usuario deve ver pagina/estado de indisponibilidade;
- quando habilitado, separa arquivos por usuario.

Funcoes previstas/implementadas:

- upload de arquivos permitidos;
- download do proprio arquivo;
- exclusao do proprio arquivo;
- uso de armazenamento local ou servico remoto.

## 5.14 `/offline`

Pagina de indisponibilidade do servico de dados.

Uso:

- indicar que o servico externo de arquivos/dados esta fora do ar;
- manter o padrao visual do sistema;
- oferecer retorno para a homepage.

## 5.15 `/demo`

Modo demonstracao.

Funcoes:

- apresentar o sistema para visitantes externos;
- demonstrar atas, tarefas, calendario e diretoria;
- usar dados ficticios;
- nao gravar dados reais;
- nao enviar PDF ao servidor;
- exibir contato comercial quando o visitante quiser implementar o sistema.

## 6. Modulos internos

## 6.1 Autenticacao e sessoes

Arquivo principal:

- [`src/lib/auth.js`](./src/lib/auth.js)

Responsabilidades:

- criar o primeiro usuario;
- autenticar credenciais;
- criar sessoes;
- destruir sessoes;
- validar usuario atual;
- aplicar rate limit;
- bloquear tentativas invalidas;
- validar politica de senha;
- definir permissoes por capitulo.

Regras principais:

- cookie: `atas_ieee_session`;
- senha minima: 10 caracteres;
- senha exige maiuscula, minuscula e numero;
- limite de sessoes por usuario: 5;
- lockout apos falhas de login;
- sessoes expiradas sao removidas automaticamente.

## 6.2 Usuarios, capitulos e cargos

Modelos:

- `User`
- `UserChapter`

Regras:

- todo usuario precisa estar ligado a pelo menos um capitulo;
- cargo padrao e `Membro`;
- cargos de diretoria ficam em `chapterRoles`;
- `isAdmin` libera acesso global;
- diretoria de capitulo gerencia apenas seus capitulos;
- diretoria do Ramo tem visao ampla.

## 6.3 Atas e LaTeX

Arquivos:

- [`src/lib/ata.js`](./src/lib/ata.js)
- [`src/lib/saved-atas.js`](./src/lib/saved-atas.js)
- [`src/lib/swiftlatex-client.js`](./src/lib/swiftlatex-client.js)

Responsabilidades:

- registrar capitulos suportados;
- carregar classes LaTeX;
- renderizar `.tex`;
- escapar texto para LaTeX;
- montar projeto no navegador;
- compilar com SwiftLaTeX;
- salvar ata e metadados.

## 6.4 Tarefas e eventos

Arquivo:

- [`src/lib/internal.js`](./src/lib/internal.js)

Responsabilidades:

- listar tarefas;
- criar tarefas;
- editar tarefas;
- excluir tarefas;
- listar eventos;
- criar eventos;
- editar eventos;
- excluir eventos;
- criar recorrencias;
- calcular metricas.

## 6.5 Notificacoes por e-mail

Arquivo:

- [`src/lib/email-notifications.js`](./src/lib/email-notifications.js)

Responsabilidades:

- e-mail de boas-vindas;
- e-mail de nova tarefa;
- e-mail de novo evento;
- personalizacao por destinatario;
- limite de 10 e-mails por segundo;
- filtro para nao enviar a `@local.atas-ieee`.

## 6.6 Conteudo do site publico

Arquivos:

- [`src/lib/site-members.js`](./src/lib/site-members.js)
- [`src/lib/site-projects.js`](./src/lib/site-projects.js)
- [`src/lib/site-home-photos.js`](./src/lib/site-home-photos.js)
- [`src/lib/site-history-photos.js`](./src/lib/site-history-photos.js)

Responsabilidades:

- CRUD de membros do site;
- CRUD de projetos do site;
- CRUD de fotos da home;
- CRUD e importacao de fotos historicas;
- normalizacao de links do Google Drive;
- exposicao de APIs publicas para o site.

## 6.7 Firebase

Arquivo:

- [`src/lib/firebase-sync.js`](./src/lib/firebase-sync.js)

Responsabilidades:

- sincronizar tarefas;
- excluir tarefas no Firebase;
- sincronizar eventos;
- excluir eventos no Firebase.

O PostgreSQL continua sendo a fonte primaria. Firebase e uma integracao para o aplicativo do Ramo.

## 6.8 Arquivos pessoais

Arquivo:

- [`src/lib/internal-files.js`](./src/lib/internal-files.js)

Responsabilidades:

- validar arquivos;
- bloquear extensoes perigosas;
- separar arquivos por usuario;
- operar em modo local, remoto ou desabilitado;
- controlar download e exclusao.

## 7. APIs principais

## 7.1 Autenticacao

- `GET /api/auth/me`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/password`

## 7.2 Usuarios

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/[id]`

## 7.3 Atas

- `GET /api/atas`
- `POST /api/atas`
- `GET /api/atas/[id]`
- `PUT /api/atas/[id]`
- `PATCH /api/atas/[id]`
- `DELETE /api/atas/[id]`

## 7.4 Tarefas

- `GET /api/internal/tasks`
- `POST /api/internal/tasks`
- `PATCH /api/internal/tasks/[id]`
- `DELETE /api/internal/tasks/[id]`
- `GET /api/internal/task-metrics`

## 7.5 Eventos

- `GET /api/internal/events`
- `POST /api/internal/events`
- `PATCH /api/internal/events/[id]`
- `DELETE /api/internal/events/[id]`

## 7.6 Site publico

Leitura publica:

- `GET /api/site-members`
- `GET /api/site-projects`
- `GET /api/site-home-photos`
- `GET /api/site-history-photos`

Gerenciamento:

- `GET/POST /api/site-members/manage`
- `PATCH/DELETE /api/site-members/manage/[id]`
- `GET/POST /api/site-projects/manage`
- `PATCH/DELETE /api/site-projects/manage/[id]`
- `GET/POST /api/site-home-photos/manage`
- `PATCH/DELETE /api/site-home-photos/manage/[id]`
- `GET/POST /api/site-history-photos/manage`
- `PATCH/DELETE /api/site-history-photos/manage/[id]`
- `POST /api/site-history-photos/manage/import`

## 7.7 Arquivos

- `GET /api/internal/files`
- `POST /api/internal/files`
- `DELETE /api/internal/files/[id]`
- `GET /api/internal/files/[id]/download`

## 7.8 PDF e LaTeX

- `GET /api/latex/project`
- `GET /api/swiftlatex/texlive/[engine]/[...slug]`
- `POST /api/pdf-forward/session`
- `POST /api/pdf-forward`

## 8. Modelo de dados

Modelos principais em [`prisma/schema.prisma`](./prisma/schema.prisma):

- `User`: usuario do sistema.
- `Session`: sessao autenticada.
- `UserChapter`: relacao usuario-capitulo.
- `Ata`: ata salva.
- `AtaAttachment`: metadados dos anexos da ata.
- `InternalTask`: tarefa interna.
- `InternalEvent`: evento interno.
- `InternalFile`: arquivo pessoal.
- `SiteMember`: membro publicado no site.
- `SiteProject`: projeto publicado no site.
- `SiteHomePhoto`: foto do slideshow da homepage do site.
- `SiteHistoryPhoto`: foto historica do site.
- `MemberContact`: contatos importados da base de membros.

## 9. Capitulos suportados

Capitulos/sociedades registrados:

- AESS
- APS
- CAS
- CS
- EdSoc
- IAS
- MTTS
- PES
- RAS
- Ramo
- SIGHT
- VTS
- WIE

Cada capitulo com template de ata deve ter pasta em `classes/<CAPITULO>` com `.cls` compativel com o contrato do gerador.

## 10. Variaveis de ambiente

Banco:

```env
DATABASE_URL=
POSTGRES_URL=
PRISMA_DATABASE_URL=
```

E-mail:

```env
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=
EMAIL_FROM=
```

Firebase:

```env
FIREBASE_SERVICE_ACCOUNT=
FIREBASE_PROJECT_ID=
```

DeepL:

```env
DEEPL_API_KEY=
DEEPL_API_URL=
```

Arquivos:

```env
INTERNAL_FILES_STORAGE_MODE=disabled
INTERNAL_STORAGE_DIR=
INTERNAL_STORAGE_MAX_BYTES=
INTERNAL_STORAGE_RECEIVER_URL=
INTERNAL_STORAGE_RECEIVER_TOKEN=
INTERNAL_STORAGE_RECEIVER_TIMEOUT_MS=
```

PDF forward:

```env
PDF_FORWARD_URL=
PDF_FORWARD_TOKEN=
PDF_FORWARD_MAX_BYTES=
```

## 11. Desenvolvimento local

Instalar dependencias:

```bash
npm install
```

Configurar `.env`:

```bash
cp .env.example .env
```

Gerar Prisma Client:

```bash
npm run db:generate
```

Sincronizar schema em banco de teste:

```bash
npm run db:push
```

Rodar localmente:

```bash
npm run dev
```

Abrir:

- `http://127.0.0.1:3000`
- `http://127.0.0.1:3000/login`
- `http://127.0.0.1:3000/demo`

## 12. Build e deploy

Build:

```bash
npm run build
```

Start de producao:

```bash
npm start
```

Build na Vercel:

```bash
npm run vercel-build
```

Observacoes:

- `postinstall` executa `prisma generate`;
- `npm run build` usa `scripts/build.mjs`;
- o deploy precisa das variaveis de ambiente configuradas;
- o banco deve estar sincronizado antes do uso em producao.

## 13. Seguranca

Controles atuais:

- senha com hash `scrypt`;
- salt individual;
- cookie HTTP-only;
- `sameSite=lax`;
- `secure` em producao;
- rate limit em login, troca de senha e setup;
- lockout temporario apos falhas;
- validacao de origem em mutacoes sensiveis;
- permissao por capitulo;
- escopo de arquivos por usuario;
- bloqueio de extensoes perigosas;
- validacao basica de magic bytes de PDF, PNG e JPG;
- sanitizacao de URLs;
- limite de envio de e-mails por segundo;
- modo demo sem gravacao real.

Cuidados:

- nunca versionar `.env`;
- nunca expor `DATABASE_URL`;
- nunca expor tokens Firebase, Resend ou receptor de arquivos;
- revisar rotas novas que aceitem upload;
- manter `/diretoria/site` restrito;
- manter o modulo de arquivos desabilitado enquanto o servico remoto nao estiver pronto.

## 14. Checklist de validacao

Depois de mudancas importantes:

1. `npm run build`.
2. Login em `/login`.
3. Redirecionamento de usuario deslogado.
4. Homepage interna `/`.
5. Modo demo `/demo`.
6. Criar ata em `/atas/nova`.
7. Salvar ata.
8. Abrir banco em `/atas/banco`.
9. Gerar PDF.
10. Criar tarefa.
11. Atualizar status de tarefa.
12. Criar evento simples.
13. Criar evento recorrente.
14. Editar evento.
15. Excluir serie recorrente.
16. Acessar diretoria com usuario autorizado.
17. Confirmar acesso negado para usuario sem permissao.
18. Criar membro.
19. Pesquisar membro.
20. Ver metricas.
21. Criar projeto do site.
22. Publicar membro do site.
23. Importar fotos historicas do Google Drive.
24. Consumir `/api/site-projects` pelo site publico.
25. Testar e-mail com notificacoes habilitadas.
26. Testar arquivos com `INTERNAL_FILES_STORAGE_MODE=disabled`.

## 15. Documentacao complementar

Documentacao mais detalhada dos modulos:

- [`DOCUMENTACAO_MODULOS.md`](./DOCUMENTACAO_MODULOS.md)

Este `README.md` deve ser tratado como a documentacao principal do sistema atual.
