# Sistema Interno IEEE UFJF - Documentacao de modulos

Documentacao principal dos modulos do projeto `atasieeeufjf`.

Ultima revisao desta documentacao: `2026-06-28`

## 1. Visao geral

Este repositorio implementa o **Sistema Interno IEEE UFJF**, publicado em `interno.ieeeufjf.com.br`. O sistema nasceu como gerador e banco de atas e foi expandido para centralizar a gestao interna do Ramo, incluindo:

- autenticacao e usuarios;
- geracao, salvamento e consulta de atas;
- tarefas internas;
- calendario interno;
- area de diretoria;
- metricas de tarefas por membro;
- administracao de conteudo do site publico;
- modo demonstracao aberto;
- notificacoes por e-mail;
- sincronizacao com Firebase;
- armazenamento pessoal de arquivos, atualmente desabilitavel por configuracao.

O projeto usa Next.js, Prisma, PostgreSQL, React e integra bibliotecas locais de LaTeX/SwiftLaTeX para gerar PDFs no navegador.

## 2. Estado atual

Funciona hoje:

- login em rota dedicada `/login`;
- redirecionamento de usuarios deslogados para login;
- homepage interna com atalhos para modulos;
- modo demo em `/demo`, aberto a visitantes;
- geracao de atas com templates por capitulo;
- banco de atas salvas;
- tarefas com status, prioridade, prazo, capitulo e responsavel;
- calendario com eventos, recorrencia e edicao;
- metricas de tarefas por membro para diretorias;
- cadastro e edicao de usuarios/membros;
- administracao de membros, projetos, fotos da homepage e fotos historicas do site publico;
- APIs publicas para o site consumir conteudo publicado;
- notificacoes por e-mail via Resend;
- sincronizacao de tarefas e eventos com Firebase;
- protecoes basicas de autenticacao, rate limit e sessao.

Pontos importantes do estado atual:

- a area `/admin` publica foi removida;
- a administracao do site fica dentro de `/diretoria/site`;
- o modulo de arquivos pode ficar desabilitado com `INTERNAL_FILES_STORAGE_MODE=disabled`;
- o servico remoto de arquivos e tratado como servico de dados separado;
- o modo demo nao deve gravar dados reais nem enviar PDF ao servidor.

## 3. Tecnologias

Principais tecnologias:

- Next.js 16
- React 19
- Prisma 7
- PostgreSQL
- Resend
- SwiftLaTeX no navegador
- LaTeX templates em `classes`
- CSS global em `src/app/globals.css`

Scripts principais:

```bash
npm run dev
npm run build
npm run start
npm run db:generate
npm run db:push
npm run db:studio
```

Scripts de manutencao:

```bash
npm run members:import-contacts
npm run site-projects:seed-chapters
npm run vendor:texlive
```

## 4. Estrutura do repositorio

Principais diretorios:

- [`src/app`](./src/app): rotas App Router, paginas e APIs.
- [`src/components`](./src/components): componentes de tela e modulos visuais.
- [`src/lib`](./src/lib): regras de negocio, autenticacao, banco, atas, notificacoes, arquivos e integracoes.
- [`prisma`](./prisma): schema do banco.
- [`classes`](./classes): templates LaTeX por capitulo.
- [`public`](./public): logos, fontes, fotos, SwiftLaTeX e assets publicos.
- [`scripts`](./scripts): scripts de importacao, seed e build.
- [`ata-receiver`](./ata-receiver): pacote auxiliar para recebimento/armazenamento externo de arquivos/PDFs.

Arquivos principais:

- [`src/app/layout.jsx`](./src/app/layout.jsx): layout raiz e metadados.
- [`src/app/globals.css`](./src/app/globals.css): estilos globais do sistema.
- [`middleware.js`](./middleware.js): redirecionamento e protecao de rotas.
- [`prisma/schema.prisma`](./prisma/schema.prisma): modelo de dados.
- [`src/lib/auth.js`](./src/lib/auth.js): autenticacao, sessoes, permissoes e usuarios.
- [`src/lib/ata.js`](./src/lib/ata.js): templates, normalizacao e renderizacao LaTeX.
- [`src/lib/internal.js`](./src/lib/internal.js): tarefas, eventos, recorrencias e metricas.
- [`src/lib/site-projects.js`](./src/lib/site-projects.js): projetos publicados no site.
- [`src/lib/site-members.js`](./src/lib/site-members.js): membros publicados no site.
- [`src/lib/site-history-photos.js`](./src/lib/site-history-photos.js): fotos historicas publicadas no site.
- [`src/lib/internal-files.js`](./src/lib/internal-files.js): armazenamento pessoal.

## 5. Modulo de autenticacao e permissoes

Arquivos principais:

- [`src/lib/auth.js`](./src/lib/auth.js)
- [`src/app/api/auth/login/route.js`](./src/app/api/auth/login/route.js)
- [`src/app/api/auth/logout/route.js`](./src/app/api/auth/logout/route.js)
- [`src/app/api/auth/me/route.js`](./src/app/api/auth/me/route.js)
- [`src/app/api/auth/setup/route.js`](./src/app/api/auth/setup/route.js)
- [`src/app/api/auth/password/route.js`](./src/app/api/auth/password/route.js)
- [`middleware.js`](./middleware.js)

Responsabilidades:

- criar o primeiro usuario quando o sistema ainda nao tem usuarios;
- autenticar por usuario e senha;
- criar sessao persistida no banco;
- gravar cookie HTTP-only;
- limitar tentativas de login e setup;
- bloquear usuario apos tentativas invalidas;
- exigir senha forte;
- permitir troca de senha;
- calcular capitulos gerenciaveis pelo usuario;
- decidir quem pode acessar diretoria e administracao do site.

Regras importantes:

- cookie de sessao: `atas_ieee_session`;
- validade da sessao: 14 dias;
- limite de sessoes ativas por usuario: 5;
- limite de falhas de login antes de bloqueio: 5;
- bloqueio por falha: 15 minutos;
- senha minima: 10 caracteres, com maiuscula, minuscula e numero;
- usuarios `isAdmin` conseguem gerenciar todos os capitulos;
- diretoria do Ramo consegue ver metricas de todos os capitulos;
- diretoria de capitulo gerencia apenas seu capitulo.

Fluxo de login:

1. Usuario acessa rota protegida.
2. Middleware redireciona para `/login`.
3. Usuario envia credenciais para `/api/auth/login`.
4. Sistema valida rate limit, senha e lockout.
5. Sessao e criada em `sessions`.
6. Cookie HTTP-only e gravado.
7. Usuario e enviado para homepage interna.

## 6. Modulo de usuarios e membros internos

Arquivos principais:

- [`src/lib/auth.js`](./src/lib/auth.js)
- [`src/components/MembersPage.jsx`](./src/components/MembersPage.jsx)
- [`src/app/membros/page.jsx`](./src/app/membros/page.jsx)
- [`src/app/diretoria/membros/page.jsx`](./src/app/diretoria/membros/page.jsx)
- [`src/app/api/users/route.js`](./src/app/api/users/route.js)
- [`src/app/api/users/[id]/route.js`](./src/app/api/users/[id]/route.js)

Responsabilidades:

- listar usuarios visiveis por capitulo;
- pesquisar membros;
- criar usuarios com e-mail;
- associar usuarios a capitulos;
- definir cargos por capitulo;
- editar nome, e-mail, capitulos e cargos;
- limitar criacao/edicao conforme permissao;
- enviar e-mail de boas-vindas quando notificacoes estiverem habilitadas.

Modelo relacionado:

- `User`
- `UserChapter`
- `Session`

Regras de cargo:

- cargo padrao de usuario novo: `Membro`;
- presidente, vice-presidente, tesoureiro, webmaster, secretario e conselheiro sao cargos de diretoria;
- o cargo pode variar por capitulo usando `chapterRoles`;
- administradores podem criar/editar qualquer usuario;
- diretoria de capitulo cria membros apenas nos capitulos que gerencia.

## 7. Modulo de atas

Arquivos principais:

- [`src/components/AtaApp.jsx`](./src/components/AtaApp.jsx)
- [`src/components/AtaHubPage.jsx`](./src/components/AtaHubPage.jsx)
- [`src/components/SavedAtasPage.jsx`](./src/components/SavedAtasPage.jsx)
- [`src/lib/ata.js`](./src/lib/ata.js)
- [`src/lib/saved-atas.js`](./src/lib/saved-atas.js)
- [`src/lib/swiftlatex-client.js`](./src/lib/swiftlatex-client.js)
- [`src/app/atas/page.jsx`](./src/app/atas/page.jsx)
- [`src/app/atas/nova/page.jsx`](./src/app/atas/nova/page.jsx)
- [`src/app/atas/banco/page.jsx`](./src/app/atas/banco/page.jsx)
- [`src/app/api/atas/route.js`](./src/app/api/atas/route.js)
- [`src/app/api/atas/[id]/route.js`](./src/app/api/atas/[id]/route.js)

Responsabilidades:

- oferecer hub de atas com escolha entre banco e nova ata;
- preencher dados da reuniao;
- selecionar template por capitulo;
- adicionar membros presentes;
- ordenar membros de diretoria no topo;
- aplicar regra de cargo nas atas;
- adicionar pautas, resultados e anexos;
- gerar PDF no navegador com SwiftLaTeX;
- salvar rascunho/ata no banco;
- listar atas por capitulo permitido;
- reabrir, renomear e excluir atas salvas.

Capitulos com templates:

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

Regras de cargo na ata:

- em atas do Ramo, cargos de diretoria aparecem como `CARGO-Capitulo`;
- diretoria do Ramo aparece antes da diretoria dos capitulos;
- em atas de capitulo, diretoria daquele capitulo aparece apenas com o cargo;
- presidente de outro capitulo aparece como `Presidente-Capitulo`;
- demais membros aparecem como `Membro`.

Modelos relacionados:

- `Ata`
- `AtaAttachment`

## 8. Modulo de tarefas

Arquivos principais:

- [`src/components/InternalDashboard.jsx`](./src/components/InternalDashboard.jsx)
- [`src/lib/internal.js`](./src/lib/internal.js)
- [`src/app/tarefas/page.jsx`](./src/app/tarefas/page.jsx)
- [`src/app/api/internal/tasks/route.js`](./src/app/api/internal/tasks/route.js)
- [`src/app/api/internal/tasks/[id]/route.js`](./src/app/api/internal/tasks/[id]/route.js)

Responsabilidades:

- listar tarefas abertas e concluidas;
- filtrar por capitulo visivel;
- criar tarefa por popup;
- definir titulo, descricao, prioridade, prazo, capitulo e responsavel;
- criar tarefa para todos do capitulo ou para usuario especifico;
- atualizar status (`pending`, `doing`, `done`);
- editar campos permitidos;
- excluir tarefas;
- sincronizar tarefas com Firebase;
- notificar por e-mail quando solicitado.

Regras de acesso:

- usuario ve tarefas dos capitulos aos quais pertence;
- item `Todos` e reservado para diretoria do Ramo;
- criador, admin ou gestor do capitulo pode editar/excluir;
- mudanca apenas de status e mais permissiva para facilitar acompanhamento.

Modelo relacionado:

- `InternalTask`

## 9. Modulo de calendario

Arquivos principais:

- [`src/components/InternalDashboard.jsx`](./src/components/InternalDashboard.jsx)
- [`src/lib/internal.js`](./src/lib/internal.js)
- [`src/app/calendario/page.jsx`](./src/app/calendario/page.jsx)
- [`src/app/api/internal/events/route.js`](./src/app/api/internal/events/route.js)
- [`src/app/api/internal/events/[id]/route.js`](./src/app/api/internal/events/[id]/route.js)

Responsabilidades:

- listar eventos internos;
- exibir calendario do dia;
- mostrar horarios agendados dinamicamente;
- criar evento por popup;
- editar evento;
- excluir evento isolado;
- excluir serie recorrente;
- criar recorrencias diaria, semanal, quinzenal ou mensal;
- tratar datas e horas em BRT;
- sincronizar eventos com Firebase;
- notificar por e-mail quando solicitado.

Regras de recorrencia:

- frequencias aceitas: `daily`, `weekly`, `biweekly`, `monthly`;
- limite de ocorrencias: 52;
- eventos de uma mesma serie compartilham `recurrenceSeriesId`;
- o site exibe apenas o proximo evento da serie quando aplicavel.

Modelo relacionado:

- `InternalEvent`

## 10. Modulo de diretoria

Arquivos principais:

- [`src/components/BoardHomePage.jsx`](./src/components/BoardHomePage.jsx)
- [`src/components/BoardTaskMetricsPage.jsx`](./src/components/BoardTaskMetricsPage.jsx)
- [`src/components/SiteAdminPage.jsx`](./src/components/SiteAdminPage.jsx)
- [`src/components/AccessDeniedPage.jsx`](./src/components/AccessDeniedPage.jsx)
- [`src/app/diretoria/page.jsx`](./src/app/diretoria/page.jsx)
- [`src/app/diretoria/membros/page.jsx`](./src/app/diretoria/membros/page.jsx)
- [`src/app/diretoria/tarefas/page.jsx`](./src/app/diretoria/tarefas/page.jsx)
- [`src/app/diretoria/site/page.jsx`](./src/app/diretoria/site/page.jsx)

Responsabilidades:

- centralizar atalhos restritos;
- exibir cadastro de membros como subrota;
- exibir metricas de tarefas como subrota;
- exibir administracao de conteudo do site como subrota;
- negar acesso a usuarios sem cargo de diretoria.

Regras:

- presidentes de capitulos veem metricas apenas do proprio capitulo;
- presidente e diretoria do Ramo veem todos os capitulos separados por capitulo;
- usuarios sem permissao recebem pagina de acesso negado.

## 11. Modulo de metricas

Arquivos principais:

- [`src/components/BoardTaskMetricsPage.jsx`](./src/components/BoardTaskMetricsPage.jsx)
- [`src/lib/internal.js`](./src/lib/internal.js)
- [`src/app/api/internal/task-metrics/route.js`](./src/app/api/internal/task-metrics/route.js)

Responsabilidades:

- agrupar tarefas por capitulo;
- calcular tarefas registradas, abertas e concluidas;
- calcular metricas por membro;
- limitar visibilidade conforme cargo do usuario.

Modelo relacionado:

- `InternalTask`
- `User`
- `UserChapter`

## 12. Modulo de conteudo do site publico

Arquivos principais:

- [`src/components/SiteAdminPage.jsx`](./src/components/SiteAdminPage.jsx)
- [`src/lib/site-members.js`](./src/lib/site-members.js)
- [`src/lib/site-projects.js`](./src/lib/site-projects.js)
- [`src/lib/site-home-photos.js`](./src/lib/site-home-photos.js)
- [`src/lib/site-history-photos.js`](./src/lib/site-history-photos.js)
- [`src/lib/deepl-translation.js`](./src/lib/deepl-translation.js)

Responsabilidades:

- administrar membros exibidos no site;
- administrar projetos exibidos na homepage e nas paginas de capitulos;
- administrar fotos do slideshow da homepage;
- administrar fotos historicas;
- importar fotos historicas de pasta publica do Google Drive;
- extrair ano e titulo de nomes de arquivo quando possivel;
- ordenar fotos historicas por ano;
- preencher traducao ausente de biografias com DeepL;
- disponibilizar APIs publicas para o site.

Modelos relacionados:

- `SiteMember`
- `SiteProject`
- `SiteHomePhoto`
- `SiteHistoryPhoto`

Regras:

- apenas gestores/diretoria podem administrar conteudo do site;
- imagens do Google Drive sao convertidas para URL de thumbnail;
- projetos podem aparecer na home, nas paginas de capitulos, ou em ambos;
- projetos sem link externo abrem popup no site publico;
- projetos com pasta do Drive podem importar galeria automaticamente.

## 13. Modulo de modo demo

Arquivos principais:

- [`src/components/demo-data.js`](./src/components/demo-data.js)
- [`src/app/demo/page.jsx`](./src/app/demo/page.jsx)
- [`src/app/demo/atas/page.jsx`](./src/app/demo/atas/page.jsx)
- [`src/app/demo/tarefas/page.jsx`](./src/app/demo/tarefas/page.jsx)
- [`src/app/demo/calendario/page.jsx`](./src/app/demo/calendario/page.jsx)
- [`src/app/demo/diretoria/page.jsx`](./src/app/demo/diretoria/page.jsx)

Responsabilidades:

- permitir demonstracao aberta do sistema;
- usar dados ficticios;
- apresentar atas, tarefas, calendario e diretoria;
- evitar gravacao real;
- evitar envio de PDF ao servidor;
- permitir contato comercial pelo popup "Gostou do sistema...".

Regras:

- rotas `/demo` nao exigem login;
- dados sao isolados;
- APIs reais nao devem receber mutacoes vindas do demo.

## 14. Modulo de notificacoes por e-mail

Arquivo principal:

- [`src/lib/email-notifications.js`](./src/lib/email-notifications.js)

Responsabilidades:

- enviar e-mail de boas-vindas a novos usuarios;
- notificar membros sobre nova tarefa;
- notificar membros sobre novo evento;
- personalizar saudacao com nome do destinatario;
- aplicar lockup visual do Ramo no cabecalho do e-mail;
- respeitar limite de 10 e-mails por segundo;
- ignorar e-mails internos `@local.atas-ieee`.

Variaveis esperadas:

```env
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=...
EMAIL_FROM="Sistema Interno IEEE UFJF <noreply@ieeeufjf.com.br>"
```

Regras:

- se a tarefa tiver responsavel especifico, apenas esse usuario e notificado;
- se a tarefa nao tiver responsavel, membros do capitulo sao notificados;
- eventos notificam os membros do capitulo;
- mensagens sao enviadas em lotes de ate 10 por segundo.

## 15. Modulo de Firebase

Arquivo principal:

- [`src/lib/firebase-sync.js`](./src/lib/firebase-sync.js)

Responsabilidades:

- sincronizar tarefas com Firebase;
- remover tarefas excluidas no Firebase;
- sincronizar eventos com Firebase;
- remover eventos excluidos no Firebase;
- permitir que o aplicativo do Ramo consuma tarefas e calendario.

Cuidados:

- credenciais de service account devem ficar em variaveis de ambiente;
- falhas de sincronizacao devem ser registradas, mas nao impedir necessariamente a criacao local do item;
- o banco PostgreSQL continua sendo a fonte primaria do Sistema Interno.

## 16. Modulo de arquivos pessoais

Arquivos principais:

- [`src/components/FilesPage.jsx`](./src/components/FilesPage.jsx)
- [`src/components/OfflinePage.jsx`](./src/components/OfflinePage.jsx)
- [`src/lib/internal-files.js`](./src/lib/internal-files.js)
- [`src/app/arquivos/page.jsx`](./src/app/arquivos/page.jsx)
- [`src/app/offline/page.jsx`](./src/app/offline/page.jsx)
- [`src/app/api/internal/files/route.js`](./src/app/api/internal/files/route.js)
- [`src/app/api/internal/files/[id]/route.js`](./src/app/api/internal/files/[id]/route.js)
- [`src/app/api/internal/files/[id]/download/route.js`](./src/app/api/internal/files/[id]/download/route.js)

Responsabilidades:

- listar arquivos do usuario;
- enviar arquivos permitidos;
- baixar arquivos do proprio usuario;
- excluir arquivos do proprio usuario;
- separar arquivos por usuario;
- bloquear extensoes perigosas;
- validar magic bytes de PDF, PNG e JPG;
- operar em modo local, remoto ou desabilitado.

Variaveis principais:

```env
INTERNAL_FILES_STORAGE_MODE=disabled
INTERNAL_STORAGE_DIR=.data/internal-storage
INTERNAL_STORAGE_MAX_BYTES=52428800
INTERNAL_STORAGE_RECEIVER_URL=
INTERNAL_STORAGE_RECEIVER_TOKEN=
INTERNAL_STORAGE_RECEIVER_TIMEOUT_MS=5000
```

Modos:

- `disabled`: modulo desabilitado e pagina informa indisponibilidade;
- `local`: grava arquivos no filesystem do servidor Next;
- `remote`: envia arquivos para servico de dados externo.

Cuidados de seguranca:

- extensoes executaveis sao bloqueadas;
- arquivo so pode ser acessado pelo dono;
- caminhos sao normalizados para evitar path traversal;
- servidor remoto exige bearer token;
- se o servico remoto cair, o usuario deve ver pagina/estado de indisponibilidade.

## 17. Modulo de envio de PDF ao servidor

Arquivos principais:

- [`src/lib/pdf-forward-client.js`](./src/lib/pdf-forward-client.js)
- [`src/lib/pdf-forward-server.js`](./src/lib/pdf-forward-server.js)
- [`src/app/api/pdf-forward/route.js`](./src/app/api/pdf-forward/route.js)
- [`src/app/api/pdf-forward/session/route.js`](./src/app/api/pdf-forward/session/route.js)

Responsabilidades:

- criar sessao/token para upload de PDF gerado;
- validar permissao por capitulo;
- limitar tamanho de PDF encaminhado;
- normalizar nome do PDF;
- enviar metadados para o receptor externo;
- proteger o servidor contra uploads arbitrarios.

Cuidados:

- validar tipo e tamanho do PDF;
- nao aceitar capitulo fora do escopo do usuario;
- manter token de encaminhamento curto e assinado;
- nao expor segredo de receptor no cliente.

## 18. Modulo de LaTeX e SwiftLaTeX

Arquivos principais:

- [`src/lib/ata.js`](./src/lib/ata.js)
- [`src/lib/swiftlatex-client.js`](./src/lib/swiftlatex-client.js)
- [`src/components/PdfGenerationProgress.jsx`](./src/components/PdfGenerationProgress.jsx)
- [`public/swiftlatex`](./public/swiftlatex)
- [`src/app/api/swiftlatex/texlive/[engine]/[...slug]/route.js`](./src/app/api/swiftlatex/texlive/[engine]/[...slug]/route.js)
- [`src/app/api/latex/project/route.js`](./src/app/api/latex/project/route.js)

Responsabilidades:

- preparar projeto LaTeX no navegador;
- carregar motor SwiftLaTeX;
- copiar classes e imagens dos capitulos;
- renderizar `.tex` com dados da ata;
- compilar PDF localmente;
- exibir progresso de geracao;
- permitir fallback/apoio por rotas de arquivos TeX.

Cuidados:

- sempre escapar texto enviado ao LaTeX;
- limitar anexos;
- aceitar apenas imagens permitidas como anexos na UI;
- nao depender de `pdflatex` no servidor para o fluxo principal.

## 19. APIs publicas para o site

Rotas:

- `GET /api/site-members`
- `GET /api/site-projects`
- `GET /api/site-home-photos`
- `GET /api/site-history-photos`

Responsabilidades:

- expor apenas registros publicos;
- retornar dados normalizados;
- permitir CORS quando necessario para o site publico;
- nao exigir login para leitura publica.

Essas rotas alimentam o repositorio `SiteRamo`.

## 20. APIs de gerenciamento do site

Rotas principais:

- `GET/POST /api/site-members/manage`
- `PATCH/DELETE /api/site-members/manage/[id]`
- `GET/POST /api/site-projects/manage`
- `PATCH/DELETE /api/site-projects/manage/[id]`
- `GET/POST /api/site-home-photos/manage`
- `PATCH/DELETE /api/site-home-photos/manage/[id]`
- `GET/POST /api/site-history-photos/manage`
- `PATCH/DELETE /api/site-history-photos/manage/[id]`
- `POST /api/site-history-photos/manage/import`

Responsabilidades:

- CRUD de conteudo publicado no site;
- validacao e normalizacao de URLs;
- importacao de galerias do Google Drive;
- controle de visibilidade e ordem.

Todas as rotas de gerenciamento exigem usuario com permissao de diretoria/gestao.

## 21. Modelo de dados

Modelos principais em [`prisma/schema.prisma`](./prisma/schema.prisma):

- `User`: usuario do sistema.
- `Session`: sessao autenticada.
- `UserChapter`: relacao usuario-capitulo.
- `Ata`: ata salva.
- `AtaAttachment`: anexo de ata salva.
- `InternalTask`: tarefa interna.
- `InternalEvent`: evento interno.
- `InternalFile`: arquivo pessoal.
- `SiteMember`: membro publicado no site.
- `SiteProject`: projeto publicado no site.
- `SiteHomePhoto`: foto do slideshow da homepage.
- `SiteHistoryPhoto`: foto historica.
- `MemberContact`: contatos importados de base de membros.

## 22. Fluxos principais

## 22.1 Criar usuario

1. Gestor acessa `/diretoria/membros`.
2. Abre popup de cadastro.
3. Informa nome, usuario, e-mail, senha e capitulos.
4. Sistema valida permissao.
5. Usuario e salvo em `users`.
6. Capitulos sao salvos em `user_chapters`.
7. Se e-mail estiver habilitado, boas-vindas sao enviadas.

## 22.2 Criar tarefa

1. Usuario acessa `/tarefas`.
2. Clica em adicionar tarefa.
3. Escolhe capitulo, titulo, prioridade, prazo e responsavel opcional.
4. Sistema valida permissao de escrita.
5. Tarefa e salva em `internal_tasks`.
6. Tarefa e sincronizada com Firebase.
7. Se solicitado, e-mail e enviado ao responsavel ou aos membros do capitulo.

## 22.3 Criar evento recorrente

1. Usuario acessa `/calendario`.
2. Clica em adicionar evento.
3. Define inicio e fim em horario BRT.
4. Ativa recorrencia e escolhe frequencia/quantidade.
5. Sistema cria uma serie com `recurrenceSeriesId`.
6. Eventos sao sincronizados com Firebase.
7. Se solicitado, membros do capitulo sao notificados.

## 22.4 Gerar ata

1. Usuario acessa `/atas`.
2. Escolhe criar nova ata.
3. Seleciona sociedade/capitulo.
4. Preenche dados da reuniao.
5. Adiciona membros presentes.
6. Informa pautas, resultados e anexos.
7. Gera PDF no navegador.
8. Pode salvar a ata no banco.
9. Pode encaminhar PDF ao servidor receptor quando configurado.

## 22.5 Publicar projeto no site

1. Diretoria acessa `/diretoria/site`.
2. Cria projeto com titulo, subtitulo, descricao, capitulo, imagem e link opcional.
3. Pode adicionar galeria via URLs ou pasta do Google Drive.
4. Define se aparece na home e/ou pagina do capitulo.
5. Site publico consome o projeto via `/api/site-projects`.

## 23. Variaveis de ambiente importantes

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

## 24. Seguranca

Controles atuais:

- senha com hash `scrypt`;
- cookie HTTP-only;
- `sameSite=lax`;
- `secure` em producao;
- rate limit em login, senha e setup;
- lockout temporario;
- validacao de origem em mutacoes sensiveis;
- permissoes por capitulo;
- escopo de arquivos por usuario;
- bloqueio de extensoes perigosas;
- sanitizacao de URLs publicas;
- filtro de e-mails `@local.atas-ieee`;
- limite de envio de e-mails por segundo;
- modo demo sem gravacao real.

Cuidados de manutencao:

- nao expor `DATABASE_URL`, tokens Firebase, Resend ou receptor de arquivos;
- manter rotas de gerenciamento sempre autenticadas;
- revisar qualquer nova rota que aceite arquivo;
- revisar qualquer rota que retorne dados publicos;
- manter o modulo de arquivos desabilitado enquanto o servico remoto nao estiver pronto;
- usar HTTPS em producao.

## 25. Checklist rapido de validacao

Depois de mudancas importantes, validar:

1. `npm run build`.
2. Login em `/login`.
3. Redirecionamento de usuario deslogado.
4. Homepage interna `/`.
5. Modo demo `/demo`.
6. Criar e gerar ata.
7. Salvar ata.
8. Abrir banco de atas.
9. Criar tarefa.
10. Atualizar status de tarefa.
11. Criar evento simples.
12. Criar evento recorrente.
13. Excluir evento de serie.
14. Acessar diretoria com usuario autorizado.
15. Ver acesso negado com usuario sem permissao.
16. Criar membro.
17. Pesquisar membro.
18. Ver metricas por capitulo.
19. Criar projeto do site.
20. Publicar membro do site.
21. Importar fotos historicas do Google Drive.
22. Consumir `/api/site-projects` pelo site publico.
23. Testar e-mail com `EMAIL_NOTIFICATIONS_ENABLED=true`.
24. Testar sistema com modulo de arquivos desabilitado.

## 26. Arquivos mais importantes para manutencao

- [`src/lib/auth.js`](./src/lib/auth.js)
- [`src/lib/internal.js`](./src/lib/internal.js)
- [`src/lib/ata.js`](./src/lib/ata.js)
- [`src/lib/saved-atas.js`](./src/lib/saved-atas.js)
- [`src/lib/email-notifications.js`](./src/lib/email-notifications.js)
- [`src/lib/firebase-sync.js`](./src/lib/firebase-sync.js)
- [`src/lib/site-members.js`](./src/lib/site-members.js)
- [`src/lib/site-projects.js`](./src/lib/site-projects.js)
- [`src/lib/site-home-photos.js`](./src/lib/site-home-photos.js)
- [`src/lib/site-history-photos.js`](./src/lib/site-history-photos.js)
- [`src/lib/internal-files.js`](./src/lib/internal-files.js)
- [`prisma/schema.prisma`](./prisma/schema.prisma)
- [`src/app/globals.css`](./src/app/globals.css)

Este documento deve ser tratado como a documentacao principal dos modulos do Sistema Interno.
